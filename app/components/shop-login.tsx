"use client";

import { FormEvent, useState } from "react";
import { ShopIcon } from "./icons";

export function ShopLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not sign in.");
      window.location.reload();
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Could not sign in.",
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
        <h1>Shop access</h1>
        <p className="login-intro">
          Sign in with your shop credentials to manage live inventory.
        </p>
        <form onSubmit={submit}>
          <label className="form-field">
            <span>Email</span>
            <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="volunteer@example.org"
              required
              type="email"
              value={email}
            />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-action" disabled={submitting} type="submit">
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </div>
  );
}
