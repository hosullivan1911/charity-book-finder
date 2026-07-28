"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Shop } from "../../lib/types";

type AdminTab =
  | "overview"
  | "shops"
  | "staff"
  | "invites"
  | "inventory"
  | "activity"
  | "account";

type OverviewData = {
  viewer: {
    id: number;
    username: string;
    role: string;
    shopId: number | null;
  };
  stats: {
    activeInventory: number;
    activeUsers: number;
    totalListings: number;
    sales: number;
    delistings: number;
    listingsLastSevenDays: number;
    lastListedAt: string | null;
    lastSoldAt: string | null;
    lastRemovedAt: string | null;
    participatingShops: number;
  };
  users: Array<{
    id: number;
    username: string;
    role: string;
    active: boolean;
    createdAt: string;
    shopId: number | null;
    shopSlug: string | null;
    shopName: string | null;
  }>;
  invites: Array<{
    id: number;
    role: string;
    expiresAt: string;
    maxUses: number;
    useCount: number;
    active: boolean;
    shopId: number;
    shopSlug: string;
    shopName: string;
  }>;
  inventory: Array<{
    id: number;
    status: string;
    scannedBy: string | null;
    scannedAt: string;
    removedBy: string | null;
    removalReason: string | null;
    soldAt: string | null;
    removedAt: string | null;
    isbn13: string;
    title: string;
    author: string;
    coverUrl: string | null;
    shopId: number;
    shopSlug: string;
    shopName: string;
  }>;
  activity: Array<{
    id: number;
    actorUsername: string | null;
    action: string;
    targetType: string;
    details: Record<string, unknown>;
    createdAt: string;
  }>;
  shops: Array<
    Shop & {
      active: boolean;
      createdAt: string;
    }
  >;
};

type CreatedInvite = {
  code: string;
  shopName: string;
  role: string;
  expiresAt: string;
  maxUses: number;
};

