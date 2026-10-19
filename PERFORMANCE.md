# Workspace loading and cache policy

## Measured baseline

Before this change, a single remote Chromium run against the deployed application showed a sequential `/api/auth/me` → `/api/bootstrap` waterfall on entry **and on every workspace route change**.

| Scenario | Session requests | Bootstrap requests | Observed heading time |
| --- | ---: | ---: | ---: |
| Login to dashboard | 1 | 1 | 2,851 ms from sign-in click |
| Dashboard to Members | 1 | 1 | 1,810 ms |
| Members to Payments | 1 | 1 | 1,820 ms |
| Payments to Dashboard | 1 | 1 | 1,812 ms |

The three-navigation cycle repeated six API requests within 30 seconds. Each bootstrap transferred approximately 38 KB of encoded data. These timings are observations from one network session, not a latency guarantee or a statistically established percentile.

## Intended behavior

- **Cold entry:** show a route-shaped skeleton while fetching the authorized bootstrap once. Bootstrap already contains the user, so a normal entry does not need a preceding session request.
- **Warm navigation:** reuse the current account's in-memory snapshot for 30 seconds. Switching between workspace views within that window should not fetch the same bootstrap again.
- **Stale refresh:** retain the last good content while fetching current data in the background. Refresh on stale navigation, tab focus/visibility, or network reconnection. The manual refresh control bypasses freshness.
- **Mutations:** invalidate and refresh after a successful write. Generation checks prevent an older read from overwriting the post-write snapshot.
- **Errors:** a network failure may retain previously loaded data with a visible warning. An authentication failure must clear it and require appropriate sign-in/password-change handling.
- **Account boundaries:** clear the cache on login, logout, and password change. Cross-tab session-boundary notifications contain no member data or credentials.
- **Persistence:** none. No member or payment payloads are stored in localStorage, sessionStorage, IndexedDB, or a service-worker cache. A hard reload starts a new in-memory cache.
- **Reporting:** reports currently share the same 30-second bootstrap policy; there is no separate five-minute reporting cache.

HTTP responses containing authenticated data retain their private/no-store policy. Client-side reuse does not authorize a payment, change permissions, or grant gym access: the server rechecks every operation against current records.

## Evidence path

`tests/unit/workspace-cache.test.ts` covers freshness, deduplication, invalidation, and response ordering. `tests/e2e/cache-performance.spec.ts` exercises delayed first-load skeletons, zero-request warm navigation, background refresh, mutation visibility, session/account isolation, cross-tab logout, expired sessions, and network failures. It also checks the public landing page without fetching private workspace data.

## Local integration results

- TypeScript, lint error checks, optimized production build, and **11 unit tests** passed.
- The **18 browser/API scenarios** passed across the complete local run and the focused rerun correcting a test selector.
- A cold authorized entry issued **one bootstrap request and no preceding session request**.
- Three warm navigations issued **zero bootstrap and zero session requests**. Their combined observed time was **304 ms** against the local production build. This is not directly comparable with the remote baseline's network timings.
- Background refresh retained content; successful member registration updated the cached list; cross-tab logout and owner-to-member switching cleared prior account data; an expired session redirected to login; simulated network failure retained data with a warning.
- Landing images loaded successfully at 360, 768, and 1440 pixels with no horizontal viewport overflow or private bootstrap requests. Visual review found no launch-blocking issues.

The deployed build is checked separately before handoff. A skeleton alone is not evidence of reduced data-fetching cost.
