"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  CalendarDays,
  CreditCard,
  Dumbbell,
  FileSpreadsheet,
  House,
  Menu,
  QrCode,
  RefreshCw,
  Settings,
  Shield,
  UserRound,
  Users,
  X,
} from "lucide-react";

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Dumbbell size={20} />
      </span>
      <span>
        CORDOVA
        <br />
        <small
          style={{ fontSize: 10, letterSpacing: ".14em", fontWeight: 600 }}
        >
          FIT HUB
        </small>
      </span>
    </div>
  );
}
export const navItems = [
  ["Dashboard", "/dashboard", House],
  ["Members", "/members", Users],
  ["Plans", "/plans", Dumbbell],
  ["Renewals", "/renewals", RefreshCw],
  ["Payments", "/payments", CreditCard],
  ["Check-in", "/check-in", QrCode],
  ["Attendance", "/attendance", CalendarDays],
  ["Analytics", "/analytics", BarChart3],
  ["Data & CSV", "/data", FileSpreadsheet],
  ["Staff", "/staff", Shield],
] as const;
export function Nav({ role }: { role: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const items =
    role === "member"
      ? ([
          ["My portal", "/portal", House],
          ["Payments", "/portal/payments", CreditCard],
          ["Profile", "/portal/profile", UserRound],
        ] as const)
      : navItems.filter((x) => role === "owner" || x[1] !== "/staff");
  const primary =
    role === "member"
      ? items.slice(0, 3)
      : [items[0], items[1], items[4], items[5]];
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const links = (arr: readonly (readonly [string, string, typeof House])[]) =>
    arr.map(([t, h, Icon]) => (
      <Link
        onClick={() => setOpen(false)}
        className={`nav-link ${path === h ? "active" : ""}`}
        href={h}
        key={h}
      >
        <span className="nav-icon">
          <Icon size={17} strokeWidth={1.8} />
        </span>
        {t}
      </Link>
    ));
  return (
    <>
      <aside className="sidebar">
        <Brand />
        <div>
          <p className="nav-label">Workspace</p>
          <nav className="nav-list">{links(items)}</nav>
        </div>
        <div className="sidebar-bottom">
          <p className="nav-label">CORDOVA FIT HUB · PH</p>
        </div>
      </aside>
      <nav className="mobile-nav">
        {primary.map(([t, h, Icon]) => (
          <Link
            aria-current={path === h ? "page" : undefined}
            className={path === h ? "active" : ""}
            href={h}
            key={h}
          >
            <span className="nav-icon">
              <Icon size={18} />
            </span>
            {t}
          </Link>
        ))}
        <button
          aria-expanded={open}
          aria-controls="more-navigation"
          onClick={() => setOpen(true)}
        >
          <span className="nav-icon">
            <Menu size={18} />
          </span>
          More
        </button>
      </nav>
      {open && (
        <div
          className="drawer-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <section
            id="more-navigation"
            className="nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
          >
            <div className="section-head">
              <h2>Go to</h2>
              <button
                className="icon-button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="nav-list">{links(items)}</nav>
            <Link
              className="nav-link"
              href={role === "member" ? "/portal/profile" : "/change-password"}
              onClick={() => setOpen(false)}
            >
              <span className="nav-icon">
                <Settings size={17} />
              </span>
              {role === "member" ? "Profile & security" : "Change password"}
            </Link>
          </section>
        </div>
      )}
    </>
  );
}
export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="topbar">
      <div>
        <div className="breadcrumb">
          CORDOVA FIT HUB <span aria-hidden="true"> / </span> WORKSPACE
        </div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      <div className="top-actions">{action}</div>
    </div>
  );
}
export function Modal({
  title,
  close,
  children,
  error,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  error?: string;
}) {
  const ref = useRef<HTMLElement>(null),
    closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  }, [close]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    node?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab" && node) {
        const els = [
          ...node.querySelectorAll<HTMLElement>(
            'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
          ),
        ];
        if (!els.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>
        {error && (
          <div className="notice" role="alert" style={{ marginBottom: 15 }}>
            {error}
          </div>
        )}
        {children}
      </section>
    </div>
  );
}
