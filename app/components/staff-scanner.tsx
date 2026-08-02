"use client";

import type { IScannerControls } from "@zxing/browser";
import {
  BarcodeFormat,
  BrowserMultiFormatReader,
} from "@zxing/browser";
import { DecodeHintType } from "@zxing/library";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import type { BookMetadata, InventoryBook, Shop } from "../../lib/types";
import { isbnFromDetectedBarcode } from "../../lib/isbn-validation";
import { BookIcon, ScanIcon, SearchIcon, ShopIcon } from "./icons";

type StockMode = "add" | "inventory" | "account";

type StockResult = {
  action: "added";
  book: BookMetadata;
  inventoryId: number;
};

type InventoryOutcome = "sold" | "removed";

type DetectedBarcode = {
  rawValue: string;
};

type NativeBarcodeDetector = {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
};

type NativeBarcodeDetectorConstructor = {
  new (options: { formats: string[] }): NativeBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

type ExtendedMediaTrackCapabilities = MediaTrackCapabilities & {
  focusMode?: string[];
  torch?: boolean;
  zoom?: {
    max: number;
    min: number;
    step: number;
  };
};

type ExtendedMediaTrackConstraintSet = MediaTrackConstraintSet & {
  focusMode?: string;
  torch?: boolean;
  zoom?: number;
};

const SCANNER_ENGINE = "giveleaf-isbn-v3";

function createIsbnReader() {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]);
  hints.set(DecodeHintType.TRY_HARDER, true);

  return new BrowserMultiFormatReader(
    hints,
    {
      delayBetweenScanAttempts: 120,
      delayBetweenScanSuccess: 500,
    },
  );
}

function nativeBarcodeDetector() {
  return (
    window as typeof window & {
      BarcodeDetector?: NativeBarcodeDetectorConstructor;
    }
  ).BarcodeDetector;
}

async function supportsNativeEan13(
  Detector: NativeBarcodeDetectorConstructor,
) {
  if (!Detector.getSupportedFormats) return true;
  try {
    return (await Detector.getSupportedFormats()).includes("ean_13");
  } catch {
    return false;
  }
}

async function optimiseCameraTrack(track: MediaStreamTrack) {
  if (!track.getCapabilities || !track.applyConstraints) {
    return { torchAvailable: false, zoomed: false };
  }

  const capabilities =
    track.getCapabilities() as ExtendedMediaTrackCapabilities;
  let zoomed = false;

  if (capabilities.focusMode?.includes("continuous")) {
    await track
      .applyConstraints({
        advanced: [
          {
            focusMode: "continuous",
          } as ExtendedMediaTrackConstraintSet,
        ],
      })
      .catch(() => undefined);
  }

  if (capabilities.zoom && capabilities.zoom.max > capabilities.zoom.min) {
    const preferredZoom = Math.min(
      capabilities.zoom.max,
      Math.max(capabilities.zoom.min, 2),
    );
    if (preferredZoom > capabilities.zoom.min) {
      await track
        .applyConstraints({
          advanced: [
            {
              zoom: preferredZoom,
            } as ExtendedMediaTrackConstraintSet,
          ],
        })
        .then(() => {
          zoomed = true;
        })
        .catch(() => undefined);
    }
  }

  return {
    torchAvailable: Boolean(capabilities.torch),
    zoomed,
  };
}

async function imageSourceForFile(file: File) {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      return {
        source: bitmap as CanvasImageSource,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
    } catch {
      // Fall through to an image element on older mobile implementations.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error("The selected image could not be opened.");
  }
  return {
    source: image as CanvasImageSource,
    width: image.naturalWidth,
    height: image.naturalHeight,
    dispose: () => URL.revokeObjectURL(objectUrl),
  };
}

