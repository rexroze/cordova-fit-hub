import "../app/skeleton.css";

type WorkspaceSkeletonProps = { route: string };

function Block({ className = "" }: { className?: string }) {
  return (
    <span className={`ws-skeleton-block ${className}`} aria-hidden="true" />
  );
}

function Metrics() {
  return (
    <div className="ws-skeleton-metrics" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <div className="ws-skeleton-card" key={i}>
          <Block className="ws-skeleton-label" />
          <Block className="ws-skeleton-number" />
          <Block className="ws-skeleton-caption" />
        </div>
      ))}
    </div>
  );
}

function TableShape({ rows = 6 }: { rows?: number }) {
  return (
    <div className="ws-skeleton-table" aria-hidden="true">
      <div className="ws-skeleton-table-head">
        {["wide", "short", "medium", "short"].map((w, i) => (
          <Block className={`ws-skeleton-cell-${w}`} key={i} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div className="ws-skeleton-table-row" key={i}>
          <div className="ws-skeleton-person">
            <Block className="ws-skeleton-avatar" />
            <Block className="ws-skeleton-cell-wide" />
          </div>
          <Block className="ws-skeleton-cell-short" />
          <Block className="ws-skeleton-cell-medium" />
          <Block className="ws-skeleton-cell-short" />
        </div>
      ))}
    </div>
  );
}

function DashboardShape({ analytics = false }: { analytics?: boolean }) {
  return (
    <>
      <Metrics />
      <div className="ws-skeleton-columns">
        <section className="ws-skeleton-card">
          <Block className="ws-skeleton-heading" />
          <Block className="ws-skeleton-chart" />
        </section>
        <section className="ws-skeleton-card">
          <Block className="ws-skeleton-heading" />
          <Block className="ws-skeleton-chart ws-skeleton-chart-small" />
        </section>
      </div>
      {analytics && (
        <div className="ws-skeleton-columns">
          <section className="ws-skeleton-card">
            <Block className="ws-skeleton-heading" />
            <Block className="ws-skeleton-chart" />
          </section>
          <section className="ws-skeleton-card">
            <Block className="ws-skeleton-heading" />
            <Block className="ws-skeleton-chart" />
          </section>
        </div>
      )}
    </>
  );
}

function PortalShape() {
  return (
    <>
      <div className="ws-skeleton-columns ws-skeleton-portal">
        <section className="ws-skeleton-member-card">
          <Block className="ws-skeleton-label" />
          <Block className="ws-skeleton-name" />
          <Block className="ws-skeleton-caption" />
          <Block className="ws-skeleton-pill" />
        </section>
        <section className="ws-skeleton-card ws-skeleton-qr">
          <Block className="ws-skeleton-heading" />
          <Block className="ws-skeleton-qr-box" />
          <Block className="ws-skeleton-label" />
        </section>
      </div>
      <div className="ws-skeleton-columns">
        <section className="ws-skeleton-card">
          <Block className="ws-skeleton-heading" />
          <TableShape rows={3} />
        </section>
        <section className="ws-skeleton-card">
          <Block className="ws-skeleton-heading" />
          <TableShape rows={3} />
        </section>
      </div>
    </>
  );
}

function ProfileShape() {
  return (
    <section
      className="ws-skeleton-card ws-skeleton-profile"
      aria-hidden="true"
    >
      <Block className="ws-skeleton-heading" />
      <div className="ws-skeleton-profile-row">
        <Block className="ws-skeleton-avatar ws-skeleton-profile-avatar" />
        <div>
          <Block className="ws-skeleton-name" />
          <Block className="ws-skeleton-caption" />
        </div>
      </div>
      <div className="ws-skeleton-profile-fields">
        <Block className="ws-skeleton-profile-field" />
        <Block className="ws-skeleton-profile-field" />
      </div>
    </section>
  );
}

