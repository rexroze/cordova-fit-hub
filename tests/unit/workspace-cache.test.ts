import { describe, expect, it, vi } from "vitest";
import { WorkspaceCache, HttpError } from "../../lib/client/workspace-cache";
import type { BootstrapData } from "../../lib/contracts";

const value = (id: string) => ({ user: { id } }) as BootstrapData;
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((r, j) => {
    resolve = r;
    reject = j;
  });
  return { promise, resolve, reject };
};

describe("workspace cache", () => {
  it("deduplicates concurrent loads and reuses fresh data", async () => {
    const c = new WorkspaceCache(() => 10);
    const d = deferred<BootstrapData>();
    const f = vi.fn(() => d.promise);
    const a = c.load(f);
    const b = c.load(f);
    d.resolve(value("a"));
    await expect(a).resolves.toEqual(value("a"));
    await expect(b).resolves.toEqual(value("a"));
    await expect(c.load(f)).resolves.toEqual(value("a"));
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("keeps stale snapshot while refreshing, and ignores responses after clear", async () => {
    let time = 1;
    const c = new WorkspaceCache(() => time);
    await c.load(async () => value("a"));
    time += 30_001;
    const d = deferred<BootstrapData>();
    const p = c.load(() => d.promise);
    expect(c.getSnapshot().data?.user.id).toBe("a");
    c.clear();
    d.resolve(value("old"));
    await p;
    expect(c.getSnapshot().data).toBeNull();
  });
  it("invalidates, replaces account data, and retains data on network errors", async () => {
    const c = new WorkspaceCache(() => 10);
    await c.load(async () => value("a"));
    c.invalidate();
    await c.load(async () => value("b"));
    expect(c.getSnapshot().data?.user.id).toBe("b");
    c.invalidate();
    await expect(
      c.load(async () => {
        throw new Error("offline");
      }),
    ).rejects.toThrow("offline");
    expect(c.getSnapshot().data?.user.id).toBe("b");
  });
  it("clears on authentication errors", async () => {
    const c = new WorkspaceCache();
    await c.load(async () => value("a"));
    c.invalidate();
    await expect(
      c.load(async () => {
        throw new HttpError(401, "Unauthorized");
      }),
    ).rejects.toThrow();
    expect(c.getSnapshot().data).toBeNull();
  });
  it("does not let an invalidated in-flight read overwrite a mutation refresh", async () => {
    const c = new WorkspaceCache(() => 10);
    const old = deferred<BootstrapData>();
    const pending = c.load(() => old.promise);
    c.invalidate();
    await c.load(async () => value("mutated"), true);
    old.resolve(value("stale"));
    await pending;
    expect(c.getSnapshot().data?.user.id).toBe("mutated");
  });
  it("does not let a delayed old-account 401 erase newly loaded account data", async () => {
    const c = new WorkspaceCache();
    const old = deferred<BootstrapData>();
    const pending = c.load(() => old.promise);
    c.clear();
    await c.load(async () => value("new"));
    old.reject(new HttpError(401, "Unauthorized"));
    await expect(pending).resolves.toBeNull();
    expect(c.getSnapshot().data?.user.id).toBe("new");
  });
});
