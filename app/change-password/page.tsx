"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "../../components/ui";
import {
  broadcastWorkspaceBoundary,
  workspaceCache,
} from "../../lib/client/workspace-cache";
export default function ChangePassword() {
  const router = useRouter();
  const [currentPassword, setCurrent] = useState(""),
    [newPassword, setNew] = useState(""),
    [again, setAgain] = useState(""),
    [show, setShow] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== again) {
      setError("Those new passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not update password.");
      workspaceCache.clear();
      broadcastWorkspaceBoundary();
      router.replace(d.user.role === "member" ? "/portal" : "/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update password.");
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
            A fresh start.
            <br />
            <em>Your account.</em>
          </h1>
          <p>
            Choose a personal password before continuing to your Fit Hub
            account.
          </p>
        </div>
      </section>
      <section className="login-form-side">
        <div className="login-box">
          <Brand />
          <h2>Set your password</h2>
          <p className="subtitle">
            This one-time step keeps your account yours.
          </p>
          <form className="form-stack" onSubmit={submit}>
            <label>
              Temporary password
              <span className="password-wrap">
                <input
                  required
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrent(e.target.value)}
                />
                <button
                  className="show-pass"
                  type="button"
                  onClick={() => setShow(!show)}
                >
                  {show ? "Hide" : "Show"}
                </button>
              </span>
            </label>
            <label>
              New password
              <input
                required
                minLength={8}
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNew(e.target.value)}
              />
            </label>
            <label>
              Confirm new password
              <input
                required
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={again}
                onChange={(e) => setAgain(e.target.value)}
              />
            </label>
            {error && (
              <div className="notice" role="alert">
                {error}
              </div>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
          <p className="login-foot">At least 8 characters. Keep it private.</p>
        </div>
      </section>
    </main>
  );
}