async function decodeIsbnPhoto(file: File) {
  const image = await imageSourceForFile(file);
  try {
    const Detector = nativeBarcodeDetector();
    if (Detector && (await supportsNativeEan13(Detector))) {
      try {
        const detector = new Detector({ formats: ["ean_13"] });
        const detected = await detector.detect(image.source);
        for (const barcode of detected) {
          if (isbnFromDetectedBarcode(barcode.rawValue)) {
            return barcode.rawValue;
          }
        }
      } catch {
        // The ZXing photo path below remains available on unsupported devices.
      }
    }

    const reader = createIsbnReader();
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    const bands = [
      { top: 0, height: image.height },
      { top: 0, height: Math.round(image.height * 0.58) },
      {
        top: Math.round(image.height * 0.21),
        height: Math.round(image.height * 0.58),
      },
      {
        top: Math.round(image.height * 0.42),
        height: Math.round(image.height * 0.58),
      },
    ];

    for (const band of bands) {
      const safeHeight = Math.min(band.height, image.height - band.top);
      const scale = Math.min(1, 2200 / image.width);
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(safeHeight * scale));
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        image.source,
        0,
        band.top,
        image.width,
        safeHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      try {
        const value = reader.decodeFromCanvas(canvas).getText();
        if (isbnFromDetectedBarcode(value)) return value;
      } catch {
        // Try the next horizontal band before asking for a closer photo.
      }
    }
  } finally {
    image.dispose();
  }

  return null;
}