function PlanGrid() {
  return (
    <div className="ws-skeleton-plan-grid" aria-hidden="true">
      {Array.from({ length: 3 }, (_, i) => (
        <section className="ws-skeleton-card" key={i}>
          <Block className="ws-skeleton-label" />
          <Block className="ws-skeleton-heading ws-skeleton-plan-name" />
          <Block className="ws-skeleton-number" />
          <Block className="ws-skeleton-caption" />
          <Block className="ws-skeleton-action" />
        </section>
      ))}
    </div>
  );
}

function CheckinShape() {
  return (
    <div className="ws-skeleton-columns ws-skeleton-checkin" aria-hidden="true">
      <section className="ws-skeleton-card">
        <Block className="ws-skeleton-heading" />
        <Block className="ws-skeleton-subtitle" />
        <Block className="ws-skeleton-scanner" />
        <Block className="ws-skeleton-action" />
      </section>
      <section className="ws-skeleton-card">
        <Block className="ws-skeleton-heading" />
        <Block className="ws-skeleton-subtitle" />
        <Block className="ws-skeleton-form-field" />
        <Block className="ws-skeleton-action" />
      </section>
    </div>
  );
}

function DataShape() {
  return (
    <div className="ws-skeleton-columns ws-skeleton-data" aria-hidden="true">
      <section className="ws-skeleton-card">
        <Block className="ws-skeleton-heading" />
        <Block className="ws-skeleton-subtitle" />
        <Block className="ws-skeleton-action" />
        <Block className="ws-skeleton-action" />
        <Block className="ws-skeleton-action" />
      </section>
      <section className="ws-skeleton-card">
        <Block className="ws-skeleton-heading" />
        <Block className="ws-skeleton-subtitle" />
        <Block className="ws-skeleton-form-field" />
        <Block className="ws-skeleton-action" />
        <Block className="ws-skeleton-caption" />
      </section>
    </div>
  );
}

export default function WorkspaceSkeleton({ route }: WorkspaceSkeletonProps) {
  const segments = route.split("/").filter(Boolean);
  const routePath = segments.join("/");
  const view = segments.at(-1) || "dashboard";
  const heading =
    view === "portal"
      ? "Your Fit Hub"
      : (
          {
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
            profile: "Your profile",
          } as Record<string, string>
        )[view] || "Your workspace";
  const tableView = [
    "members",
    "payments",
    "attendance",
    "renewals",
    "staff",
  ].includes(view);
  const portalRoot = routePath === "portal";
  return (
    <div
      className="ws-skeleton-root"
      data-testid="workspace-skeleton"
      role="status"
      aria-label="Loading workspace"
    >
      <span className="ws-skeleton-sr-only">Loading workspace</span>
      <div className="ws-skeleton-shell" aria-hidden="true">
        <aside className="ws-skeleton-sidebar">
          <Block className="ws-skeleton-brand" />
          <Block className="ws-skeleton-nav" />
          <Block className="ws-skeleton-nav" />
          <Block className="ws-skeleton-nav" />
          <Block className="ws-skeleton-nav" />
          <Block className="ws-skeleton-user" />
        </aside>
        <main className="ws-skeleton-main">
          <div className="ws-skeleton-top">
            <div>
              <Block className="ws-skeleton-crumb" />
              <h1>{heading}</h1>
              <Block className="ws-skeleton-subtitle" />
            </div>
            <Block className="ws-skeleton-top-button" />
          </div>
          {portalRoot ? (
            <PortalShape />
          ) : view === "profile" ? (
            <ProfileShape />
          ) : tableView ? (
            <>
              <div className="ws-skeleton-toolbar">
                <Block className="ws-skeleton-search" />
                <Block className="ws-skeleton-action" />
              </div>
              <TableShape rows={7} />
            </>
          ) : view === "analytics" ? (
            <DashboardShape analytics />
          ) : view === "plans" ? (
            <PlanGrid />
          ) : view === "check-in" ? (
            <CheckinShape />
          ) : view === "data" ? (
            <DataShape />
          ) : (
            <DashboardShape />
          )}
        </main>
      </div>
    </div>
  );
}
