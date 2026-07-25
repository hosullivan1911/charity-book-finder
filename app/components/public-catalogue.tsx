"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  BookRecommendation,
  InventoryBook,
  Shop,
} from "../../lib/types";
import { ArrowIcon, BookIcon, PinIcon, SearchIcon, ShopIcon } from "./icons";

type UserLocation = {
  displayName: string;
  latitude: number;
  longitude: number;
};

function distanceInKilometres(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    earthRadiusKm *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function BookCard({
  book,
  recommendation,
  onSelect,
}: {
  book: InventoryBook;
  recommendation?: BookRecommendation;
  onSelect: (book: InventoryBook) => void;
}) {
  return (
    <button
      className={recommendation ? "book-card recommendation-card" : "book-card"}
      onClick={() => onSelect(book)}
      type="button"
    >
      <div className="cover-wrap">
        {/* External covers intentionally use a normal img; ISBN cover hosts are dynamic. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={book.coverUrl || "/book-placeholder.svg"}
          alt=""
          onError={(event) => {
            event.currentTarget.src = "/book-placeholder.svg";
          }}
        />
        {recommendation && <span className="ai-match">Smart alternative</span>}
      </div>
      <div className="book-copy">
        <p className="book-format">{book.format}</p>
        <h3>{book.title}</h3>
        <p className="author">{book.author}</p>
        {recommendation && (
          <p className="recommendation-reason">{recommendation.reason}</p>
        )}
        <div className="book-location">
          <PinIcon />
          <span>
            <strong>{book.shop.name}</strong>
            {book.shop.address}
          </span>
        </div>
      </div>
    </button>
  );
}

export function PublicCatalogue() {
  const [query, setQuery] = useState("");
  const [shop, setShop] = useState("all");
  const [address, setAddress] = useState("");
  const [radiusKm, setRadiusKm] = useState(25);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [inventory, setInventory] = useState<InventoryBook[]>([]);
  const [participatingShops, setParticipatingShops] = useState<Shop[]>([]);
  const [selected, setSelected] = useState<InventoryBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [inventoryUnavailable, setInventoryUnavailable] = useState(false);
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [recommendations, setRecommendations] = useState<
    BookRecommendation[]
  >([]);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState("");
  const [interpretedAs, setInterpretedAs] = useState<{
    title: string;
    author: string | null;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function refreshInventory() {
      try {
        const [inventoryResponse, shopsResponse] = await Promise.all([
          fetch("/api/inventory", {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch("/api/shops", {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);
        const data = (await inventoryResponse.json()) as {
          inventory?: InventoryBook[];
        };
        const shopData = (await shopsResponse.json()) as { shops?: Shop[] };
        if (!inventoryResponse.ok || !shopsResponse.ok) {
          throw new Error("Live inventory is unavailable.");
        }
        if (Array.isArray(data.inventory)) setInventory(data.inventory);
        if (Array.isArray(shopData.shops)) {
          setParticipatingShops(shopData.shops);
        }
        setInventoryUnavailable(false);
      } catch {
        if (!controller.signal.aborted) setInventoryUnavailable(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void refreshInventory();
    const refreshTimer = window.setInterval(refreshInventory, 15_000);
    return () => {
      controller.abort();
      window.clearInterval(refreshTimer);
    };
  }, []);

  const shopsWithDistance = useMemo(
    () =>
      participatingShops.map((item) => {
        const hasCoordinates =
          typeof item.latitude === "number" &&
          typeof item.longitude === "number";
        const distance =
          userLocation && hasCoordinates
            ? distanceInKilometres(userLocation, {
                latitude: item.latitude as number,
                longitude: item.longitude as number,
              })
            : null;
        return { shop: item, distance };
      }),
    [participatingShops, userLocation],
  );

  const nearbyShops = useMemo(
    () =>
      shopsWithDistance.filter(
        (item) =>
          !userLocation ||
          (typeof item.distance === "number" && item.distance <= radiusKm),
      ),
    [radiusKm, shopsWithDistance, userLocation],
  );

  const nearbyShopSlugs = useMemo(
    () => new Set(nearbyShops.map((item) => item.shop.slug)),
    [nearbyShops],
  );

  const availablePool = useMemo(
    () =>
      inventory.filter(
        (book) =>
          nearbyShopSlugs.has(book.shop.slug) &&
          (shop === "all" || book.shop.slug === shop),
      ),
    [inventory, nearbyShopSlugs, shop],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return availablePool.filter(
      (book) =>
        !needle ||
        `${book.title} ${book.author} ${book.isbn13} ${book.subjects.join(" ")}`
          .toLowerCase()
          .includes(needle),
    );
  }, [availablePool, query]);

  const recommendedBooks = useMemo(
    () =>
      recommendations
        .map((recommendation) => {
          const book = availablePool.find(
            (item) => item.inventoryId === recommendation.inventoryId,
          );
          return book ? { book, recommendation } : null;
        })
        .filter(
          (
            item,
          ): item is {
            book: InventoryBook;
            recommendation: BookRecommendation;
          } => Boolean(item),
        ),
    [availablePool, recommendations],
  );

  async function findNearbyShops(event: FormEvent) {
    event.preventDefault();
    const cleanAddress = address.trim();
    if (!cleanAddress) {
      setLocationError("Enter an Australian address, suburb or postcode.");
      return;
    }

    setLocationLoading(true);
    setLocationError("");
    try {
      const response = await fetch(
        `/api/geocode?address=${encodeURIComponent(cleanAddress)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as UserLocation & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not find that address.");
      }
      setUserLocation(data);
      setShop("all");
      setSearchSubmitted(false);
      setRecommendations([]);
      setInterpretedAs(null);
    } catch (error) {
      setLocationError(
        error instanceof Error ? error.message : "Could not find that address.",
      );
    } finally {
      setLocationLoading(false);
    }
  }

  async function searchBooks(event: FormEvent) {
    event.preventDefault();
    const cleanQuery = query.trim();
    setSearchSubmitted(true);
    setRecommendations([]);
    setRecommendationError("");
    setInterpretedAs(null);

    if (!cleanQuery || filtered.length) return;
    if (!availablePool.length) return;

    setRecommendationLoading(true);
    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: cleanQuery,
          candidates: availablePool,
        }),
      });
      const data = (await response.json()) as {
        recommendations?: BookRecommendation[];
        interpretedAs?: { title: string; author: string | null } | null;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not generate alternatives.");
      }
      setRecommendations(
        Array.isArray(data.recommendations) ? data.recommendations : [],
      );
      setInterpretedAs(data.interpretedAs ?? null);
    } catch (error) {
      setRecommendationError(
        error instanceof Error
          ? error.message
          : "Could not generate alternatives.",
      );
    } finally {
      setRecommendationLoading(false);
    }
  }

  function clearLocation() {
    setUserLocation(null);
    setAddress("");
    setShop("all");
    setSearchSubmitted(false);
    setRecommendations([]);
    setLocationError("");
  }

  function updateQuery(value: string) {
    setQuery(value);
    setSearchSubmitted(false);
    setRecommendations([]);
    setRecommendationError("");
    setInterpretedAs(null);
  }

  function clearBookSearch() {
    setQuery("");
    setShop("all");
    setSearchSubmitted(false);
    setRecommendations([]);
    setRecommendationError("");
    setInterpretedAs(null);
  }

  const resultDescription = userLocation
    ? `${nearbyShops.length} shop${nearbyShops.length === 1 ? "" : "s"} within ${radiusKm} km`
    : participatingShops.length
      ? `${participatingShops.length} participating location${participatingShops.length === 1 ? "" : "s"}`
      : "No participating locations yet";

  return (
    <>
      <section className="hero">
        <div className="eyebrow">
          <span />
          Live charity-shop inventory
        </div>
        <h1>Books, where they<br />actually are.</h1>
        <p>
          Tell us where you are, choose how far you would travel, then search
          the live shelves of nearby charity shops.
        </p>

        <form className="location-panel" onSubmit={findNearbyShops}>
          <label className="address-field">
            <PinIcon />
            <span className="sr-only">Your address, suburb or postcode</span>
            <input
              autoComplete="street-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Address, suburb or postcode"
            />
          </label>
          <label className="radius-select">
            <span className="sr-only">Search radius</span>
            <select
              value={radiusKm}
              onChange={(event) => {
                setRadiusKm(Number(event.target.value));
                setShop("all");
                setSearchSubmitted(false);
                setRecommendations([]);
              }}
            >
              <option value={5}>Within 5 km</option>
              <option value={10}>Within 10 km</option>
              <option value={25}>Within 25 km</option>
              <option value={50}>Within 50 km</option>
              <option value={100}>Within 100 km</option>
            </select>
          </label>
          <button
            className="location-button"
            disabled={locationLoading}
            type="submit"
          >
            {locationLoading ? "Finding…" : "Find shops"}
            <ArrowIcon />
          </button>
        </form>

        {locationError && (
          <p className="location-error" role="alert">{locationError}</p>
        )}
        {userLocation && (
          <div className="location-summary" role="status">
            <span>
              <PinIcon />
              {resultDescription} near {userLocation.displayName}
            </span>
            <button onClick={clearLocation} type="button">Clear</button>
          </div>
        )}

        <form className="search-panel book-search-panel" onSubmit={searchBooks}>
          <label className="search-field">
            <SearchIcon />
            <span className="sr-only">Search by title, author or ISBN</span>
            <input
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder="Which book are you looking for?"
            />
          </label>
          <label className="shop-select">
            <ShopIcon />
            <span className="sr-only">Choose a charity shop</span>
            <select
              value={shop}
              onChange={(event) => {
                setShop(event.target.value);
                setSearchSubmitted(false);
                setRecommendations([]);
              }}
            >
              <option value="all">All nearby shops</option>
              {nearbyShops.map((item) => (
                <option key={item.shop.id} value={item.shop.slug}>
                  {item.shop.name}
                </option>
              ))}
            </select>
          </label>
          <button className="search-button" type="submit">
            Search
            <ArrowIcon />
          </button>
        </form>

        <div className="hero-meta" aria-label="Platform summary">
          <span><BookIcon /> {availablePool.length} nearby books</span>
          <span><ShopIcon /> {resultDescription}</span>
          <span>Syncs every 15 seconds</span>
        </div>
      </section>

      <section className="catalogue-section" id="books">
        {inventoryUnavailable && (
          <p className="catalogue-notice" role="status">
            Live inventory is temporarily unavailable. Please try again shortly.
          </p>
        )}
        <div className="section-heading">
          <div>
            <p className="kicker">
              {query || shop !== "all" || userLocation
                ? "Your search"
                : "Live inventory"}
            </p>
            <h2>
              {loading
                ? "Checking shelves…"
                : `${filtered.length} available now`}
            </h2>
          </div>
          <p>Availability reflects the latest shop scan.</p>
        </div>

        {filtered.length ? (
          <div className="book-grid">
            {filtered.map((book) => (
              <BookCard
                book={book}
                key={book.inventoryId}
                onSelect={setSelected}
              />
            ))}
          </div>
        ) : searchSubmitted && query.trim() ? (
          <div className="alternatives-state">
            <div className="alternatives-intro">
              <span className="ai-symbol">↗</span>
              <div>
                <p className="kicker">Smart alternatives</p>
                <h3>That exact book is not on a nearby shelf.</h3>
                <p>
                  {recommendationLoading
                    ? "Reading the catalogue to find the closest in-stock alternatives…"
                    : interpretedAs
                      ? `We understood your search as “${interpretedAs.title}”${interpretedAs.author ? ` by ${interpretedAs.author}` : ""} and compared it with available books.`
                      : "We compared your search with books that are available nearby."}
                </p>
              </div>
            </div>

            {recommendationError && (
              <p className="catalogue-notice" role="alert">
                {recommendationError}
              </p>
            )}

            {recommendedBooks.length ? (
              <div className="book-grid recommendations-grid">
                {recommendedBooks.map(({ book, recommendation }) => (
                  <BookCard
                    book={book}
                    key={book.inventoryId}
                    onSelect={setSelected}
                    recommendation={recommendation}
                  />
                ))}
              </div>
            ) : !recommendationLoading ? (
              <div className="no-alternatives">
                <p>
                  There are no suitable alternatives in the selected area yet.
                </p>
                <button type="button" onClick={clearBookSearch}>
                  Browse all nearby books
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="empty-state">
            <BookIcon />
            <h3>
              {userLocation && !nearbyShops.length
                ? "No participating shops in this area yet"
                : "No books are currently listed here"}
            </h3>
            <p>
              {userLocation && !nearbyShops.length
                ? "Try a wider distance while Giveleaf adds more charity shops."
                : "Try another shop or clear your location search."}
            </p>
            <button type="button" onClick={clearBookSearch}>
              Clear book search
            </button>
          </div>
        )}
      </section>

      <section className="shop-strip">
        <div>
          <p className="kicker">Locations</p>
          <h2>
            {userLocation ? "Shops near you" : "Participating shops"}
          </h2>
        </div>
        <div className="shop-list">
          {nearbyShops.length ? (
            nearbyShops.map(({ shop: item, distance }) => (
              <article key={item.id}>
                <span className="shop-icon"><ShopIcon /></span>
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.address}, {item.postcode}</p>
                  <small>{item.openingHours}</small>
                </div>
                <span className="distance">
                  {typeof distance === "number"
                    ? `${distance < 10 ? distance.toFixed(1) : Math.round(distance)} km`
                    : "Participating"}
                </span>
              </article>
            ))
          ) : (
            <div className="shops-empty">
              <p>No participating shops fall within this distance yet.</p>
              <button
                onClick={() => {
                  setRadiusKm(100);
                  setShop("all");
                }}
                type="button"
              >
                Expand to 100 km
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="mission-section" aria-labelledby="mission-heading">
        <p className="kicker">Our mission</p>
        <div>
          <h2 id="mission-heading">
            Make every donated book easier to find.
          </h2>
          <p>
            Giveleaf helps more people access affordable reading, support local
            charities and keep good books in circulation.
          </p>
        </div>
      </section>

      <footer>
        <div className="brand footer-brand">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>giveleaf</span>
        </div>
        <p>Find good books. Do a little good.</p>
      </footer>

      {selected && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setSelected(null);
          }}
        >
          <section
            className="book-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="book-title"
          >
            <button
              className="close-button"
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              ×
            </button>
            <div className="modal-book">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected.coverUrl || "/book-placeholder.svg"}
                alt=""
                onError={(event) => {
                  event.currentTarget.src = "/book-placeholder.svg";
                }}
              />
              <div>
                <p className="book-format">
                  {selected.format}
                </p>
                <h2 id="book-title">{selected.title}</h2>
                <p className="modal-author">{selected.author}</p>
              </div>
            </div>
            <div className="collection-card">
              <PinIcon />
              <div>
                <strong>Find it at {selected.shop.name}</strong>
                <span>
                  {selected.shop.address}, {selected.shop.postcode}
                </span>
              </div>
            </div>
            <p className="reservation-note">
              This book is currently listed as available. Reservations are not
              yet available.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