export function StaffScanner({
  shop,
  username,
  role,
}: {
  shop: Shop;
  username: string;
  role: string;
}) {
  const [mode, setMode] = useState<StockMode>("add");
  const [isbn, setIsbn] = useState("");
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [photoScanning, setPhotoScanning] = useState(false);
  const [scannerStatus, setScannerStatus] = useState("Starting rear camera…");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [error, setError] = useState("");
  const [manualEntry, setManualEntry] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthor, setManualAuthor] = useState("");
  const [manualCoverUrl, setManualCoverUrl] = useState("");
  const [result, setResult] = useState<StockResult | null>(null);
  const [inventory, setInventory] = useState<InventoryBook[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState("");
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [removing, setRemoving] = useState<{
    inventoryId: number;
    action: "sold" | "remove";
  } | null>(null);
  const [lastRemoved, setLastRemoved] = useState<{
    book: InventoryBook;
    outcome: InventoryOutcome;
  } | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const [accountError, setAccountError] = useState("");
  const [accountSaving, setAccountSaving] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const scanAcceptedRef = useRef(false);

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
    async (
      code: string,
      manual?: { title: string; author: string; coverUrl: string },
    ) => {
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
          body: JSON.stringify({ isbn: cleanIsbn, ...(manual ? { manual } : {}) }),
        });
        const data = (await response.json()) as StockResult & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error || "Could not add this book.");
        }
        setResult(data);
        setIsbn("");
        setManualEntry(false);
        setManualTitle("");
        setManualAuthor("");
        setManualCoverUrl("");
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

  const acceptBarcode = useCallback(
    (rawValue: string, controls?: IScannerControls) => {
      if (scanAcceptedRef.current) return false;
      const value = isbnFromDetectedBarcode(rawValue);
      if (!value) return false;

      scanAcceptedRef.current = true;
      setScannerStatus(`ISBN ${value} read`);
      setIsbn(value);
      setScanning(false);
      controls?.stop();
      controlsRef.current?.stop();
      void processStock(value);
      return true;
    },
    [processStock],
  );

  async function scanBarcodePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    controlsRef.current?.stop();
    setScanning(false);
    setPhotoScanning(true);
    setError("");
    setResult(null);
    scanAcceptedRef.current = false;

    try {
      const rawValue = await decodeIsbnPhoto(file);
      if (!rawValue || !acceptBarcode(rawValue)) {
        setError(
          "That photo was not sharp enough to read. Retake it closer so the main 978 or 979 barcode fills the frame, or type the 13 digits.",
        );
      }
    } catch {
      setError(
        "The photo could not be read. Retake it closer, or type the 13 digits printed above the barcode.",
      );
    } finally {
      setPhotoScanning(false);
    }
  }

  useEffect(() => {
    if (!scanning || !videoRef.current) return;
    let active = true;
    let nativeScanTimer: ReturnType<typeof setInterval> | null = null;
    let guidanceTimer: ReturnType<typeof setTimeout> | null = null;
    let nativeScanBusy = false;
    let scannerControls: IScannerControls | null = null;
    let cameraTrack: MediaStreamTrack | null = null;
    const reader = createIsbnReader();

    setScannerStatus("Starting rear camera…");
    setTorchAvailable(false);
    setTorchOn(false);
    guidanceTimer = setTimeout(() => {
      if (active && !scanAcceptedRef.current) {
        setScannerStatus(
          "Move closer—the main barcode should nearly fill the green box.",
        );
      }
    }, 5500);

    reader
      .decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
        },
        videoRef.current,
        (decoded, scanError, controls) => {
          scannerControls = controls;
          controlsRef.current = controls;
          if (!active) return;
          if (
            scanError?.name &&
            !["NotFoundException", "ChecksumException", "FormatException"].includes(
              scanError.name,
            )
          ) {
            setError(
              "The camera stopped reading. Close it and try again, take a barcode photo, or type the ISBN.",
            );
          }
          if (decoded) acceptBarcode(decoded.getText(), controls);
        },
      )
      .then(async (controls) => {
        scannerControls = controls;
        controlsRef.current = controls;
        if (!active || !videoRef.current) return;

        const stream = videoRef.current.srcObject as MediaStream | null;
        cameraTrack = stream?.getVideoTracks()[0] ?? null;
        if (cameraTrack) {
          cameraTrackRef.current = cameraTrack;
          const optimisation = await optimiseCameraTrack(cameraTrack);
          if (!active) return;
          setTorchAvailable(optimisation.torchAvailable);
          setScannerStatus(
            optimisation.zoomed
              ? "Camera ready—automatic close-up is on. Fill the green box."
              : "Camera ready. Fill the green box with the main 978 or 979 barcode.",
          );
        } else {
          setScannerStatus(
            "Camera ready. Fill the green box with the main 978 or 979 barcode.",
          );
        }

        const Detector = nativeBarcodeDetector();
        if (!Detector || !(await supportsNativeEan13(Detector)) || !active) {
          return;
        }
        try {
          const detector = new Detector({ formats: ["ean_13"] });
          nativeScanTimer = setInterval(async () => {
            const video = videoRef.current;
            if (
              !active ||
              scanAcceptedRef.current ||
              nativeScanBusy ||
              !video ||
              video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
            ) {
              return;
            }

            nativeScanBusy = true;
            try {
              const detected = await detector.detect(video);
              for (const barcode of detected) {
                if (acceptBarcode(barcode.rawValue, controls)) break;
              }
            } catch {
              // ZXing remains active when the native detector rejects a frame.
            } finally {
              nativeScanBusy = false;
            }
          }, 150);
        } catch {
          // Some browsers expose BarcodeDetector without EAN-13 support.
        }
      })
      .catch((cameraError: unknown) => {
        if (!active) return;
        setScanning(false);
        setScannerStatus("Camera unavailable");
        const errorName =
          cameraError instanceof DOMException ? cameraError.name : "";
        setError(
          errorName === "NotAllowedError"
            ? "Camera permission was declined. Allow camera access in your browser settings, then try again."
            : errorName === "NotReadableError"
              ? "The camera is already in use by another app or browser tab. Close it there, then try again."
              : errorName === "NotFoundError"
                ? "No camera was found on this device. Enter the ISBN printed above the barcode."
                : "Camera access is unavailable. Enter the ISBN printed above the barcode.",
        );
      });

    return () => {
      active = false;
      if (nativeScanTimer) clearInterval(nativeScanTimer);
      if (guidanceTimer) clearTimeout(guidanceTimer);
      scannerControls?.stop();
      if (controlsRef.current === scannerControls) controlsRef.current = null;
      if (cameraTrackRef.current === cameraTrack) cameraTrackRef.current = null;
      setTorchAvailable(false);
      setTorchOn(false);
    };
  }, [acceptBarcode, scanning]);

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
    scanAcceptedRef.current = false;
    setScannerStatus("Starting rear camera…");
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

  async function toggleTorch() {
    const track = cameraTrackRef.current;
    if (!track) return;
    const nextTorchState = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [
          {
            torch: nextTorchState,
          } as ExtendedMediaTrackConstraintSet,
        ],
      });
      setTorchOn(nextTorchState);
      setScannerStatus(
        nextTorchState
          ? "Light on. Fill the green box with the main barcode."
          : "Light off. Fill the green box with the main barcode.",
      );
    } catch {
      setTorchAvailable(false);
      setScannerStatus("This camera does not allow its light to be controlled.");
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void processStock(isbn);
  }

  function submitManual(event: FormEvent) {
    event.preventDefault();
    void processStock(isbn, {
      title: manualTitle,
      author: manualAuthor,
      coverUrl: manualCoverUrl,
    });
  }

  async function removeInventoryItem(
    inventoryId: number,
    action: "sold" | "remove",
  ) {
    setRemoving({ inventoryId, action });
    setInventoryError("");
    try {
      const response = await fetch("/api/shop-inventory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryId, action }),
      });
      const data = (await response.json()) as {
        action?: InventoryOutcome;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not update this book.");
      }
      const book =
        inventory.find((item) => item.inventoryId === inventoryId) ?? null;
      if (book && data.action) {
        setLastRemoved({ book, outcome: data.action });
      }
      setInventory((current) =>
        current.filter((book) => book.inventoryId !== inventoryId),
      );
    } catch (removeError) {
      setInventoryError(
        removeError instanceof Error
          ? removeError.message
          : "Could not update this book.",
      );
    } finally {
      setRemoving(null);
    }
  }

  async function undoRemoval() {
    if (!lastRemoved) return;
    setInventoryError("");
    try {
      const response = await fetch("/api/shop-inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryId: lastRemoved.book.inventoryId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not undo that removal.");
      }
      setLastRemoved(null);
      await refreshInventory();
    } catch (restoreError) {
      setInventoryError(
        restoreError instanceof Error
          ? restoreError.message
          : "Could not undo that removal.",
      );
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setAccountSaving(true);
    setAccountError("");
    setAccountMessage("");
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not change your password.");
      }
      setCurrentPassword("");
      setNewPassword("");
      setAccountMessage("Password changed. Other signed-in devices were logged out.");
    } catch (passwordError) {
      setAccountError(
        passwordError instanceof Error
          ? passwordError.message
          : "Could not change your password.",
      );
    } finally {
      setAccountSaving(false);
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
          <h1>Scan in. Mark sold in one tap.</h1>
          <p>
            Use Sold for a purchase so it counts as a sale. Use Remove for
            transfers, damage or any other non-sale reason.
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
          <button
            className={mode === "account" ? "active" : ""}
            onClick={() => changeMode("account")}
            type="button"
          >
            <span>○</span>
            <div>
              <strong>Account</strong>
              <small>Password and access</small>
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
              {mode === "add"
                ? "Stock in"
                : mode === "inventory"
                  ? "Current stock"
                  : "Staff account"}
            </p>
            <h2>
              {mode === "add"
                ? "Add a book"
                : mode === "inventory"
                  ? "Shop inventory"
                  : username}
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
            {(role === "admin" || role === "manager") && (
              <Link className="manage-link" href="/admin">
                Manage
              </Link>
            )}
          </div>
        </div>

        {mode === "account" ? (
          <div className="account-view">
            <div className="account-summary">
              <span>{role}</span>
              <div>
                <strong>{username}</strong>
                <p>Assigned to {shop.name}</p>
              </div>
            </div>
            <form onSubmit={changePassword}>
              <label className="form-field">
                <span>Current password</span>
                <input
                  autoComplete="current-password"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                  type="password"
                  value={currentPassword}
                />
              </label>
              <label className="form-field">
                <span>New password</span>
                <input
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  type="password"
                  value={newPassword}
                />
                <small>Use at least 10 characters.</small>
              </label>
              {accountError && (
                <p className="form-error" role="alert">{accountError}</p>
              )}
              {accountMessage && (
                <p className="form-success" role="status">{accountMessage}</p>
              )}
              <button
                className="primary-action"
                disabled={accountSaving}
                type="submit"
              >
                {accountSaving ? "Saving…" : "Change password"}
              </button>
            </form>
          </div>
        ) : mode === "inventory" ? (
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
            {lastRemoved && (
              <div className="undo-banner" role="status">
                <span>
                  {lastRemoved.book.title} was{" "}
                  {lastRemoved.outcome === "sold"
                    ? "marked as sold."
                    : "removed without recording a sale."}
                </span>
                <button onClick={undoRemoval} type="button">Undo</button>
              </div>
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
                    <div className="inventory-row-actions">
                      <button
                        className="sold-book-button"
                        disabled={removing?.inventoryId === book.inventoryId}
                        onClick={() =>
                          removeInventoryItem(book.inventoryId, "sold")
                        }
                        aria-label={`Mark ${book.title} as sold`}
                        type="button"
                      >
                        {removing?.inventoryId === book.inventoryId &&
                        removing.action === "sold"
                          ? "Saving…"
                          : "Sold"}
                      </button>
                      <button
                        className="remove-book-button"
                        disabled={removing?.inventoryId === book.inventoryId}
                        onClick={() =>
                          removeInventoryItem(book.inventoryId, "remove")
                        }
                        aria-label={`Remove ${book.title} without recording a sale`}
                        type="button"
                      >
                        {removing?.inventoryId === book.inventoryId &&
                        removing.action === "remove"
                          ? "Removing…"
                          : "Remove"}
                      </button>
                    </div>
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
              disabled={submitting || photoScanning}
              type="button"
              onClick={startScanner}
            >
              <span><ScanIcon /></span>
              <strong>Scan book in</strong>
              <small>
                The book and its cover are added as soon as the barcode is read
              </small>
            </button>

            <label
              className={`photo-scan-button${photoScanning ? " disabled" : ""}`}
            >
              <input
                accept="image/*"
                capture="environment"
                className="sr-only"
                disabled={submitting || photoScanning}
                onChange={scanBarcodePhoto}
                type="file"
              />
              <span>
                {photoScanning ? "Reading barcode photo…" : "Take a barcode photo"}
              </span>
              <small>Use this if live scanning does not read within a few seconds</small>
            </label>

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

            <button
              className="text-action"
              onClick={() => {
                setManualEntry((current) => !current);
                setError("");
              }}
              type="button"
            >
              {manualEntry
                ? "Use automatic book lookup"
                : "Book not found? Enter its details manually"}
            </button>
          </form>
        )}
      </section>

      {mode === "add" && manualEntry && !result && (
        <div className="manual-entry-panel">
          <form onSubmit={submitManual}>
            <div>
              <p className="kicker">Manual fallback</p>
              <h2>Add verified book details</h2>
              <p>Use this only when automatic ISBN lookup cannot find the edition.</p>
            </div>
            <label className="form-field">
              <span>Title</span>
              <input
                onChange={(event) => setManualTitle(event.target.value)}
                required
                value={manualTitle}
              />
            </label>
            <label className="form-field">
              <span>Author</span>
              <input
                onChange={(event) => setManualAuthor(event.target.value)}
                required
                value={manualAuthor}
              />
            </label>
            <label className="form-field">
              <span>Cover image URL (optional)</span>
              <input
                inputMode="url"
                onChange={(event) => setManualCoverUrl(event.target.value)}
                placeholder="https://…"
                type="url"
                value={manualCoverUrl}
              />
              <small>A Giveleaf book cover is used if this is left blank.</small>
            </label>
            <button
              className="primary-action"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Adding…" : "Add verified book"}
            </button>
          </form>
        </div>
      )}

      {scanning && (
        <div
          className="scanner-overlay"
          data-scanner-engine={SCANNER_ENGINE}
          role="dialog"
          aria-modal="true"
          aria-label="ISBN scanner"
        >
          <div className="scanner-panel">
            <div className="scanner-top">
              <div>
                <p className="kicker">Stock in</p>
                <h2>Fill the frame with the main barcode</h2>
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
              <video ref={videoRef} autoPlay muted playsInline />
              <div className="scan-frame">
                <span />
                <b>978 / 979 ISBN</b>
              </div>
            </div>
            <div className="scanner-status" role="status" aria-live="polite">
              <i aria-hidden="true" />
              {scannerStatus}
            </div>
            <div className="scanner-actions">
              {torchAvailable && (
                <button type="button" onClick={toggleTorch}>
                  {torchOn ? "Turn light off" : "Turn light on"}
                </button>
              )}
              <button type="button" onClick={() => setScanning(false)}>
                Use barcode photo instead
              </button>
            </div>
            <p>
              Move close enough for the long barcode beginning 978 or 979 to
              nearly touch both sides of the green box. Ignore the smaller
              five-digit price barcode beside it.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
