import type { BootstrapData } from "../contracts";

export const WORKSPACE_TTL = 30_000;
type Snapshot = {
  data: BootstrapData | null;
  updatedAt: number;
  refreshing: boolean;
  error: string;
};
const empty = (): Snapshot => ({
  data: null,
  updatedAt: 0,
  refreshing: false,
  error: "",
});
const serverSnapshot = empty();
export const getServerWorkspaceSnapshot = () => serverSnapshot;

/** Process-local only: workspace data is never persisted to browser storage. */
export class WorkspaceCache {
  private snapshot: Snapshot = empty();
  private generation = 0;
  private flight: Promise<BootstrapData | null> | null = null;
  private listeners = new Set<() => void>();
  private invalid = true;
  constructor(private readonly now = () => Date.now()) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private emit() {
    this.listeners.forEach((listener) => listener());
  }
  clear() {
    this.generation++;
    this.flight = null;
    this.snapshot = empty();
    this.emit();
  }
  invalidate() {
    this.generation++;
    this.flight = null;
    this.invalid = true;
    this.snapshot = { ...this.snapshot, updatedAt: 0 };
    this.emit();
  }
  async load(
    fetcher: () => Promise<BootstrapData>,
    force = false,
  ): Promise<BootstrapData | null> {
    if (
      !force &&
      !this.invalid &&
      this.snapshot.data &&
      this.now() - this.snapshot.updatedAt < WORKSPACE_TTL
    )
      return this.snapshot.data;
    if (this.flight) return this.flight;
    const generation = this.generation;
    this.snapshot = { ...this.snapshot, refreshing: true, error: "" };
    this.emit();
    const flight = fetcher()
      .then((data) => {
        if (generation !== this.generation) return null;
        this.invalid = false;
        this.snapshot = {
          data,
          updatedAt: this.now(),
          refreshing: false,
          error: "",
        };
        this.emit();
        return data;
      })
      .catch((error: unknown) => {
        if (generation !== this.generation) return null;
        const message =
          error instanceof Error ? error.message : "Unable to load workspace.";
        if (
          error instanceof HttpError &&
          (error.status === 401 || error.status === 403)
        ) {
          this.invalid = true;
          this.snapshot = empty();
        } else
          this.snapshot = {
            ...this.snapshot,
            refreshing: false,
            error: message,
          };
        this.emit();
        if (generation !== this.generation) return null;
        throw error;
      })
      .finally(() => {
        if (this.flight === flight) this.flight = null;
      });
    this.flight = flight;
    return flight;
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const workspaceCache = new WorkspaceCache();

export function broadcastWorkspaceBoundary() {
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("workspace-session");
      channel.postMessage({ type: "boundary" });
      channel.close();
    }
  } catch {
    /* unsupported browser context */
  }
}
