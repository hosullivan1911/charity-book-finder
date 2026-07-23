"use client";

import { useEffect, useMemo, useState } from "react";
import { masterShops } from "../../config/shops";
import { demoInventory } from "../../lib/demo-data";
import type { InventoryBook } from "../../lib/types";
import { ArrowIcon, BookIcon, PinIcon, SearchIcon, ShopIcon } from "./icons";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(cents / 100);
}

export function PublicCatalogue() {
  const [query, setQuery] = useState("");
  const [shop, setShop] = useState("all");
  const [inventory, setInventory] = useState<InventoryBook[]>(demoInventory);
  const [selected, setSelected] = useState<InventoryBook | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function refreshInventory() {
      try {
        const response = await fetch("/api/inventory", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as { inventory?: InventoryBook[] };
        if (Array.isArray(data.inventory)) setInventory(data.inventory);
      } catch {
        // Keep the last successful inventory while temporarily offline.
      } finally {
        setLoading(false);
      }
    }

    void refreshInventory();
    const refreshTimer = window.setInterval(refreshInventory, 15_000);
    return () => {
      controller.abort();
      window.clearInterval(refreshTimer);
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return inventory.filter(
      (book) =>
        (shop === "all" || book.shop.slug === shop) &&
        (!needle ||
          `${book.title} ${book.author} ${book.isbn13}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [inventory, query, shop]);

  return (
    <>
      <section className="hero">
        <div className="eyebrow">
          <span />
          Live charity-shop inventory
        </div>
        <h1>Books, where they<br />actually are.</h1>
        <p>
          Search live shelves across participating shops. See the price,
          condition and exact location before you go.
        </p>

        <div className="search-panel">
          <label className="search-field">
            <SearchIcon />
            <span className="sr-only">Search by title, author or ISBN</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Title, author or ISBN"
            />
          </label>
          <label className="shop-select">
            <PinIcon />
            <span className="sr-only">Choose a charity shop</span>
            <select value={shop} onChange={(event) => setShop(event.target.value)}>
              <option value="all">All locations</option>
              {masterShops.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button className="search-button" type="button">
            Search
            <ArrowIcon />
          </button>
        </div>

        <div className="hero-meta" aria-label="Platform summary">
          <span><BookIcon /> {inventory.length} books listed</span>
          <span><ShopIcon /> {masterShops.length} locations</span>
          <span>Syncs every 15 seconds</span>
        </div>
      </section>

      <section className="catalogue-section" id="books">
        <div className="section-heading">
          <div>
            <p className="kicker">{query || shop !== "all" ? "Filtered inventory" : "Live inventory"}</p>
            <h2>
              {loading ? "Checking shelves…" : `${filtered.length} available now`}
            </h2>
          </div>
          <p>Availability reflects the latest shop scan.</p>
        </div>

        {filtered.length ? (
          <div className="book-grid">
            {filtered.map((book) => (
              <button
                className="book-card"
                key={book.inventoryId}
                onClick={() => setSelected(book)}
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
                  <span className="price-tag">{formatPrice(book.pricePence)}</span>
                </div>
                <div className="book-copy">
                  <p className="book-format">{book.format}</p>
                  <h3>{book.title}</h3>
                  <p className="author">{book.author}</p>
                  <div className="book-location">
                    <PinIcon />
                    <span>
                      <strong>{book.shop.name}</strong>
                      {book.shelfLocation}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <BookIcon />
            <h3>Nothing matched</h3>
            <p>Try a shorter title, an author surname or all locations.</p>
            <button type="button" onClick={() => { setQuery(""); setShop("all"); }}>
              Clear search
            </button>
          </div>
        )}
      </section>

      <section className="shop-strip">
        <div>
          <p className="kicker">Locations</p>
          <h2>Participating shops</h2>
        </div>
        <div className="shop-list">
          {masterShops.map((item) => (
            <article key={item.id}>
              <span className="shop-icon"><ShopIcon /></span>
              <div>
                <h3>{item.name}</h3>
                <p>{item.address}, {item.postcode}</p>
                <small>{item.openingHours}</small>
              </div>
              <span className="distance">{item.distance}</span>
            </article>
          ))}
        </div>
      </section>

      <footer>
        <div className="brand footer-brand">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>spine</span>
        </div>
        <p>Live local book inventory.</p>
      </footer>

      {selected && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setSelected(null);
          }}
        >
          <section className="book-modal" role="dialog" aria-modal="true" aria-labelledby="book-title">
            <button className="close-button" type="button" onClick={() => setSelected(null)} aria-label="Close">
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
                <p className="book-format">{selected.format} · {selected.condition.replace("_", " ")}</p>
                <h2 id="book-title">{selected.title}</h2>
                <p className="modal-author">{selected.author}</p>
                <p className="modal-price">{formatPrice(selected.pricePence)}</p>
              </div>
            </div>
            <div className="collection-card">
              <PinIcon />
              <div>
                <strong>Find it at {selected.shop.name}</strong>
                <span>{selected.shelfLocation}</span>
                <span>{selected.shop.address}, {selected.shop.postcode}</span>
              </div>
            </div>
            <p className="reservation-note">
              Ask a volunteer for the shelf location shown above. Reservations
              are not yet available.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
