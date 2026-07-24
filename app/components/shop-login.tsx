"use client";

import { FormEvent, useState } from "react";
import { masterShops } from "../../config/shops";
import { ShopIcon } from "./icons";

type AuthMode = "login" | "register";

export function ShopLogin() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [shopSlug, setShopSlug] = useState(masterShops[0]?.slug ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
        mode === "login" ? "/api/auth/login" : "/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            password,
            ...(mode === "register" ? { shopSlug } : {}),
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
      window.location.reload();
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
        <h1>{mode === "login" ? "Staff sign in" : "Create staff account"}</h1>
        <p className="login-intro">
          {mode === "login"
            ? "Use your personal staff account to manage your shop's live inventory."
            : "Choose your shop once. Every book you add or remove will be linked to that shop."}
        </p>

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
            {mode === "register" && (
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
                {masterShops.map((shop) => (
                  <option key={shop.slug} value={shop.slug}>
                    {shop.name}
                  </option>
                ))}
              </select>
              <small>This shop will be permanently linked to your account.</small>
            </label>
          )}

          <label className="form-field">
            <span>Password</span>
            <input
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              maxLength={128}
              minLength={mode === "register" ? 10 : undefined}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            {mode === "register" && (
              <small>Use at least 10 characters.</small>
            )}
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-action" disabled={submitting} type="submit">
            {submitting
              ? mode === "login"
                ? "Signing in…"
                : "Creating account…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>
      </section>
    </div>
  );
}
