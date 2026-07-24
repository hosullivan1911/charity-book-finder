"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { masterShops } from "../../config/shops";

type AdminTab = "overview" | "staff" | "invites" | "inventory" | "activity";

type OverviewData = {
  viewer: {
    id: number;
    username: string;
    role: string;
    shopId: number;
  };
  stats: {
    activeInventory: number;
    activeUsers: number;
    scansLastSevenDays: number;
    participatingShops: number;
  };
  users: Array<{
    id: number;
    username: string;
    role: string;
    active: boolean;
    createdAt: string;
    shopId: number;
    shopSlug: string;
    shopName: string;
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
  const [showRemoved, setShowRemoved] = useState(false);
  const [inviteShop, setInviteShop] = useState(masterShops[0]?.slug ?? "");
  const [inviteRole, setInviteRole] = useState("staff");
  const [inviteUses, setInviteUses] = useState(1);
  const [inviteDays, setInviteDays] = useState(7);
  const [createdInvite, setCreatedInvite] = useState<CreatedInvite | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/admin/overview", { cache: "no-store" });
      const body = (await response.json()) as OverviewData & { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "Could not load management data.");
      }
      setData(body);
      if (body.viewer.role !== "admin") {
        const viewer = body.users.find((user) => user.id === body.viewer.id);
        if (viewer) setInviteShop(viewer.shopSlug);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load management data.",
      );
    } finally {
      setLoading(false);
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

  function exportInventory() {
    if (!data) return;
    const escape = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["ISBN", "Title", "Author", "Shop", "Status", "Scanned by", "Scanned at"],
      ...data.inventory.map((item) => [
        item.isbn13,
        item.title,
        item.author,
        item.shopName,
        item.status,
        item.scannedBy,
        item.scannedAt,
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
        (showRemoved || item.status === "available") &&
        (!needle ||
          `${item.title} ${item.author} ${item.isbn13} ${item.shopName}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [data, inventoryQuery, showRemoved]);

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
              ["staff", "Staff"],
              ["invites", "Invitations"],
              ["inventory", "Inventory"],
              ["activity", "Activity"],
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
        <Link href="/staff">← Return to scanner</Link>
      </aside>

      <section className="admin-content">
        <header className="admin-heading">
          <div>
            <p className="kicker">{data?.viewer.role} access</p>
            <h2>{tab === "staff" ? "Staff accounts" : tab}</h2>
          </div>
          <button onClick={() => void load()} type="button">Refresh</button>
        </header>

        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-success" role="status">{notice}</p>}

        {tab === "overview" && data && (
          <>
            <div className="admin-stats">
              <article><strong>{data.stats.activeInventory}</strong><span>Books available</span></article>
              <article><strong>{data.stats.activeUsers}</strong><span>Active staff</span></article>
              <article><strong>{data.stats.scansLastSevenDays}</strong><span>Scans in 7 days</span></article>
              <article><strong>{data.stats.participatingShops}</strong><span>Shops with staff</span></article>
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
                  value={inviteShop}
                >
                  {masterShops
                    .filter(
                      (shop) =>
                        data.viewer.role === "admin" ||
                        data.viewer.shopId ===
                          data.users.find((user) => user.shopSlug === shop.slug)
                            ?.shopId,
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
              <button className="primary-action" disabled={saving} type="submit">
                {saving ? "Creating…" : "Create invitation"}
              </button>
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
                <input
                  checked={showRemoved}
                  onChange={(event) => setShowRemoved(event.target.checked)}
                  type="checkbox"
                /> Show removed
              </label>
              <button onClick={exportInventory} type="button">Export CSV</button>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Book</th><th>Shop</th><th>Status</th><th>Last action</th><th>Actions</th></tr></thead>
                <tbody>
                  {visibleInventory.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.title}</strong><small>{item.author} · {item.isbn13}</small></td>
                      <td>{item.shopName}</td>
                      <td>{item.status}</td>
                      <td>{item.status === "available" ? item.scannedBy : item.removedBy}<small>{formatDate(item.removedAt || item.scannedAt)}</small></td>
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
                  <p>{event.targetType} · {formatDate(event.createdAt)}</p>
                </div>
              </article>
            ))}
          </div>
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
}: {
  user: OverviewData["users"][number];
  admin: boolean;
  viewerId: number;
  busy: boolean;
  onSave: (role: string, shopSlug: string) => void;
  onToggle: () => void;
  onReset: () => void;
  onDelete: () => void;
}) {
  const [role, setRole] = useState(user.role);
  const [shopSlug, setShopSlug] = useState(user.shopSlug);
  return (
    <tr>
      <td><strong>{user.username}</strong><small>Created {formatDate(user.createdAt)}</small></td>
      <td>
        {admin ? (
          <select onChange={(event) => setShopSlug(event.target.value)} value={shopSlug}>
            {masterShops.map((shop) => <option key={shop.slug} value={shop.slug}>{shop.name}</option>)}
          </select>
        ) : user.shopName}
      </td>
      <td>
        {admin ? (
          <select onChange={(event) => setRole(event.target.value)} value={role}>
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
            <option value="admin">Owner</option>
          </select>
        ) : user.role}
      </td>
      <td><span className={user.active ? "status-live" : "status-off"}>{user.active ? "Active" : "Disabled"}</span></td>
      <td className="table-actions">
        {user.id === viewerId ? (
          <small>Manage your password in the scanner&apos;s Account section.</small>
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
