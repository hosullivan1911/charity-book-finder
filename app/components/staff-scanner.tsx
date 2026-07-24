"use client";

import type { IScannerControls } from "@zxing/browser";
import { BrowserMultiFormatReader } from "@zxing/browser";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { BookMetadata, InventoryBook, Shop } from "../../lib/types";
import { BookIcon, ScanIcon, SearchIcon, ShopIcon } from "./icons";

type StockMode = "add" | "inventory";

type StockResult = {
  action: "added";
  book: BookMetadata;
  inventoryId: number;
};

export function StaffScanner({
  shop,
  username,
}: {
  shop: Shop;
  username: string;
}) {
  const [mode, setMode] = useState<StockMode>("add");
  const [isbn, setIsbn] = useState("");
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<StockResult | null>(null);
  const [inventory, setInventory] = useState<InventoryBook[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState("");
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [removingId, setRemovingId] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const refreshInventory = useCallback(async () => {
    setInventoryLoading(true);
    setInventoryError("");
    try {
      const response = await fetch("/api/shop-inventory", {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        inventory?: InventoryBook[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not load this shop's inventory.");
      }
      setInventory(Array.isArray(data.inventory) ? data.inventory : []);
    } catch (loadError) {
      setInventoryError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load this shop's inventory.",
      );
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/shop-inventory", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as {
          inventory?: InventoryBook[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error || "Could not load this shop's inventory.");
        }
        setInventory(Array.isArray(data.inventory) ? data.inventory : []);
        setInventoryError("");
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setInventoryError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load this shop's inventory.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setInventoryLoading(false);
      });

    return () => controller.abort();
  }, []);

  const processStock = useCallback(
    async (code: string) => {
      const cleanIsbn = code.replace(/\D/g, "");
      if (cleanIsbn.length !== 13) {
        setError("Enter the 13-digit ISBN printed above the barcode.");
        return;
      }

      setSubmitting(true);
      setError("");
      setResult(null);

      try {
        const response = await fetch("/api/intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isbn: cleanIsbn }),
        });
        const data = (await response.json()) as StockResult & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error || "Could not add this book.");
        }
        setResult(data);
        setIsbn("");
        await refreshInventory();
      } catch (submissionError) {
        setError(
          submissionError instanceof Error
            ? submissionError.message
            : "Could not update inventory.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [refreshInventory],
  );

  useEffect(() => {
    if (!scanning || !videoRef.current) return;
    let active = true;
    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        (decoded, scanError, controls) => {
          controlsRef.current = controls;
          if (!active || !decoded) return;
          const value = decoded.getText().replace(/\D/g, "");
          if (value.length === 13) {
            setIsbn(value);
            setScanning(false);
            controls.stop();
            void processStock(value);
          }
          if (scanError?.name && scanError.name !== "NotFoundException") {
            setError(
              "The camera could not read that barcode. Try the number instead.",
            );
          }
        },
      )
      .catch((cameraError: unknown) => {
        setScanning(false);
        const errorName =
          cameraError instanceof DOMException ? cameraError.name : "";
        setError(
          errorName === "NotAllowedError"
            ? "Camera permission was declined. Allow camera access in your browser settings, then try again."
            : "Camera access is unavailable. Enter the ISBN printed above the barcode.",
        );
      });

    return () => {
      active = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [processStock, scanning]);

  const filteredInventory = useMemo(() => {
    const needle = inventoryQuery.trim().toLowerCase();
    return inventory.filter(
      (book) =>
        !needle ||
        `${book.title} ${book.author} ${book.isbn13}`
          .toLowerCase()
          .includes(needle),
    );
  }, [inventory, inventoryQuery]);

  function changeMode(nextMode: StockMode) {
    setMode(nextMode);
    setResult(null);
    setError("");
    setIsbn("");
  }

  function startScanner() {
    setError("");
    setResult(null);
    if (!window.isSecureContext) {
      setError(
        "The camera requires HTTPS. Open the Vercel URL, or enter the ISBN manually.",
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "This browser does not support camera scanning. Enter the ISBN manually.",
      );
      return;
    }
    setScanning(true);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void processStock(isbn);
  }

  async function removeInventoryItem(inventoryId: number) {
    setRemovingId(inventoryId);
    setInventoryError("");
    try {
      const response = await fetch("/api/shop-inventory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not remove this book.");
      }
      setInventory((current) =>
        current.filter((book) => book.inventoryId !== inventoryId),
      );
    } catch (removeError) {
      setInventoryError(
        removeError instanceof Error
          ? removeError.message
          : "Could not remove this book.",
      );
    } finally {
      setRemovingId(null);
    }
  }

  function scanNext() {
    setResult(null);
    setError("");
    setIsbn("");
    startScanner();
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <div className="staff-shell inventory-shell">
      <aside className="staff-aside">
        <div>
          <p className="kicker">Giveleaf for shops</p>
          <h1>Scan in. Remove in one tap.</h1>
          <p>
            Scan books into the live catalogue, then remove them directly from
            inventory whenever they are no longer available.
          </p>
        </div>

        <nav className="stock-tabs" aria-label="Inventory actions">
          <button
            className={mode === "add" ? "active" : ""}
            onClick={() => changeMode("add")}
            type="button"
          >
            <span>+</span>
            <div>
              <strong>Stock in</strong>
              <small>Add a book</small>
            </div>
          </button>
          <button
            className={mode === "inventory" ? "active" : ""}
            onClick={() => changeMode("inventory")}
            type="button"
          >
            <span><BookIcon /></span>
            <div>
              <strong>Inventory</strong>
              <small>{inventory.length} available</small>
            </div>
          </button>
        </nav>

        <div className="aside-tip">
          <ShopIcon />
          <p>
            <strong>{shop.name}</strong> Signed in as {username}. Every update
            is applied only to this shop&apos;s inventory.
          </p>
        </div>
      </aside>

      <section className="intake-card stock-card">
        <div className="intake-heading">
          <div>
            <p className="kicker">
              {mode === "add" ? "Stock in" : "Current stock"}
            </p>
            <h2>
              {mode === "add" ? "Add a book" : "Shop inventory"}
            </h2>
          </div>
          <div className="shop-session">
            <span className="shop-badge">
              <ShopIcon /> {username} · {shop.name}
            </span>
            <button
              className="sign-out-button"
              onClick={signOut}
              type="button"
            >
              Sign out
            </button>
          </div>
        </div>

        {mode === "inventory" ? (
          <div className="inventory-view">
            <div className="inventory-filters">
              <label className="inventory-search">
                <SearchIcon />
                <span className="sr-only">
                  Filter by title, author or ISBN
                </span>
                <input
                  onChange={(event) => setInventoryQuery(event.target.value)}
                  placeholder="Title, author or ISBN"
                  value={inventoryQuery}
                />
              </label>
            </div>

            {inventoryError && (
              <p className="form-error" role="alert">{inventoryError}</p>
            )}

            {inventoryLoading ? (
              <div className="inventory-empty">
                <p>Checking the shelves…</p>
              </div>
            ) : filteredInventory.length ? (
              <div className="inventory-list">
                {filteredInventory.map((book) => (
                  <article key={book.inventoryId} className="inventory-row">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt=""
                      onError={(event) => {
                        event.currentTarget.src = "/book-placeholder.svg";
                      }}
                      src={book.coverUrl}
                    />
                    <div className="inventory-book-copy">
                      <h3>{book.title}</h3>
                      <p>{book.author}</p>
                      <small>{book.isbn13}</small>
                    </div>
                    <button
                      className="remove-book-button"
                      disabled={removingId === book.inventoryId}
                      onClick={() => removeInventoryItem(book.inventoryId)}
                      aria-label={`Remove ${book.title} from inventory`}
                      type="button"
                    >
                      {removingId === book.inventoryId
                        ? "Removing…"
                        : "Remove"}
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="inventory-empty">
                <BookIcon />
                <h3>No books found</h3>
                <p>
                  {inventory.length
                    ? "Try clearing or changing the filters."
                    : "Scan the first book in to start this shop's inventory."}
                </p>
              </div>
            )}
          </div>
        ) : result ? (
          <div className="result-view compact-result">
            <div className="success-mark">✓</div>
            <p className="kicker">Added to inventory</p>
            <h2>{result.book.title}</h2>
            <p className="result-author">{result.book.author}</p>

            <div className="result-book stock-result-book">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.book.coverUrl}
                alt=""
                onError={(event) => {
                  event.currentTarget.src = "/book-placeholder.svg";
                }}
              />
              <div className="stock-result-copy">
                <span>Now visible to book hunters</span>
                <strong>Cover included automatically</strong>
              </div>
            </div>

            <button className="primary-action" type="button" onClick={scanNext}>
              <ScanIcon /> Scan the next book
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <button
              className="camera-button"
              disabled={submitting}
              type="button"
              onClick={startScanner}
            >
              <span><ScanIcon /></span>
              <strong>Scan book in</strong>
              <small>
                The book and its cover are added as soon as the barcode is read
              </small>
            </button>

            <div className="form-divider"><span>or type the number</span></div>

            <label className="form-field">
              <span>ISBN-13</span>
              <input
                inputMode="numeric"
                pattern="[0-9]{13}"
                maxLength={13}
                value={isbn}
                onChange={(event) =>
                  setIsbn(event.target.value.replace(/\D/g, ""))
                }
                placeholder="9780000000000"
                required
              />
              <small>The 13 digits printed above the barcode</small>
            </label>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button
              className="primary-action"
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? "Updating inventory…"
                : "Add to inventory"}
            </button>
          </form>
        )}
      </section>

      {scanning && (
        <div
          className="scanner-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="ISBN scanner"
        >
          <div className="scanner-panel">
            <div className="scanner-top">
              <div>
                <p className="kicker">Stock in</p>
                <h2>Centre the ISBN barcode</h2>
              </div>
              <button
                type="button"
                onClick={() => setScanning(false)}
                aria-label="Close camera"
              >
                ×
              </button>
            </div>
            <div className="video-wrap">
              <video ref={videoRef} muted playsInline />
              <div className="scan-frame"><span /></div>
            </div>
            <p>
              Hold still about 15 cm from the back cover. The inventory updates
              automatically when the barcode is read.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
