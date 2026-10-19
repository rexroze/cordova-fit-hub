"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LineChart,
  Line,
} from "recharts";
import QRCode from "qrcode";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Nav, PageTitle, Modal } from "../../components/ui";
import type {
  Attendance,
  Analytics,
  BootstrapData,
  Member,
  Membership,
  Payment,
  Plan,
  SessionUser,
} from "../../lib/contracts";
import { useSyncExternalStore } from "react";
import {
  workspaceCache,
  HttpError,
  broadcastWorkspaceBoundary,
  getServerWorkspaceSnapshot,
} from "../../lib/client/workspace-cache";
import WorkspaceSkeleton from "../../components/workspace-skeleton";
type User = SessionUser;
type Data = BootstrapData;
const php = (n: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
const date = (v: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(v.length === 10 ? `${v}T12:00:00+08:00` : v));
async function api(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const ct = r.headers.get("content-type") || "";
  if (!r.ok) {
    let err = "Something went wrong. Please try again.";
    try {
      err = (await r.json()).error || err;
    } catch {}
    throw new HttpError(r.status, err);
  }
  return ct.includes("json") ? r.json() : r;
}
const json = (method: string, body: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const initials = (s: string) =>
  s
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default function Workspace() {
  const params = useParams<{ view: string[] }>();
  const route = (params.view || []).join("/") || "dashboard";
  const router = useRouter();
  const snapshot = useSyncExternalStore(
    workspaceCache.subscribe,
    workspaceCache.getSnapshot,
    getServerWorkspaceSnapshot,
  );
  const data = snapshot.data;
  const loading = snapshot.refreshing;
  const [error, setError] = useState("");
  const [modal, setModal] = useState("");
  const [renewalKey, setRenewalKey] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [manilaToday, setManilaToday] = useState("");
  const load = useCallback(
    async (force = false) => {
      try {
        const d = await workspaceCache.load(() => api("/api/bootstrap"), force);
        if (!d) return;
        if (d.user.mustChangePassword) {
          router.replace("/change-password");
          return;
        }
        if (d.user.role === "member" && !route.startsWith("portal")) {
          router.replace("/portal");
          return;
        }
        if (d.user.role !== "member" && route.startsWith("portal")) {
          router.replace("/dashboard");
          return;
        }
        setManilaToday(
          new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
            new Date(),
          ),
        );
        setError("");
      } catch (e) {
        if (e instanceof HttpError && e.status === 401)
          router.replace("/login");
        if (e instanceof HttpError && e.status === 403) {
          try {
            const me = await api("/api/auth/me");
            router.replace(
              me.user?.mustChangePassword ? "/change-password" : "/login",
            );
          } catch {
            router.replace("/login");
          }
        }
        setError(e instanceof Error ? e.message : "Unable to load workspace.");
      }
    },
    [router, route],
  );
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  useEffect(() => {
    if (snapshot.data && snapshot.error) setError(snapshot.error);
  }, [snapshot.error, snapshot.data]);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("workspace-session");
    channel.onmessage = () => {
      workspaceCache.clear();
      router.replace("/login");
    };
    return () => channel.close();
  }, [router]);
  useEffect(() => {
    if (modal) setError("");
  }, [modal]);
  useEffect(() => {
    setRenewalKey(modal === "renew" ? crypto.randomUUID() : "");
  }, [modal]);
  const action = async (
    url: string,
    method: string,
    body: unknown,
    success: string,
  ) => {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await api(url, json(method, body));
      workspaceCache.invalidate();
      setNotice(success);
      setModal("");
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    workspaceCache.clear();
    broadcastWorkspaceBoundary();
    let failed = false;
    try {
      await api("/api/auth/logout", json("POST", {}));
    } catch {
      failed = true;
    } finally {
      router.replace(failed ? "/login?logout=failed" : "/login");
    }
  };
  if (!data && !error) return <WorkspaceSkeleton route={route} />;
  if (!data)
    return (
      <div className="content">
        <div className="notice" role="alert">
          {error || "Unable to load workspace."}{" "}
          <button className="button small-button" onClick={() => load(true)}>
            Try again
          </button>
        </div>
      </div>
    );
  const { user } = data;
  const memberById = (id: string) => data.members.find((m) => m.id === id);
  const planById = (id: string) => data.plans.find((p) => p.id === id);
  const heading: Record<string, string> = {
    dashboard: "Your gym, at a glance",
    members: "Members",
    plans: "Membership plans",
    renewals: "Renewals",
    payments: "Payments",
    "check-in": "Member check-in",
    attendance: "Attendance",
    analytics: "Gym analytics",
    data: "Data & CSV",
    staff: "Staff",
    portal: "Your Fit Hub",
    "portal/payments": "Payment history",
    "portal/profile": "Your profile",
    profile: "Your profile",
  };
  const title = heading[route] || heading.dashboard;
  const filteredMembers = data.members.filter(
    (m) =>
      (m.name + " " + m.memberCode + " " + m.phone + " " + m.email)
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "all" ||
        (filter === "active"
          ? data.memberships.some(
              (x) => x.memberId === m.id && x.status === "active",
            )
          : filter === "expired"
            ? data.memberships.some(
                (x) => x.memberId === m.id && x.status === "expired",
              )
            : true)),
  );
  const formSubmit =
    (endpoint: string, method: string, success: string) =>
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const b: Record<string, unknown> = Object.fromEntries(fd.entries());
      for (const key of ["amountPaid", "amount", "price", "durationMonths"])
        if (key in b) b[key] = Number(b[key]);
      if (endpoint === "/api/plans") b.active = true;
      void action(endpoint, method, b, success);
    };
  const memberForm = (
    <form
      className="form-stack"
      onSubmit={formSubmit("/api/members", "POST", "Member registered.")}
    >
      <div className="form-grid">
        <label>
          Full name
          <input name="name" required />
        </label>
        <label>
          Phone
          <input name="phone" type="tel" required />
        </label>
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        <label>
          How did they hear about us?
          <select name="source">
            <option value="walk-in">Walk-in</option>
            <option>Referral</option>
            <option>Social media</option>
            <option>Other</option>
          </select>
        </label>
        <label className="field-span">
          Starting plan (optional)
          <select name="planId">
            <option value="">No plan yet</option>
            {data.plans
              .filter((p) => p.active)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {php(p.price)}
                </option>
              ))}
          </select>
        </label>
        <label>
          Payment collected (PHP)
          <input
            name="amountPaid"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
          />
        </label>
        <label>
          Payment method
          <select name="paymentMethod">
            <option value="cash">Cash</option>
            <option value="gcash">GCash</option>
            <option value="bank_transfer">Bank transfer</option>
          </select>
        </label>
        <label className="field-span">
          Reference (optional)
          <input name="reference" />
        </label>
      </div>
      <p className="muted">
        The member signs in with their phone as a temporary password and must
        change it before continuing. Any payment here is a manual record, not
        gateway verification.
      </p>
      <button className="button primary" disabled={busy}>
        {busy ? "Saving…" : "Register member"}
      </button>
    </form>
  );
  const paymentForm = (
    <PaymentForm
      members={data.members}
      memberships={data.memberships}
      memberById={memberById}
      onSubmit={formSubmit("/api/payments", "POST", "Payment recorded.")}
      busy={busy}
    />
  );
  const rows = (items: Member[]) =>
    items.length ? (
      items.map((m) => (
        <tr key={m.id}>
          <td>
            <button
              className="person"
              style={{
                border: 0,
                background: "none",
                padding: 0,
                textAlign: "left",
              }}
              onClick={() => {
                setSelected(m);
                setModal("member");
              }}
            >
              <span className="avatar">{initials(m.name)}</span>
              <span>
                {m.name}
                <br />
                <small className="muted">{m.memberCode}</small>
              </span>
            </button>
          </td>
          <td>{m.phone}</td>
          <td>
            {data.memberships.find((x) => x.memberId === m.id)?.status ||
              "No plan"}
          </td>
          <td>
            {(() => {
              const x = data.memberships.find((x) => x.memberId === m.id);
              return x ? date(x.expiresAt) : "—";
            })()}
          </td>
          <td>
            <button
              className="button ghost small-button"
              onClick={() => {
                setSelected(m);
                setModal("renew");
              }}
            >
              Renew
            </button>
          </td>
        </tr>
      ))
    ) : (
      <tr>
        <td colSpan={5}>
          <div className="empty">No members match this view.</div>
        </td>
      </tr>
    );
  const memberTable = (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Member</th>
            <th>Phone</th>
            <th>Membership</th>
            <th>Expires</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>{rows(filteredMembers)}</tbody>
      </table>
    </div>
  );
  let body: any = null;
  if (route === "dashboard") {
    const a = data.analytics;
    body = (
      <>
        <div className="metric-grid grid">
          {[
            ["Active members", a?.metrics.activeMemberships ?? "—", "♙"],
            ["Monthly revenue", a ? php(a.metrics.monthlyRevenue) : "—", "₱"],
            ["Today’s check-ins", a?.metrics.todayAttendance ?? "—", "⌗"],
            ["Expiring soon", a?.metrics.expiringMemberships ?? "—", "↻"],
          ].map(([t, v, i]) => (
            <article className="card" key={String(t)}>
              <span className="metric-icon">{i}</span>
              <div className="metric-label">{t}</div>
              <div className="metric-value">{v}</div>
              <div className="metric-note">Based on recorded gym activity</div>
            </article>
          ))}
        </div>
        <div className="grid dashboard-grid">
          <section className="card">
            <div className="section-head">
              <h2>Revenue trend</h2>
              <Link className="muted" href="/analytics">
                View analytics →
              </Link>
            </div>
            {a ? (
              <div className="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={a.revenueSeries}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e9ece3"
                    />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `₱${v / 1000}k`}
                    />
                    <Tooltip formatter={(v: any) => php(Number(v))} />
                    <Bar
                      dataKey="revenue"
                      fill="#9bc846"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty">
                Analytics are not available for this account.
              </div>
            )}
          </section>
          <section className="card">
            <div className="section-head">
              <h2>Quick actions</h2>
            </div>
            <div className="form-stack">
              <button
                className="button primary"
                onClick={() => setModal("register")}
              >
                ＋ Register a member
              </button>
              <Link className="button ghost" href="/check-in">
                ⌗ Check in a member
              </Link>
              <button
                className="button ghost"
                onClick={() => setModal("payment")}
              >
                ₱ Record a payment
              </button>
              <Link className="button ghost" href="/renewals">
                ↻ Review renewals
              </Link>
            </div>
            <p className="muted" style={{ margin: "16px 0 0", fontSize: 12 }}>
              Payments are records entered by staff, not online payment
              verification.
            </p>
          </section>
        </div>
      </>
    );
  } else if (route === "members" || route === "renewals") {
    const ms =
      route === "renewals"
        ? data.members
            .filter((m) => {
              const x = data.memberships.find((x) => x.memberId === m.id);
              return (
                x &&
                (x.status === "expired" ||
                  x.status === "upcoming" ||
                  (manilaToday !== "" && x.expiresAt <= manilaToday))
              );
            })
            .filter((m) =>
              (m.name + " " + m.memberCode + " " + m.phone + " " + m.email)
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
        : filteredMembers;
    const rowsForView = (items: Member[]) =>
      items.length ? (
        items.map((m) => (
          <tr key={m.id}>
            <td>
              <button
                className="person"
                style={{
                  border: 0,
                  background: "none",
                  padding: 0,
                  textAlign: "left",
                }}
                onClick={() => {
                  setSelected(m);
                  setModal("member");
                }}
              >
                <span className="avatar">{initials(m.name)}</span>
                <span>
                  {m.name}
                  <br />
                  <small className="muted">{m.memberCode}</small>
                </span>
              </button>
            </td>
            <td>{m.phone}</td>
            <td>
              {data.memberships.find((x) => x.memberId === m.id)?.status ||
                "No plan"}
            </td>
            <td>
              {(() => {
                const x = data.memberships.find((x) => x.memberId === m.id);
                return x ? date(x.expiresAt) : "—";
              })()}
            </td>
            <td>
              <button
                className="button ghost small-button"
                onClick={() => {
                  setSelected(m);
                  setModal("renew");
                }}
              >
                Renew
              </button>
            </td>
          </tr>
        ))
      ) : (
        <tr>
          <td colSpan={5}>
            <div className="empty">No members match this view.</div>
          </td>
        </tr>
      );
    body = (
      <>
        <div className="toolbar">
          <div className="search">
            <span>⌕</span>
            <input
              aria-label="Search members"
              placeholder="Search name, code, phone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {route === "members" && (
            <select
              className="filter"
              aria-label="Filter members"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All members</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </select>
          )}
          <button
            className="button primary"
            onClick={() => setModal("register")}
          >
            ＋ Add member
          </button>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Phone</th>
                  <th>Membership</th>
                  <th>Expires</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>{rowsForView(ms)}</tbody>
            </table>
          </div>
        </div>
      </>
    );
  } else if (route === "plans")
    body = (
      <>
        <div className="section-head">
          <p className="subtitle">
            Set the membership options your team can offer.
          </p>
          {user.role === "owner" && (
            <button
              className="button primary"
              onClick={() => {
                setError("");
                setModal("plan");
              }}
            >
              ＋ Add plan
            </button>
          )}
        </div>
        <div className="grid metric-grid">
          {data.plans.map((p) => (
            <article className="card" key={p.id}>
              <span className={`badge ${p.active ? "" : "error"}`}>
                {p.active ? "Available" : "Paused"}
              </span>
              <h2 style={{ fontSize: 20, margin: "20px 0 5px" }}>{p.name}</h2>
              <div className="metric-value">{php(p.price)}</div>
              <p className="muted">
                {p.durationMonths} month{p.durationMonths > 1 ? "s" : ""} ·{" "}
                {
                  data.memberships.filter(
                    (m) => m.planId === p.id && m.status === "active",
                  ).length
                }{" "}
                active members
              </p>
              {user.role === "owner" && (
                <div className="pill-row">
                  <button
                    className="button ghost small-button"
                    onClick={() => {
                      setSelected({ id: p.id } as Member);
                      setError("");
                      setModal("edit-plan");
                    }}
                  >
                    Edit plan
                  </button>
                  <button
                    className="button ghost small-button"
                    onClick={() =>
                      action(
                        `/api/plans/${p.id}`,
                        "PATCH",
                        { active: !p.active },
                        p.active ? "Plan paused." : "Plan activated.",
                      )
                    }
                  >
                    {p.active ? "Pause plan" : "Activate plan"}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
        <p className="muted">
          Plan prices and availability are managed by the owner.
        </p>
      </>
    );
  else if (route === "payments")
    body = (
      <>
        <div className="toolbar">
          <div className="search">
            <span>⌕</span>
            <input
              placeholder="Search member or payment method…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            className="button primary"
            onClick={() => setModal("payment")}
          >
            ＋ Record payment
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Recorded</th>
              </tr>
            </thead>
            <tbody>
              {data.payments
                .filter((p) =>
                  (
                    (memberById(p.memberId)?.name || "") +
                    " " +
                    p.method +
                    " " +
                    (p.reference || "")
                  )
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((p) => (
                  <tr key={p.id}>
                    <td>{memberById(p.memberId)?.name || "Member"}</td>
                    <td>{php(p.amount)}</td>
                    <td>{p.method.replace("_", " ")}</td>
                    <td>{p.reference || "—"}</td>
                    <td>{date(p.paidAt)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!data.payments.length && (
            <div className="empty">No payment records yet.</div>
          )}
        </div>
        <p className="muted" style={{ marginTop: 12 }}>
          These are staff-entered records; they do not verify external GCash or
          bank transactions.
        </p>
      </>
    );
  else if (route === "check-in")
    body = (
      <Checkin
        onResult={async (code, method) => {
          setBusy(true);
          setNotice("");
          try {
            const d = await api(
              "/api/check-in",
              json("POST", { code, method }),
            );
            setNotice(d.message || `Checked in ${d.member?.name || "member"}.`);
            workspaceCache.invalidate();
            await load(true);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Check-in failed.");
          } finally {
            setBusy(false);
          }
        }}
        busy={busy}
      />
    );
  else if (route === "attendance")
    body = (
      <>
        <div className="toolbar">
          <div className="search">
            <span>⌕</span>
            <input
              placeholder="Search member or code…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <a
            className="button ghost"
            download="attendance.csv"
            href="/api/export?type=attendance"
          >
            ↓ Export CSV
          </a>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Member code</th>
                <th>Time · Manila</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody>
              {data.attendance
                .filter((a) =>
                  (
                    memberById(a.memberId)?.name +
                    " " +
                    memberById(a.memberId)?.memberCode
                  )
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((a) => (
                  <tr key={a.id}>
                    <td>{memberById(a.memberId)?.name || "Member"}</td>
                    <td>{memberById(a.memberId)?.memberCode || "—"}</td>
                    <td>
                      {new Intl.DateTimeFormat("en-PH", {
                        timeZone: "Asia/Manila",
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(a.checkedInAt))}
                    </td>
                    <td>{a.method === "qr" ? "QR scan" : "Manual"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!data.attendance.length && (
            <div className="empty">No check-ins recorded yet.</div>
          )}
        </div>
      </>
    );
  else if (route === "analytics")
    body = data.analytics ? (
      <>
        <h2>Descriptive · recorded activity</h2>
        <div className="metric-grid grid">
          {Object.entries(data.analytics.metrics).map(([k, v]) => (
            <article className="card" key={k}>
              <div className="metric-label">{k.replace(/([A-Z])/g, " $1")}</div>
              <div className="metric-value">
                {k.toLowerCase().includes("revenue") ? php(Number(v)) : v}
              </div>
            </article>
          ))}
        </div>
        <div className="grid dashboard-grid">
          <section className="card">
            <h2>Attendance · recent days</h2>
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.analytics.attendanceSeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line dataKey="visits" stroke="#779c37" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="card">
            <h2>Membership mix</h2>
            {data.analytics.planDistribution.map((x) => (
              <p key={x.name} className="section-head">
                <span>{x.name}</span>
                <strong>{x.members}</strong>
              </p>
            ))}
          </section>
          <section className="card">
            <h2>Member source</h2>
            {data.analytics.sourceDistribution.length ? (
              data.analytics.sourceDistribution.map((x) => (
                <p key={x.name} className="section-head">
                  <span>{x.name}</span>
                  <strong>{x.members}</strong>
                </p>
              ))
            ) : (
              <p className="muted">No source data available.</p>
            )}
          </section>
        </div>
        <h2 style={{ marginTop: 24 }}>
          Predictive · estimate, not a guarantee
        </h2>
        <div className="grid dashboard-grid">
          <section className="card">
            <h3>Next month revenue estimate</h3>
            <div className="metric-value">
              {php(data.analytics.forecast.nextMonthRevenue)}
            </div>
            <p className="muted">
              Method: {data.analytics.forecast.method}.{" "}
              {data.analytics.forecast.explanation}
            </p>
            {!data.analytics.forecast.sufficientData && (
              <div className="notice">
                Limited history: treat this estimate as directional only.
              </div>
            )}
          </section>
          <section className="card">
            <h3>Prescriptive · options to consider</h3>
            {data.analytics.recommendations.length ? (
              data.analytics.recommendations.map((x, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  <strong>{x.title}</strong>
                  <p className="muted" style={{ margin: "5px 0 0" }}>
                    {x.description}
                  </p>
                </div>
              ))
            ) : (
              <div className="empty">No recommendations available.</div>
            )}
          </section>
        </div>
      </>
    ) : (
      <div className="card empty">
        Analytics are not available for this account.
      </div>
    );
  else if (route === "data")
    body = (
      <div className="grid dashboard-grid">
        <section className="card">
          <h2>Export records</h2>
          <p className="muted">Download a CSV for your chosen records.</p>
          <div className="form-stack">
            {["members", "payments", "attendance"].map((t) => (
              <a
                className="button ghost"
                download={`${t}.csv`}
                href={`/api/export?type=${t}`}
                key={t}
              >
                ↓ Export {t}
              </a>
            ))}
          </div>
        </section>
        <section className="card">
          <h2>Import members</h2>
          <p className="muted">
            CSV columns: name, email, phone, source. Up to 500 rows and 1 MB.
          </p>
          <a
            className="button ghost"
            download="cordova-member-template.csv"
            href="data:text/csv;charset=utf-8,name%2Cemail%2Cphone%2Csource%0A"
            style={{ marginBottom: 16 }}
          >
            ↓ Download sample template
          </a>
          <ImportForm
            onImport={async (csv, preview) => {
              const result = await api(
                "/api/import",
                json("POST", { csv, preview }),
              );
              if (!preview && result.rows) {
                workspaceCache.invalidate();
                await load(true);
              }
              return result;
            }}
          />
        </section>
      </div>
    );
  else if (route === "staff" && user.role === "owner")
    body = (
      <>
        <div className="section-head">
          <p className="subtitle">
            Staff accounts sign in with email and a temporary password.
          </p>
          <button className="button primary" onClick={() => setModal("staff")}>
            ＋ Add staff
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Team member</th>
                <th>Email</th>
                <th>Access</th>
                <th>Account</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.staff.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.email}</td>
                  <td>Staff</td>
                  <td>Temporary password required on first sign-in</td>
                  <td>
                    <button
                      className="button ghost small-button"
                      onClick={async () => {
                        if (
                          !window.confirm(
                            `Reset the temporary password for ${s.name}? Their current password will stop working.`,
                          )
                        )
                          return;
                        setError("");
                        try {
                          const d = await api(
                            `/api/staff/${s.id}/reset-password`,
                            json("POST", {}),
                          );
                          setNotice(
                            `Temporary password for ${s.name}: ${d.temporaryPassword}`,
                          );
                          workspaceCache.invalidate();
                          await load(true);
                        } catch (e) {
                          setError(
                            e instanceof Error
                              ? e.message
                              : "Password reset failed",
                          );
                        }
                      }}
                    >
                      Reset password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  else if (route === "portal/payments" && user.role === "member")
    body = (
      <div className="card">
        <h2>Payment history</h2>
        <p className="muted">
          Records entered by gym staff. They do not represent gateway
          verification.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <td>{date(p.paidAt)}</td>
                  <td>{p.method.replace("_", " ")}</td>
                  <td>{php(p.amount)}</td>
                  <td>{p.reference || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  else if (route.startsWith("portal") || route === "profile") {
    const m =
      data.members.find((x) => x.id === user.memberId) || data.members[0];
    const membership = m && data.memberships.find((x) => x.memberId === m.id);
    if (!m)
      body = (
        <div className="card empty">
          Your member profile is not linked yet. Please contact gym staff.
        </div>
      );
    else if (route === "profile" || route === "portal/profile")
      body = (
        <div className="card">
          <h2>Profile details</h2>
          <p>{m.name}</p>
          <p className="muted">
            {m.email} · {m.phone}
          </p>
          <p className="muted">To update your details, please ask gym staff.</p>
        </div>
      );
    else
      body = (
        <>
          <div className="split">
            <section className="member-card">
              <span className="badge">
                {membership?.status || "No membership"}
              </span>
              <h2 style={{ fontSize: 30, margin: "22px 0 6px" }}>{m.name}</h2>
              <p style={{ color: "#cbd8cb" }}>Member · {m.memberCode}</p>
              <div className="pill-row">
                <span>
                  Plan:{" "}
                  {membership
                    ? planById(membership.planId)?.name || "Membership"
                    : "—"}
                </span>
                <span>
                  Expires: {membership ? date(membership.expiresAt) : "—"}
                </span>
              </div>
              <Link
                href="/portal/payments"
                className="button primary"
                style={{ marginTop: 23 }}
              >
                View payment history
              </Link>
              <Link
                href="/portal/profile"
                className="button ghost"
                style={{ margin: "12px 0 0" }}
              >
                Profile details
              </Link>
            </section>
            <MemberQR token={m.qrToken} code={m.memberCode} />
          </div>
          <div className="grid dashboard-grid" style={{ marginTop: 16 }}>
            <section className="card">
              <h2>Recent attendance</h2>
              {data.attendance.slice(0, 6).map((a) => (
                <p key={a.id} className="section-head">
                  <span>{date(a.checkedInAt)}</span>
                  <span className="muted">
                    {a.method === "qr" ? "QR check-in" : "Manual check-in"}
                  </span>
                </p>
              ))}
            </section>
            <section className="card">
              <h2>Recent payments</h2>
              {data.payments.slice(0, 6).map((p) => (
                <p key={p.id} className="section-head">
                  <span>
                    {date(p.paidAt)} · {p.method.replace("_", " ")}
                  </span>
                  <strong>{php(p.amount)}</strong>
                </p>
              ))}
            </section>
          </div>
        </>
      );
  } else
    body = (
      <div className="card empty">
        <h2>Page unavailable</h2>
        <p>That page doesn’t exist or isn’t available for your account.</p>
        <Link
          className="button ghost"
          href={user.role === "member" ? "/portal" : "/dashboard"}
        >
          Return to your workspace
        </Link>
      </div>
    );
  return (
    <div className="shell">
      <Nav role={user.role} />
      <main className="content">
        <div className="mobile-head">
          <div className="mobile-brand">
            <span className="brand-mark">↗</span>CORDOVA FIT HUB
          </div>
          <div className="pill-row">
            <span className="muted" aria-label={`Signed in as ${user.name}`}>
              {user.name}
            </span>
            <button className="button ghost small-button" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
        <PageTitle
          title={title}
          subtitle={
            route === "dashboard"
              ? `Good ${new Date().getHours() < 12 ? "morning" : "day"}, ${user.name.split(" ")[0]}. Here's what’s happening.`
              : undefined
          }
          action={
            <>
              <span
                className="muted desktop-action"
                aria-label={`Signed in as ${user.name}`}
              >
                {user.name}
              </span>
              <Link
                className="button ghost small-button desktop-action"
                href="/change-password"
              >
                Change password
              </Link>
              <button
                className="button ghost small-button desktop-action"
                onClick={logout}
              >
                Sign out
              </button>
            </>
          }
        />
        {data.isDemo && (
          <div className="demo-banner">
            <span className="demo-dot" />
            Synthetic demo data · Sample records are illustrative, not real gym
            activity.
          </div>
        )}
        {notice && (
          <div
            className="notice success"
            role="status"
            style={{ marginBottom: 15 }}
          >
            {notice}
          </div>
        )}
        {error && (
          <div className="notice" role="alert" style={{ marginBottom: 15 }}>
            {error}
            <button
              className="icon-button"
              style={{ marginLeft: 10 }}
              onClick={() => setError("")}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}
        {loading && (
          <span
            className="muted"
            role="status"
            data-testid="workspace-refresh-indicator"
          >
            Refreshing workspace…
          </span>
        )}
        <button
          className="button ghost small-button"
          aria-label="Refresh workspace"
          onClick={() => load(true)}
        >
          Refresh
        </button>
        {body}
      </main>
      {modal === "register" && (
        <Modal
          title="Register a member"
          close={() => setModal("")}
          error={error}
        >
          {memberForm}
        </Modal>
      )}
      {modal === "payment" && (
        <Modal
          title="Record a payment"
          close={() => setModal("")}
          error={error}
        >
          {paymentForm}
        </Modal>
      )}
      {(modal === "plan" || modal === "edit-plan") && (
        <Modal
          title={
            modal === "plan" ? "Add a membership plan" : "Edit membership plan"
          }
          close={() => setModal("")}
          error={error}
        >
          <form
            className="form-stack"
            onSubmit={formSubmit(
              modal === "plan" ? "/api/plans" : `/api/plans/${selected?.id}`,
              modal === "plan" ? "POST" : "PATCH",
              modal === "plan" ? "Plan created." : "Plan updated.",
            )}
          >
            <label>
              Plan name
              <input
                name="name"
                required
                defaultValue={
                  modal === "edit-plan"
                    ? planById(selected?.id || "")?.name
                    : ""
                }
                placeholder="e.g. Quarterly access"
              />
            </label>
            <label>
              Duration
              <select
                name="durationMonths"
                defaultValue={
                  modal === "edit-plan"
                    ? planById(selected?.id || "")?.durationMonths
                    : 1
                }
              >
                <option value="1">1 month</option>
                <option value="3">3 months</option>
                <option value="12">12 months</option>
              </select>
            </label>
            <label>
              Price (PHP)
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={
                  modal === "edit-plan"
                    ? planById(selected?.id || "")?.price
                    : ""
                }
              />
            </label>
            <button className="button primary" disabled={busy}>
              {busy
                ? "Saving…"
                : modal === "plan"
                  ? "Create plan"
                  : "Save plan"}
            </button>
          </form>
        </Modal>
      )}
      {modal === "staff" && (
        <Modal
          title="Add staff member"
          close={() => setModal("")}
          error={error}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setBusy(true);
              const fd = new FormData(e.currentTarget);
              try {
                const d = await api(
                  "/api/staff",
                  json("POST", {
                    ...Object.fromEntries(fd.entries()),
                    role: "staff",
                  }),
                );
                setNotice(
                  `Staff account created. Temporary password: ${d.temporaryPassword}`,
                );
                setModal("");
                workspaceCache.invalidate();
                await load(true);
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Could not create staff account.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Full name
              <input name="name" required />
            </label>
            <label>
              Email address
              <input name="email" type="email" required />
            </label>
            <p className="muted">
              Staff receive a temporary password and must change it before
              continuing. The temporary password will be shown once after
              account creation.
            </p>
            <button className="button primary" disabled={busy}>
              {busy ? "Creating…" : "Create staff account"}
            </button>
          </form>
        </Modal>
      )}
      {modal === "member" && selected && (
        <Modal title={selected.name} close={() => setModal("")} error={error}>
          <p>
            Member code · <strong>{selected.memberCode}</strong>
          </p>
          <p>
            {selected.email || "No email"} · {selected.phone}
          </p>
          <p className="muted">Source: {selected.source || "—"}</p>
          <h3>Memberships</h3>
          {data.memberships
            .filter((x) => x.memberId === selected.id)
            .map((x) => (
              <p key={x.id}>
                {planById(x.planId)?.name || "Membership"} · {x.status} ·{" "}
                {date(x.startsAt)} – {date(x.expiresAt)} · Paid{" "}
                {php(x.paidAmount)} / {php(x.price)}
              </p>
            ))}
          <h3>Payments</h3>
          {data.payments
            .filter((x) => x.memberId === selected.id)
            .map((x) => (
              <p key={x.id}>
                {date(x.paidAt)} · {x.method.replace("_", " ")} ·{" "}
                {php(x.amount)} {x.reference && `· ${x.reference}`}
              </p>
            ))}
          <h3>Attendance</h3>
          {data.attendance
            .filter((x) => x.memberId === selected.id)
            .slice(0, 8)
            .map((x) => (
              <p key={x.id}>
                {new Intl.DateTimeFormat("en-PH", {
                  timeZone: "Asia/Manila",
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(x.checkedInAt))}{" "}
                · {x.method}
              </p>
            ))}
          <div className="form-stack">
            <button
              className="button primary"
              onClick={() => setModal("renew")}
            >
              Renew membership
            </button>
            <button
              className="button ghost"
              onClick={() => {
                setModal("edit");
              }}
            >
              Edit contact details
            </button>
          </div>
        </Modal>
      )}
      {modal === "edit" && selected && (
        <Modal
          title="Edit member details"
          close={() => setModal("")}
          error={error}
        >
          <form
            className="form-stack"
            onSubmit={formSubmit(
              `/api/members/${selected.id}`,
              "PATCH",
              "Member details updated.",
            )}
          >
            <label>
              Full name
              <input name="name" required defaultValue={selected.name} />
            </label>
            <label>
              Phone
              <input name="phone" required defaultValue={selected.phone} />
            </label>
            <label>
              Source
              <input name="source" defaultValue={selected.source} />
            </label>
            <button className="button primary" disabled={busy}>
              {busy ? "Saving…" : "Save details"}
            </button>
          </form>
        </Modal>
      )}
      {modal === "renew" && selected && (
        <Modal title={`Renew ${selected.name}`} close={() => setModal("")}>
          <form
            className="form-stack"
            onSubmit={formSubmit(
              `/api/members/${selected.id}/renew`,
              "POST",
              "Membership renewed.",
            )}
          >
            <input type="hidden" name="idempotencyKey" value={renewalKey} />
            <label>
              Plan
              <select name="planId" required>
                {data.plans
                  .filter((p) => p.active)
                  .map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name} · {php(p.price)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Amount received (PHP)
              <input name="amountPaid" type="number" min="0" required />
            </label>
            <label>
              Payment method
              <select name="paymentMethod">
                <option value="cash">Cash</option>
                <option value="gcash">GCash</option>
                <option value="bank_transfer">Bank transfer</option>
              </select>
            </label>
            <label>
              Reference (optional)
              <input name="reference" />
            </label>
            <p className="muted">
              Payment is recorded manually; it is not gateway verified.
            </p>
            <button className="button primary" disabled={busy}>
              Confirm renewal
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function MemberQR({ token, code }: { token?: string; code: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (token)
      QRCode.toDataURL(token, { width: 300, margin: 1 })
        .then(setSrc)
        .catch(() => setSrc(""));
  }, [token]);
  return (
    <section className="card" style={{ textAlign: "center" }}>
      <h2>Member check-in QR</h2>
      <p className="muted">Show this to staff at the desk.</p>
      {src ? (
        <div className="qr-box">
          <img src={src} alt="Your member check-in QR code" />
        </div>
      ) : (
        <div className="empty">
          QR code isn’t available. Staff can look up your member code.
        </div>
      )}
      <p style={{ margin: "12px 0 0" }}>
        <strong>{code}</strong>
      </p>
    </section>
  );
}
function PaymentForm({
  members,
  memberships,
  memberById,
  onSubmit,
  busy,
}: {
  members: Member[];
  memberships: Membership[];
  memberById: (id: string) => Member | undefined;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  busy: boolean;
}) {
  const [memberId, setMemberId] = useState(members[0]?.id || "");
  const eligible = memberships.filter((m) => m.memberId === memberId);
  const [membershipId, setMembershipId] = useState(eligible[0]?.id || "");
  useEffect(() => {
    setMembershipId(eligible[0]?.id || "");
  }, [memberId]);
  const m = memberships.find((x) => x.id === membershipId);
  const balance = m ? Math.max(0, m.price - m.paidAmount) : null;
  return (
    <form className="form-stack" onSubmit={onSubmit}>
      <label>
        Member
        <select
          name="memberId"
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          required
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · {m.memberCode}
            </option>
          ))}
        </select>
      </label>
      <label>
        Membership
        <select
          name="membershipId"
          value={membershipId}
          onChange={(e) => setMembershipId(e.target.value)}
          required
          disabled={!eligible.length}
        >
          {eligible.map((m) => (
            <option key={m.id} value={m.id}>
              {date(m.startsAt)} – {date(m.expiresAt)} · Balance{" "}
              {php(Math.max(0, m.price - m.paidAmount))}
            </option>
          ))}
        </select>
      </label>
      {!eligible.length ? (
        <div className="notice">
          This member has no membership to attach a payment to.
        </div>
      ) : (
        balance !== null && (
          <p className="muted">
            Outstanding balance: <strong>{php(balance)}</strong>
          </p>
        )
      )}
      <div className="form-grid">
        <label>
          Amount (PHP)
          <input name="amount" type="number" required min="0.01" step="0.01" />
        </label>
        <label>
          Method
          <select name="method">
            <option value="cash">Cash</option>
            <option value="gcash">GCash</option>
            <option value="bank_transfer">Bank transfer</option>
          </select>
        </label>
      </div>
      <label>
        Reference (optional)
        <input name="reference" />
      </label>
      <p className="muted">
        This records a manual payment only; it does not verify a GCash or bank
        transaction.
      </p>
      <button className="button primary" disabled={busy || !eligible.length}>
        {busy ? "Saving…" : "Record payment"}
      </button>
    </form>
  );
}

function ImportForm({
  onImport,
}: {
  onImport: (csv: string, preview: boolean) => Promise<any>;
}) {
  const [file, setFile] = useState<File | null>(null),
    [result, setResult] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(preview: boolean) {
    if (!file) return;
    setError("");
    if (file.size > 1024 * 1024) {
      setError("File exceeds the 1 MB limit.");
      return;
    }
    setBusy(true);
    try {
      const csv = await file.text();
      const d = await onImport(csv, preview);
      setResult(d);
      if (!preview && d.rows) {
        setFile(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="form-stack">
      <label>
        Choose CSV
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setResult(null);
          }}
        />
      </label>
      <div className="pill-row">
        <button
          type="button"
          className="button ghost"
          disabled={!file || busy}
          onClick={() => run(true)}
        >
          {busy ? "Checking…" : "Preview import"}
        </button>
        {result && (
          <button
            type="button"
            className="button primary"
            disabled={busy || !!result.errors?.length}
            onClick={() => run(false)}
          >
            Import {result.rows} rows
          </button>
        )}
      </div>
      {error && (
        <div className="notice" role="alert">
          {error}
        </div>
      )}
      {result && (
        <div className="notice success">
          {result.rows} rows checked. {result.errors?.length || 0} issue(s).
          {result.errors?.slice(0, 6).map((x: any, i: number) => (
            <div key={i}>
              Row {x.row}: {x.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function Checkin({
  onResult,
  busy,
}: {
  onResult: (code: string, method: "qr" | "manual") => void;
  busy: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null),
    reader = useRef<BrowserMultiFormatReader | null>(null),
    controls = useRef<any>(null);
  const [manual, setManual] = useState(""),
    [scanning, setScanning] = useState(false),
    [cameraError, setCameraError] = useState("");
  const stop = useCallback(() => {
    controls.current?.stop();
    controls.current = null;
    const v = video.current;
    if (v?.srcObject instanceof MediaStream) {
      v.srcObject.getTracks().forEach((track) => track.stop());
      v.srcObject = null;
    }
    reader.current = null;
    setScanning(false);
  }, []);
  useEffect(
    () => () => {
      controls.current?.stop();
      const v = video.current;
      if (v?.srcObject instanceof MediaStream)
        v.srcObject.getTracks().forEach((track) => track.stop());
      reader.current = null;
    },
    [],
  );
  async function start() {
    setCameraError("");
    try {
      const instance = new BrowserMultiFormatReader();
      reader.current = instance;
      setScanning(true);
      const control = await instance.decodeFromVideoDevice(
        undefined,
        video.current!,
        (result) => {
          if (result) {
            const raw = result.getText();
            controls.current?.stop();
            onResult(raw, "qr");
            stop();
          }
        },
      );
      if (reader.current !== instance) {
        control.stop();
        return;
      }
      controls.current = control;
    } catch (e) {
      setScanning(false);
      const v = video.current;
      if (v?.srcObject instanceof MediaStream)
        v.srcObject.getTracks().forEach((track) => track.stop());
      setCameraError(
        e instanceof Error
          ? e.message
          : "Camera unavailable. Use manual check-in instead.",
      );
    }
  }
  return (
    <div className="grid dashboard-grid">
      <section className="card">
        <h2>Scan member QR</h2>
        <p className="muted">
          Staff only · A valid active, fully paid membership is required.
        </p>
        <video
          ref={video}
          style={{
            width: "100%",
            maxHeight: 320,
            background: "#142820",
            borderRadius: 12,
            display: scanning ? "block" : "none",
          }}
          muted
          playsInline
        />
        <div className="pill-row" style={{ marginTop: 14 }}>
          {!scanning ? (
            <button className="button primary" onClick={start}>
              Start camera
            </button>
          ) : (
            <button className="button ghost" onClick={stop}>
              Stop camera
            </button>
          )}
        </div>
        {cameraError && (
          <div className="notice" role="alert" style={{ marginTop: 12 }}>
            {cameraError}
          </div>
        )}
      </section>
      <section className="card">
        <h2>Manual check-in</h2>
        <p className="muted">
          Use the member code if camera access isn’t available.
        </p>
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            onResult(manual, "manual");
          }}
        >
          <label>
            Member code
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              required
              placeholder="e.g. CFH-001"
              autoCapitalize="characters"
            />
          </label>
          <button className="button primary" disabled={busy || !manual.trim()}>
            {busy ? "Checking…" : "Check in member"}
          </button>
        </form>
      </section>
    </div>
  );
}
