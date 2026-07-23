"use client";

import type { IScannerControls } from "@zxing/browser";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { FormEvent, useEffect, useRef, useState } from "react";
import type {
  BookCondition,
  BookMetadata,
  Shop,
  Valuation,
} from "../../lib/types";
import { BookIcon, ScanIcon, ShopIcon } from "./icons";

type IntakeResult = {
  book: BookMetadata;
  valuation: Valuation;
  inventoryId: number;
  demo?: boolean;
};

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(cents / 100);
}

export function StaffScanner({ shop }: { shop: Shop }) {
  const [isbn, setIsbn] = useState("9780571364909");
  const [location, setLocation] = useState("Fiction · I–K · Shelf 3");
  const [condition, setCondition] = useState<BookCondition>("good");
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<IntakeResult | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

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
          }
          if (scanError?.name && scanError.name !== "NotFoundException") {
            setError("The camera could not read that barcode. Try the number instead.");
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
  }, [scanning]);

  function startScanner() {
    setError("");
    if (!window.isSecureContext) {
      setError("The camera requires HTTPS. Open the Vercel URL, or enter the ISBN manually.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support camera scanning. Enter the ISBN manually.");
      return;
    }
    setScanning(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isbn,
          shelfLocation: location,
          condition,
        }),
      });
      const data = (await response.json()) as IntakeResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not add this book.");
      setResult(data);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Could not add this book.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setResult(null);
    setIsbn("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <div className="staff-shell">
      <aside className="staff-aside">
        <div>
          <p className="kicker">Volunteer tools</p>
          <h1>Put a donated book on the shelf in under 30 seconds.</h1>
          <p>
            Scan its ISBN, check the suggested charity-shop price, then tell
            customers exactly where to find it.
          </p>
        </div>
        <ol className="step-list">
          <li className="current"><span>1</span><div><strong>Identify</strong><small>Scan or enter ISBN</small></div></li>
          <li className={result ? "current" : ""}><span>2</span><div><strong>Value</strong><small>Automatic shop price</small></div></li>
          <li className={result ? "current" : ""}><span>3</span><div><strong>Locate</strong><small>Add shelf position</small></div></li>
        </ol>
        <div className="aside-tip">
          <BookIcon />
          <p><strong>Potentially valuable?</strong> Signed, first-edition and pre-1970 books are always flagged for a person to review.</p>
        </div>
      </aside>

      <section className="intake-card">
        {!result ? (
          <form onSubmit={submit}>
            <div className="intake-heading">
              <div>
                <p className="kicker">New donation</p>
                <h2>Scan a book</h2>
              </div>
              <div className="shop-session">
                <span className="shop-badge"><ShopIcon /> {shop.name}</span>
                <button className="sign-out-button" onClick={signOut} type="button">
                  Sign out
                </button>
              </div>
            </div>

            <button
              className="camera-button"
              type="button"
              onClick={startScanner}
            >
              <span><ScanIcon /></span>
              <strong>Open camera scanner</strong>
              <small>Point at the barcode on the back cover</small>
            </button>

            <div className="form-divider"><span>or type the number</span></div>

            <label className="form-field">
              <span>ISBN-13</span>
              <input
                inputMode="numeric"
                pattern="[0-9]{13}"
                maxLength={13}
                value={isbn}
                onChange={(event) => setIsbn(event.target.value.replace(/\D/g, ""))}
                placeholder="9780000000000"
                required
              />
              <small>The 13 digits printed above the barcode</small>
            </label>

            <div className="form-row">
              <label className="form-field">
                <span>Condition</span>
                <select value={condition} onChange={(event) => setCondition(event.target.value as BookCondition)}>
                  <option value="like_new">Like new</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair / worn</option>
                </select>
              </label>
            </div>

            <label className="form-field">
              <span>Shelf location</span>
              <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Fiction · A–D · Shelf 2" required />
              <small>Use the wording a customer or new volunteer can follow.</small>
            </label>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button className="primary-action" type="submit" disabled={submitting}>
              {submitting ? "Looking up and valuing…" : "Value and add to shop"}
            </button>
          </form>
        ) : (
          <div className="result-view">
            <div className="success-mark">✓</div>
            <p className="kicker">Added to the shelf</p>
            <h2>{result.book.title}</h2>
            <p className="result-author">{result.book.author}</p>

            <div className="result-book">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.book.coverUrl || "/book-placeholder.svg"}
                alt=""
                onError={(event) => {
                  event.currentTarget.src = "/book-placeholder.svg";
                }}
              />
              <div className="valuation-panel">
                <span>Suggested charity price</span>
                <strong>{formatPrice(result.valuation.pricePence)}</strong>
                <small className={`confidence ${result.valuation.confidence}`}>
                  {result.valuation.confidence} confidence
                </small>
                <ul>
                  {result.valuation.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              </div>
            </div>

            {result.valuation.manualReview && (
              <p className="review-warning">
                Hold this book aside for a manual value check before putting it on sale.
              </p>
            )}

            <div className="location-confirmation">
              <ShopIcon />
              <div>
                <span>Location saved</span>
                <strong>{location}</strong>
                <small>{shop.name}</small>
              </div>
            </div>

            <button className="primary-action" type="button" onClick={reset}>
              <ScanIcon /> Scan the next book
            </button>
            {result.demo && (
              <p className="demo-note">Prototype mode: this scan was valued but not permanently stored.</p>
            )}
          </div>
        )}
      </section>

      {scanning && (
        <div className="scanner-overlay" role="dialog" aria-modal="true" aria-label="ISBN scanner">
          <div className="scanner-panel">
            <div className="scanner-top">
              <div><p className="kicker">Camera scanner</p><h2>Centre the ISBN barcode</h2></div>
              <button type="button" onClick={() => setScanning(false)} aria-label="Close camera">×</button>
            </div>
            <div className="video-wrap">
              <video ref={videoRef} muted playsInline />
              <div className="scan-frame"><span /></div>
            </div>
            <p>Hold still about 15 cm from the back cover. Scanning stops automatically.</p>
          </div>
        </div>
      )}
    </div>
  );
}