function readableAction(action: string) {
  return action.replaceAll(".", " ").replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminDashboard() {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inventoryStatus, setInventoryStatus] = useState<
    "all" | "available" | "sold" | "removed"
  >("all");
  const [inviteShop, setInviteShop] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");
  const [inviteUses, setInviteUses] = useState(1);
  const [inviteDays, setInviteDays] = useState(7);
  const [createdInvite, setCreatedInvite] = useState<CreatedInvite | null>(null);
  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPostcode, setShopPostcode] = useState("");
  const [shopHours, setShopHours] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (manualRefresh = false) => {
    setError("");
    if (manualRefresh) {
      setRefreshing(true);
      setNotice("");
    }
    try {
      const response = await fetch(
        `/api/admin/overview?refresh=${Date.now()}`,
        {
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        },
      );
      const body = (await response.json()) as OverviewData & { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "Could not load management data.");
      }
      setData(body);
      const activeShops = body.shops.filter((shop) => shop.active);
      if (body.viewer.role !== "admin") {
        const viewer = body.users.find((user) => user.id === body.viewer.id);
        if (viewer?.shopSlug) setInviteShop(viewer.shopSlug);
      } else {
        setInviteShop((current) =>
          activeShops.some((shop) => shop.slug === current)
            ? current
            : activeShops[0]?.slug ?? "",
        );
      }
      if (manualRefresh) {
        setNotice(`Dashboard refreshed at ${formatDate(new Date().toISOString())}.`);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load management data.",
      );
    } finally {
      setLoading(false);
      if (manualRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  async function request(
    url: string,
    method: "POST" | "PATCH" | "DELETE",
    body: Record<string, unknown>,
  ) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as {
        error?: string;
        invite?: CreatedInvite;
      };
      if (!response.ok) {
        throw new Error(result.error || "That change could not be saved.");
      }
      await load();
      return result;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "That change could not be saved.",
      );
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function createInvite(event: FormEvent) {
    event.preventDefault();
    const result = await request("/api/admin/invites", "POST", {
      shopSlug: inviteShop,
      role: inviteRole,
      maxUses: inviteUses,
      expiresInDays: inviteDays,
    });
    if (result?.invite) {
      setCreatedInvite(result.invite);
      setNotice("Invitation created. Copy it now; the code is shown only once.");
    }
  }

  async function createShop(event: FormEvent) {
    event.preventDefault();
    const result = await request("/api/admin/shops", "POST", {
      name: shopName,
      address: shopAddress,
      postcode: shopPostcode,
      openingHours: shopHours,
    });
    if (result) {
      setShopName("");
      setShopAddress("");
      setShopPostcode("");
      setShopHours("");
      setNotice(
        "Shop added. It is now available for manager invitations and public searches.",
      );
    }
  }

  async function editShop(shop: OverviewData["shops"][number]) {
    const name = window.prompt("Shop name:", shop.name);
    if (!name) return;
    const address = window.prompt(
      "Full street address, suburb and state:",
      shop.address,
    );
    if (!address) return;
    const postcode = window.prompt("Postcode:", shop.postcode);
    if (!postcode) return;
    const openingHours = window.prompt("Opening hours:", shop.openingHours);
    if (!openingHours) return;
    const result = await request("/api/admin/shops", "PATCH", {
      shopId: shop.id,
      name,
      address,
      postcode,
      openingHours,
    });
    if (result) setNotice(`${name} was updated.`);
  }

  async function toggleShop(shop: OverviewData["shops"][number]) {
    if (
      shop.active &&
      !window.confirm(
        `Archive ${shop.name}? It will disappear from public search, its invitations will close and its staff will be signed out.`,
      )
    ) {
      return;
    }
    const result = await request("/api/admin/shops", "PATCH", {
      shopId: shop.id,
      active: !shop.active,
    });
    if (result) {
      setNotice(
        shop.active
          ? `${shop.name} was archived.`
          : `${shop.name} is participating again.`,
      );
    }
  }

  async function toggleUser(user: OverviewData["users"][number]) {
    await request("/api/admin/users", "PATCH", {
      action: "set-active",
      userId: user.id,
      active: !user.active,
    });
  }

  async function resetPassword(user: OverviewData["users"][number]) {
    const temporaryPassword = window.prompt(
      `Set a temporary password for ${user.username} (at least 10 characters):`,
    );
    if (!temporaryPassword) return;
    const result = await request("/api/admin/users", "PATCH", {
      action: "reset-password",
      userId: user.id,
      temporaryPassword,
    });
    if (result) {
      setNotice(
        `${user.username}'s password was reset and all of their sessions were closed.`,
      );
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    const result = await request("/api/auth/change-password", "POST", {
      currentPassword,
      newPassword,
    });
    if (result) {
      setCurrentPassword("");
      setNewPassword("");
      setNotice(
        "Your password was changed. Other signed-in devices were logged out.",
      );
    }
  }

  async function updateUser(
    user: OverviewData["users"][number],
    role: string,
    shopSlug: string,
  ) {
    const result = await request("/api/admin/users", "PATCH", {
      action: "update",
      userId: user.id,
      role,
      shopSlug,
    });
    if (result) {
      setNotice(`${user.username}'s access was updated. They must sign in again.`);
    }
  }

  async function deleteUser(user: OverviewData["users"][number]) {
    if (
      !window.confirm(
        `Permanently delete ${user.username}? Their activity history will remain.`,
      )
    ) {
      return;
    }
    await request("/api/admin/users", "PATCH", {
      action: "delete",
      userId: user.id,
    });
  }

  async function editInventory(item: OverviewData["inventory"][number]) {
    const title = window.prompt("Book title:", item.title);
    if (!title) return;
    const author = window.prompt("Author:", item.author);
    if (!author) return;
    const coverUrl = window.prompt(
      "Cover image URL (leave blank to use the automatic cover):",
      item.coverUrl ?? "",
    );
    if (coverUrl === null) return;
    const result = await request("/api/admin/inventory", "PATCH", {
      action: "edit",
      inventoryId: item.id,
      title,
      author,
      coverUrl,
    });
    if (result) setNotice(`${title} was updated.`);
  }

  async function changeInventoryStatus(
    item: OverviewData["inventory"][number],
  ) {
    const action = item.status === "available" ? "remove" : "restore";
    const result = await request("/api/admin/inventory", "PATCH", {
      action,
      inventoryId: item.id,
      reason: action === "remove" ? "Removed from management dashboard" : "",
    });
    if (result) {
      setNotice(
        action === "remove"
          ? `${item.title} was removed from public inventory.`
          : `${item.title} was restored to public inventory.`,
      );
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/staff");
  }

  function exportInventory() {
    if (!data) return;
    const escape = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      [
        "ISBN",
        "Title",
        "Author",
        "Shop",
        "Status",
        "Listed by",
        "Listed at",
        "Sold at",
        "Removed at",
        "Completed by",
        "Removal reason",
      ],
      ...data.inventory.map((item) => [
        item.isbn13,
        item.title,
        item.author,
        item.shopName,
        item.status,
        item.scannedBy,
        item.scannedAt,
        item.soldAt,
        item.removedAt,
        item.removedBy,
        item.removalReason,
      ]),
    ];
    const csv = rows.map((row) => row.map(escape).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    link.download = `giveleaf-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const visibleInventory = useMemo(() => {
    if (!data) return [];
    const needle = inventoryQuery.trim().toLowerCase();
    return data.inventory.filter(
      (item) =>
        (inventoryStatus === "all" || item.status === inventoryStatus) &&
        (!needle ||
          `${item.title} ${item.author} ${item.isbn13} ${item.shopName}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [data, inventoryQuery, inventoryStatus]);

  if (loading) {
    return <div className="admin-loading">Preparing management tools…</div>;
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div>
          <p className="kicker">Giveleaf management</p>
          <h1>Keep every shelf accountable.</h1>
          <p>Manage staff access, invitations, inventory and the audit trail.</p>
        </div>
        <nav aria-label="Management sections">
          {(
            [
              ["overview", "Overview"],
              ...(data?.viewer.role === "admin"
                ? ([["shops", "Shops"]] as Array<[AdminTab, string]>)
                : []),
              ["staff", "Staff"],
              ["invites", "Invitations"],
              ["inventory", "Inventory"],
              ["activity", "Activity"],
              ["account", "Account"],
            ] as Array<[AdminTab, string]>
          ).map(([value, label]) => (
            <button
              className={tab === value ? "active" : ""}
              key={value}
              onClick={() => setTab(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>
        {data?.viewer.shopId && <Link href="/staff">← Return to scanner</Link>}
      </aside>

      <section className="admin-content">
        <header className="admin-heading">
          <div>
            <p className="kicker">{data?.viewer.role} access</p>
            <h2>
              {tab === "staff"
                ? "Staff accounts"
                : tab === "shops"
                  ? "Participating shops"
                  : tab}
            </h2>
          </div>
          <div className="table-actions">
            <button
              aria-busy={refreshing}
              disabled={refreshing}
              onClick={() => void load(true)}
              type="button"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            <button onClick={() => void signOut()} type="button">Log out</button>
          </div>
        </header>

        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-success" role="status">{notice}</p>}

        {tab === "overview" && data && (
          <>
            <div className="admin-stats">
              <article>
                <strong>{data.stats.activeInventory}</strong>
                <span>Books available</span>
                <small>Live inventory now</small>
              </article>
              <article>
                <strong>{data.stats.totalListings}</strong>
                <span>Total listings</span>
                <small>
                  {data.stats.lastListedAt
                    ? `Latest ${formatDate(data.stats.lastListedAt)}`
                    : "No listings yet"}
                </small>
              </article>
              <article>
                <strong>{data.stats.sales}</strong>
                <span>Sales</span>
                <small>
                  {data.stats.lastSoldAt
                    ? `Latest ${formatDate(data.stats.lastSoldAt)}`
                    : "No sales recorded"}
                </small>
              </article>
              <article>
                <strong>{data.stats.delistings}</strong>
                <span>Removed, not sold</span>
                <small>
                  {data.stats.lastRemovedAt
                    ? `Latest ${formatDate(data.stats.lastRemovedAt)}`
                    : "No removals recorded"}
                </small>
              </article>
              <article>
                <strong>{data.stats.activeUsers}</strong>
                <span>Active staff</span>
                <small>Can scan and update stock</small>
              </article>
              <article>
                <strong>{data.stats.participatingShops}</strong>
                <span>Participating shops</span>
                <small>{data.stats.listingsLastSevenDays} listings in 7 days</small>
              </article>
            </div>
            <div className="admin-callout">
              <div>
                <p className="kicker">Launch controls</p>
                <h3>Registration is invitation-only.</h3>
                <p>
                  Create a separate invitation for each staff member and revoke
                  it if it is sent to the wrong person.
                </p>
              </div>
              <button onClick={() => setTab("invites")} type="button">
                Create invitation
              </button>
            </div>
          </>
        )}

        {tab === "shops" && data?.viewer.role === "admin" && (
          <div className="admin-grid">
            <form className="admin-form-card" onSubmit={createShop}>
              <p className="kicker">New participating location</p>
              <h3>Add a charity shop</h3>
              <p>
                The address is verified automatically so customers can find
                the shop by distance.
              </p>
              <label className="form-field">
                <span>Shop name</span>
                <input
                  maxLength={100}
                  onChange={(event) => setShopName(event.target.value)}
                  placeholder="e.g. Good Sammy Cannington"
                  required
                  value={shopName}
                />
              </label>
              <label className="form-field">
                <span>Full street address</span>
                <input
                  maxLength={180}
                  onChange={(event) => setShopAddress(event.target.value)}
                  placeholder="Street, suburb and WA"
                  required
                  value={shopAddress}
                />
              </label>
              <div className="form-pair">
                <label className="form-field">
                  <span>Postcode</span>
                  <input
                    inputMode="numeric"
                    maxLength={4}
                    onChange={(event) =>
                      setShopPostcode(
                        event.target.value.replace(/\D/g, "").slice(0, 4),
                      )
                    }
                    pattern="[0-9]{4}"
                    placeholder="6000"
                    required
                    value={shopPostcode}
                  />
                </label>
                <label className="form-field">
                  <span>Opening hours</span>
                  <input
                    maxLength={180}
                    onChange={(event) => setShopHours(event.target.value)}
                    placeholder="Mon–Sat · 9am–5pm"
                    required
                    value={shopHours}
                  />
                </label>
              </div>
              <button className="primary-action" disabled={saving} type="submit">
                {saving ? "Checking address…" : "Add participating shop"}
              </button>
            </form>

            <div className="shop-management-list">
              {data.shops.length ? (
                data.shops.map((shop) => (
                  <article className="shop-management-card" key={shop.id}>
                    <div>
                      <span
                        className={shop.active ? "status-live" : "status-off"}
                      >
                        {shop.active ? "Participating" : "Archived"}
                      </span>
                      <h3>{shop.name}</h3>
                      <p>{shop.address} · {shop.postcode}</p>
                      <small>{shop.openingHours}</small>
                    </div>
                    <div className="table-actions">
                      <button
                        disabled={saving}
                        onClick={() => void editShop(shop)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className={shop.active ? "danger-link" : ""}
                        disabled={saving}
                        onClick={() => void toggleShop(shop)}
                        type="button"
                      >
                        {shop.active ? "Archive" : "Reactivate"}
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="invite-result-card">
                  <p className="kicker">Clean start</p>
                  <h3>No shops have been added.</h3>
                  <p>
                    Add the first real pilot location using the form. It will
                    immediately become available for manager invitations.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "staff" && data && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Username</th><th>Shop</th><th>Role</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <UserRow
                    admin={data.viewer.role === "admin"}
                    busy={saving}
                    key={user.id}
                    onDelete={() => void deleteUser(user)}
                    onReset={() => void resetPassword(user)}
                    onSave={(role, shopSlug) =>
                      void updateUser(user, role, shopSlug)
                    }
                    onToggle={() => void toggleUser(user)}
                    shops={data.shops.filter((shop) => shop.active)}
                    user={user}
                    viewerId={data.viewer.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "invites" && data && (
          <div className="admin-grid">
            <form className="admin-form-card" onSubmit={createInvite}>
              <p className="kicker">New staff access</p>
              <h3>Create an invitation</h3>
              <label className="form-field">
                <span>Shop</span>
                <select
                  onChange={(event) => setInviteShop(event.target.value)}
                  required
                  value={inviteShop}
                >
                  {data.shops
                    .filter(
                      (shop) =>
                        shop.active &&
                        (data.viewer.role === "admin" ||
                          data.viewer.shopId === shop.id),
                    )
                    .map((shop) => (
                      <option key={shop.slug} value={shop.slug}>{shop.name}</option>
                    ))}
                </select>
              </label>
              {data.viewer.role === "admin" && (
                <label className="form-field">
                  <span>Access level</span>
                  <select
                    onChange={(event) => setInviteRole(event.target.value)}
                    value={inviteRole}
                  >
                    <option value="staff">Staff — scanner only</option>
                    <option value="manager">Manager — staff and inventory</option>
                  </select>
                </label>
              )}
              <div className="form-pair">
                <label className="form-field">
                  <span>Valid for</span>
                  <select
                    onChange={(event) => setInviteDays(Number(event.target.value))}
                    value={inviteDays}
                  >
                    <option value={1}>1 day</option>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>Uses</span>
                  <input
                    max={25}
                    min={1}
                    onChange={(event) => setInviteUses(Number(event.target.value))}
                    type="number"
                    value={inviteUses}
                  />
                </label>
              </div>
              <button
                className="primary-action"
                disabled={saving || !inviteShop}
                type="submit"
              >
                {saving ? "Creating…" : "Create invitation"}
              </button>
              {!inviteShop && (
                <small>Add a participating shop before creating invitations.</small>
              )}
            </form>
            <div className="invite-result-card">
              {createdInvite ? (
                <>
                  <p className="kicker">Copy once</p>
                  <h3>{createdInvite.code}</h3>
                  <p>
                    {createdInvite.role} · {createdInvite.shopName}<br />
                    Expires {formatDate(createdInvite.expiresAt)}
                  </p>
                  <button
                    onClick={() =>
                      void navigator.clipboard.writeText(createdInvite.code)
                    }
                    type="button"
                  >
                    Copy invitation code
                  </button>
                </>
              ) : (
                <>
                  <p className="kicker">Secure onboarding</p>
                  <h3>Codes are never stored in readable form.</h3>
                  <p>The complete code appears here once after creation.</p>
                </>
              )}
            </div>
            <div className="admin-table-wrap full-width">
              <table className="admin-table">
                <thead><tr><th>Shop</th><th>Role</th><th>Usage</th><th>Expiry</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {data.invites.map((invite) => (
                    <tr key={invite.id}>
                      <td>{invite.shopName}</td>
                      <td>{invite.role}</td>
                      <td>{invite.useCount}/{invite.maxUses}</td>
                      <td>{formatDate(invite.expiresAt)}</td>
                      <td>{invite.active ? "Active" : "Closed"}</td>
                      <td>
                        {invite.active && (
                          <button
                            disabled={saving}
                            onClick={() =>
                              void request("/api/admin/invites", "DELETE", {
                                inviteId: invite.id,
                              })
                            }
                            type="button"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "inventory" && data && (
          <>
            <div className="admin-toolbar">
              <input
                onChange={(event) => setInventoryQuery(event.target.value)}
                placeholder="Search title, author, ISBN or shop"
                value={inventoryQuery}
              />
              <label>
                Status
                <select
                  onChange={(event) =>
                    setInventoryStatus(
                      event.target.value as
                        | "all"
                        | "available"
                        | "sold"
                        | "removed",
                    )
                  }
                  value={inventoryStatus}
                >
                  <option value="all">All lifecycle states</option>
                  <option value="available">Available</option>
                  <option value="sold">Sold</option>
                  <option value="removed">Removed, not sold</option>
                </select>
              </label>
              <button onClick={exportInventory} type="button">Export CSV</button>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Shop</th>
                    <th>Status</th>
                    <th>Listed</th>
                    <th>Outcome</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleInventory.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.title}</strong><small>{item.author} · {item.isbn13}</small></td>
                      <td>{item.shopName}</td>
                      <td>
                        {item.status === "available"
                          ? "Available"
                          : item.status === "sold"
                            ? "Sold"
                            : "Removed, not sold"}
                      </td>
                      <td>
                        {item.scannedBy || "Unknown"}
                        <small>{formatDate(item.scannedAt)}</small>
                      </td>
                      <td>
                        {item.status === "available" ? (
                          "—"
                        ) : (
                          <>
                            {item.removedBy || "Unknown"}
                            <small>
                              {item.status === "sold" && item.soldAt
                                ? `Sold ${formatDate(item.soldAt)}`
                                : item.removedAt
                                  ? `Removed ${formatDate(item.removedAt)}`
                                  : "Date unavailable"}
                            </small>
                            {item.status === "removed" &&
                              item.removalReason && (
                                <small>{item.removalReason}</small>
                              )}
                          </>
                        )}
                      </td>
                      <td className="table-actions">
                        <button onClick={() => void editInventory(item)} type="button">Edit</button>
                        <button onClick={() => void changeInventoryStatus(item)} type="button">
                          {item.status === "available" ? "Remove" : "Restore"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "activity" && data && (
          <div className="activity-list">
            {data.activity.map((event) => (
              <article key={event.id}>
                <span>{event.actorUsername || "System"}</span>
                <div>
                  <strong>{readableAction(event.action)}</strong>
                  <p>
                    {typeof event.details.title === "string"
                      ? `${event.details.title} · `
                      : ""}
                    {event.targetType} · {formatDate(event.createdAt)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}

        {tab === "account" && data && (
          <form className="admin-form-card account-view" onSubmit={changePassword}>
            <p className="kicker">Signed in as {data.viewer.username}</p>
            <h3>Change your password</h3>
            <p>
              Use at least 10 characters. Changing it signs your account out on
              every other device.
            </p>
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
                onChange={(event) => setNewPassword(event.target.value)}
                required
                type="password"
                value={newPassword}
              />
            </label>
            <button className="primary-action" disabled={saving} type="submit">
              {saving ? "Changing password…" : "Change password"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

function UserRow({
  user,
  admin,
  viewerId,
  busy,
  onSave,
  onToggle,
  onReset,
  onDelete,
  shops,
}: {
  user: OverviewData["users"][number];
  admin: boolean;
  viewerId: number;
  busy: boolean;
  onSave: (role: string, shopSlug: string) => void;
  onToggle: () => void;
  onReset: () => void;
  onDelete: () => void;
  shops: OverviewData["shops"];
}) {
  const [role, setRole] = useState(user.role);
  const [shopSlug, setShopSlug] = useState(user.shopSlug ?? "");
  return (
    <tr>
      <td><strong>{user.username}</strong><small>Created {formatDate(user.createdAt)}</small></td>
      <td>
        {user.id === viewerId || role === "admin" ? (
          "Platform-wide"
        ) : admin ? (
          <select onChange={(event) => setShopSlug(event.target.value)} value={shopSlug}>
            {shops.map((shop) => <option key={shop.slug} value={shop.slug}>{shop.name}</option>)}
          </select>
        ) : user.shopName || "Unassigned"}
      </td>
      <td>
        {admin && user.id !== viewerId ? (
          <select
            onChange={(event) => {
              const nextRole = event.target.value;
              setRole(nextRole);
              if (nextRole === "admin") setShopSlug("");
              else if (!shopSlug) setShopSlug(shops[0]?.slug ?? "");
            }}
            value={role}
          >
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
            <option value="admin">Owner</option>
          </select>
        ) : user.role}
      </td>
      <td><span className={user.active ? "status-live" : "status-off"}>{user.active ? "Active" : "Disabled"}</span></td>
      <td className="table-actions">
        {user.id === viewerId ? (
          <small>Manage your password from the Account section.</small>
        ) : (
          <>
            {admin && <button disabled={busy} onClick={() => onSave(role, shopSlug)} type="button">Save</button>}
            <button disabled={busy} onClick={onReset} type="button">Reset password</button>
            <button disabled={busy} onClick={onToggle} type="button">{user.active ? "Disable" : "Enable"}</button>
            <button className="danger-link" disabled={busy} onClick={onDelete} type="button">Delete</button>
          </>
        )}
      </td>
    </tr>
  );
}
