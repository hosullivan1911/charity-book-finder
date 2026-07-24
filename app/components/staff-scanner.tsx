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
import type {
  BookCondition,
  BookMetadata,
  InventoryBook,
  Shop,
} from "../../lib/types";
import { BookIcon, ScanIcon, SearchIcon, ShopIcon } from "./icons";

type StockMode = "add" | "remove" | "inventory";

type StockResult = {
  action: "added" | "removed";
  book: BookMetadata;
  inventoryId: number;
  demo?: boolean;
};

function conditionLabel(condition: BookCondition) {
  return condition === "like_new"
    ? "Like new"
    : condition === "fair"
      ? "Fair / worn"
      : "Good";
}

export function StaffScanner({ shop }: { shop: Shop }) {
  const [mode, setMode] = useState<StockMode>("add");
  const [isbn, setIsbn] = useState("");
  const [location, setLocation] = useState("Fiction · I–K · Shelf 3");
  const [condition, setCondition] = useState<BookCondition>("good");
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<StockResult | null>(null);
  const [inventory, setInventory] = useState<InventoryBook[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState("");
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inventoryCondition, setInventoryCondition] = useState<
    BookCondition | "all"
  >("all");
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
      if (mode === "add" && !location.trim()) {
        setError("Add a shelf location before scanning the book.");
        return;
      }

      setSubmitting(true);
      setError("");
      setResult(null);

      try {
        const response =
          mode === "remove"
            ? await fetch("/api/shop-inventory", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isbn: cleanIsbn }),
              })
            : await fetch("/api/intake", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  isbn: cleanIsbn,
                  shelfLocation: location,
                  condition,
                }),
              });
        const data = (await response.json()) as StockResult & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(
            data.error ||
              (mode === "remove"
                ? "Could not remove this book."
                : "Could not add this book."),
          );
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
    [condition, location, mode, refreshInventory],
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
        (inventoryCondition === "all" ||
          book.condition === inventoryCondition) &&
        (!needle ||
          `${book.title} ${book.author} ${book.isbn13} ${book.shelfLocation}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [inventory, inventoryCondition, inventoryQuery]);

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
        throw new Error(data.error || "Could not mark this book as sold.");
      }
      setInventory((current) =>
        current.filter((book) => book.inventoryId !== inventoryId),
      );
    } catch (removeError) {
      setInventoryError(
        removeError instanceof Error
          ? removeError.message
          : "Could not mark this book as sold.",
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

  const activeMode = mode === "inventory" ? "inventory" : mode;

  return (
    <div className="staff-shell inventory-shell">
      <aside className="staff-aside">
        <div>
          <p className="kicker">Giveleaf for shops</p>
          <h1>One scan in. One scan out.</h1>
          <p>
            Add books as they reach the shelf and remove them as they sell. Your
            public catalogue stays current automatically.
          </p>
        </div>

        <nav className="stock-tabs" aria-label="Inventory actions">
          <button
            className={activeMode === "add" ? "active" : ""}
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
            className={activeMode === "remove" ? "active" : ""}
            onClick={() => changeMode("remove")}
            type="button"
          >
            <span>−</span>
            <div>
              <strong>Stock out</strong>
              <small>Remove a sold book</small>
            </div>
          </button>
          <button
            className={activeMode === "inventory" ? "active" : ""}
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
            <strong>{shop.name}</strong> Every update is applied only to this
            shop&apos;s inventory.
          </p>
        </div>
      </aside>

      <section className="intake-card stock-card">
        <div className="intake-heading">
          <div>
            <p className="kicker">
              {mode === "add"
                ? "Stock in"
                : mode === "remove"
                  ? "Stock out"
                  : "Current stock"}
            </p>
            <h2>
              {mode === "add"
                ? "Add a book"
                : mode === "remove"
                  ? "Remove a sold book"
                  : "Shop inventory"}
            </h2>
          </div>
          <div className="shop-session">
            <span className="shop-badge"><ShopIcon /> {shop.name}</span>
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
                  Filter by title, author, ISBN or shelf
                </span>
                <input
                  onChange={(event) => setInventoryQuery(event.target.value)}
                  placeholder="Title, author, ISBN or shelf"
                  value={inventoryQuery}
                />
              </label>
              <label>
                <span className="sr-only">Filter by condition</span>
                <select
                  onChange={(event) =>
                    setInventoryCondition(
                      event.target.value as BookCondition | "all",
                    )
                  }
                  value={inventoryCondition}
                >
                  <option value="all">All conditions</option>
                  <option value="like_new">Like new</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair / worn</option>
                </select>
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
                      src={book.coverUrl || "/book-placeholder.svg"}
                    />
                    <div className="inventory-book-copy">
                      <h3>{book.title}</h3>
                      <p>{book.author}</p>
                      <small>{book.isbn13}</small>
                    </div>
                    <div className="inventory-location">
                      <strong>{book.shelfLocation}</strong>
                      <small>{conditionLabel(book.condition)}</small>
                    </div>
                    <button
                      className="sold-button"
                      disabled={removingId === book.inventoryId}
                      onClick={() => removeInventoryItem(book.inventoryId)}
                      type="button"
                    >
                      {removingId === book.inventoryId
                        ? "Removing…"
                        : "Mark sold"}
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
            <div
              className={
                result.action === "added"
                  ? "success-mark"
                  : "success-mark removed"
              }
            >
              {result.action === "added" ? "✓" : "−"}
            </div>
            <p className="kicker">
              {result.action === "added" ? "Added to inventory" : "Removed"}
            </p>
            <h2>{result.book.title}</h2>
            <p className="result-author">{result.book.author}</p>

            <div className="result-book stock-result-book">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.book.coverUrl || "/book-placeholder.svg"}
                alt=""
                onError={(event) => {
                  event.currentTarget.src = "/book-placeholder.svg";
                }}
              />
              <div className="stock-result-copy">
                <span>
                  {result.action === "added"
                    ? "Now visible to book hunters"
                    : "No longer shown in the catalogue"}
                </span>
                {result.action === "added" && (
                  <>
                    <strong>{location}</strong>
                    <small>{conditionLabel(condition)}</small>
                  </>
                )}
                {result.action === "removed" && (
                  <strong>Marked as sold</strong>
                )}
              </div>
            </div>

            <button className="primary-action" type="button" onClick={scanNext}>
              <ScanIcon /> Scan the next book
            </button>
            {result.demo && (
              <p className="demo-note">
                Inventory storage is unavailable, so this scan was not saved.
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={submit}>
            <button
              className={
                mode === "remove"
                  ? "camera-button remove-camera-button"
                  : "camera-button"
              }
              disabled={submitting}
              type="button"
              onClick={startScanner}
            >
              <span><ScanIcon /></span>
              <strong>
                {mode === "add" ? "Scan book in" : "Scan sold book out"}
              </strong>
              <small>
                {mode === "add"
                  ? "The book is added as soon as its barcode is read"
                  : "One available copy is removed as soon as its barcode is read"}
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

            {mode === "add" && (
              <>
                <div className="form-row">
                  <label className="form-field">
                    <span>Condition</span>
                    <select
                      value={condition}
                      onChange={(event) =>
                        setCondition(event.target.value as BookCondition)
                      }
                    >
                      <option value="like_new">Like new</option>
                      <option value="good">Good</option>
                      <option value="fair">Fair / worn</option>
                    </select>
                  </label>
                </div>

                <label className="form-field">
                  <span>Shelf location</span>
                  <input
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="e.g. Fiction · A–D · Shelf 2"
                    required
                  />
                  <small>
                    Use wording a customer or new volunteer can follow.
                  </small>
                </label>
              </>
            )}

            {error && <p className="form-error" role="alert">{error}</p>}

            <button
              className={
                mode === "remove"
                  ? "primary-action remove-action"
                  : "primary-action"
              }
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? "Updating inventory…"
                : mode === "add"
                  ? "Add to inventory"
                  : "Remove from inventory"}
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
                <p className="kicker">
                  {mode === "add" ? "Stock in" : "Stock out"}
                </p>
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
