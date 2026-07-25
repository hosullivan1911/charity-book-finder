"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Shop } from "../../lib/types";
import { ShopIcon } from "./icons";

type AuthMode = "login" | "register" | "setup";

export function ShopLogin({ setupRequired = false }: { setupRequired?: boolean }) {
  const [mode, setMode] = useState<AuthMode>(
    setupRequired ? "setup" : "login",
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopSlug, setShopSlug] = useState("");
  const [shopsLoading, setShopsLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadShops() {
      try {
        const response = await fetch("/api/shops", {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as { shops?: Shop[] };
        const activeShops = Array.isArray(body.shops) ? body.shops : [];
        setShops(activeShops);
        setShopSlug((current) => current || activeShops[0]?.slug || "");
      } catch {
        if (!controller.signal.aborted) setShops([]);
      } finally {
        if (!controller.signal.aborted) setShopsLoading(false);
      }
    }
    void loadShops();
    return () => controller.abort();
  }, []);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setPassword("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        mode === "login"
          ? "/api/auth/login"
          : mode === "setup"
            ? "/api/auth/setup"
            : "/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            password,
            ...(mode === "register" ? { shopSlug } : {}),
            ...(mode === "register" ? { inviteCode } : {}),
            ...(mode === "setup" ? { setupCode } : {}),
          }),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          data.error ||
            (mode === "login"
              ? "Could not sign in."
              : "Could not create the account."),
        );
      }
      window.location.assign(mode === "setup" ? "/admin" : "/staff");
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "Could not complete that request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <section className="login-card">
        <span className="login-icon"><ShopIcon /></span>
        <p className="kicker">Giveleaf for shops</p>
        <h1>
          {mode === "login"
            ? "Staff sign in"
            : mode === "setup"
              ? "Set up Giveleaf"
              : "Create staff account"}
        </h1>
        <p className="login-intro">
          {mode === "login"
            ? "Use your personal staff account to manage your shop's live inventory."
            : mode === "setup"
              ? "Create the first protected owner account after the launch reset."
              : "Use the invitation from your shop manager. Every update stays linked to your assigned shop."}
        </p>

        {!setupRequired && (
          <div className="auth-switch" aria-label="Account options">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => changeMode("login")}
            type="button"
          >
            Sign in
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => changeMode("register")}
            type="button"
          >
            Create account
          </button>
          </div>
        )}

        <form onSubmit={submit}>
          <label className="form-field">
            <span>Username</span>
            <input
              autoCapitalize="none"
              autoComplete="username"
              maxLength={32}
              minLength={3}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="e.g. harry.osullivan"
              required
              value={username}
            />
            {mode !== "login" && (
              <small>3–32 letters, numbers, dots, hyphens or underscores.</small>
            )}
          </label>

          {mode === "register" && (
            <label className="form-field">
              <span>Assigned shop</span>
              <select
                onChange={(event) => setShopSlug(event.target.value)}
                required
                value={shopSlug}
              >
                {shops.map((shop) => (
                  <option key={shop.slug} value={shop.slug}>
                    {shop.name}
                  </option>
                ))}
              </select>
              <small>
                {shopsLoading
                  ? "Loading participating shops…"
                  : shops.length
                    ? "Managers can reassign this later if needed."
                    : "No shops are available yet. Ask the Giveleaf owner to add one."}
              </small>
            </label>
          )}

          {mode === "register" && (
            <label className="form-field">
              <span>Invitation code</span>
              <input
                autoCapitalize="characters"
                autoComplete="one-time-code"
                onChange={(event) =>
                  setInviteCode(event.target.value.toUpperCase())
                }
                placeholder="GL-XXXXXXXXXXXX"
                required
                value={inviteCode}
              />
              <small>Ask your shop manager for a current invitation.</small>
            </label>
          )}

          {mode === "setup" && (
            <label className="form-field">
              <span>One-time owner setup code</span>
              <input
                autoCapitalize="none"
                autoComplete="one-time-code"
                onChange={(event) => setSetupCode(event.target.value)}
                required
                type="password"
                value={setupCode}
              />
              <small>This private code closes permanently after setup.</small>
            </label>
          )}

          <label className="form-field">
            <span>Password</span>
            <input
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              maxLength={128}
              minLength={mode === "login" ? undefined : 10}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            {mode !== "login" && (
              <small>Use at least 10 characters.</small>
            )}
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}
          <button
            className="primary-action"
            disabled={submitting || (mode === "register" && !shopSlug)}
            type="submit"
          >
            {submitting
              ? mode === "login"
                ? "Signing in…"
                : mode === "setup"
                  ? "Creating owner…"
                  : "Creating account…"
              : mode === "login"
                ? "Sign in"
                : mode === "setup"
                  ? "Create owner account"
                  : "Create account"}
          </button>
        </form>
      </section>
    </div>
  );
}
