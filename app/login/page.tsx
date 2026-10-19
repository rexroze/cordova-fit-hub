"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brand } from "../../components/ui";
import {
  broadcastWorkspaceBoundary,
  workspaceCache,
} from "../../lib/client/workspace-cache";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (
      new URLSearchParams(window.location.search).get("logout") === "failed"
    ) {
      setError(
        "Your cached workspace was cleared, but server sign-out could not be confirmed. Reconnect and sign in again, then retry signing out before leaving a shared device.",
      );
    }
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    workspaceCache.clear();
    broadcastWorkspaceBoundary();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (!r.ok)
        throw new Error(d.error || "Unable to sign in. Please try again.");
      router.replace(
        d.user.mustChangePassword
          ? "/change-password"
          : d.user.role === "member"
            ? "/portal"
            : "/dashboard",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-art">
        <div className="art-orbit" />
        <Brand />
        <div className="art-copy">
          <h1>
            Show up.
            <br />
            <em>Get stronger.</em>
          </h1>
          <p>Your training home, membership, and progress—all in one place.</p>
        </div>
        <div className="art-footer muted">CORDOVA · FITNESS COMMUNITY</div>
      </section>
      <section className="login-form-side">
        <div className="login-box">
          <Brand />
          <h2>Welcome back</h2>
          <p className="subtitle">Sign in to your Fit Hub account.</p>
          <form className="form-stack" onSubmit={submit}>
            <label>
              Email address
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <span className="password-wrap">
                <input
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  className="show-pass"
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? "Hide" : "Show"}
                </button>
              </span>
            </label>
            {error && (
              <div className="notice" role="alert">
                {error}
              </div>
            )}
            <button type="submit" className="button primary" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}{" "}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <p className="login-foot">
            Need access? Please contact the gym staff.
          </p>
        </div>
      </section>
    </main>
  );
}
