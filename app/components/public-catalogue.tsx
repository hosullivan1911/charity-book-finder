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
    fetch("/api/inventory", { signal: controller.signal })
      .then((response) => response.json())
      .then((data: { inventory?: InventoryBook[] }) => {
        if (data.inventory?.length) setInventory(data.inventory);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => controller.abort();
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
          Books with another chapter
        </div>
        <h1>Find a good book.<br />Do a little good.</h1>
        <p>
          Search the shelves of local charity shops before you visit. Every
          purchase supports a cause and keeps a book in circulation.
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
              <option value="all">All nearby shops</option>
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
          <span><BookIcon /> {inventory.length || 6} books listed</span>
          <span><ShopIcon /> {masterShops.length} participating shops</span>
          <span>Updated by shop volunteers</span>
        </div>
      </section>

      <section className="catalogue-section" id="books">
        <div className="section-heading">
          <div>
            <p className="kicker">{query || shop !== "all" ? "Search results" : "New on the shelves"}</p>
            <h2>
              {loading ? "Checking local shelves…" : `${filtered.length} books ready to find`}
            </h2>
          </div>
          <p>Stock moves quickly — call ahead if you’re making a special trip.</p>
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
            <h3>No exact match on the shelves today</h3>
            <p>Try an author surname, a shorter title, or search all shops.</p>
            <button type="button" onClick={() => { setQuery(""); setShop("all"); }}>
              Clear search
            </button>
          </div>
        )}
      </section>

      <section className="shop-strip">
        <div>
          <p className="kicker">Browse in person</p>
          <h2>Meet the shops</h2>
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
          <span className="brand-mark"><BookIcon /></span>
          <span>goodfind</span>
        </div>
        <p>A practical prototype for charity shops and book lovers.</p>
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
              Online reservation is the next MVP step. For now, ask a volunteer
              for the shelf location shown above.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
