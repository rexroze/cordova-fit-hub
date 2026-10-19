# Deployment and validation handoff

## Resources

- App: https://cordova-fit-hub.vercel.app
- Private source repository: https://github.com/rexroze/cordova-fit-hub
- Vercel project: `cordova-fit-hub`, team `rexrozes-projects`; GitHub repository connected.
- Neon project: `cordova-fit-hub` (`dark-math-93605759`), `aws-us-east-2`.
- Vercel functions: `iad1`, close to the database. The business calendar remains Asia/Manila regardless of infrastructure region.

The first deployment was automatically assigned to Vercel Production and given the stable app domain. Vercel SSO protection is disabled only for this project so the login page is reachable without a Vercel account; application authentication and server-side permissions remain enforced.

## Evidence established

| Claim | Evidence |
| --- | --- |
| Code type-checks | `npm run typecheck` passed after integration fixes |
| Core calculations, permissions, and cache behavior | 11 unit tests passed: five domain tests plus six cache freshness, deduplication, invalidation, error, and stale-response tests |
| Lint has no errors | `npm run lint -- --quiet` passed; nonblocking type/style warnings remain |
| Production build works | Local optimized build and Vercel build both passed |
| Deployed workflows work | All **18 Playwright tests passed against https://cordova-fit-hub.vercel.app**, with no skipped tests |
| Workspace navigation avoids redundant data requests | One cold bootstrap without a preceding session request; three warm navigations made zero bootstrap/session calls within the 30-second freshness window; see `PERFORMANCE.md` |
| Cached data remains isolated and fresh after changes | Background refresh preserves content; member registration refreshes cached lists; logout/account switching and cross-tab logout clear prior data; session expiry clears the cache; network failures retain content with a warning |
| Public landing page works | Locally hosted licensed photography loads at 360/768/1440px, sign-in links work, no private bootstrap is fetched, and source/license attribution is available in the public footer |
| Responsive operation | Owner, staff, and member browser login/navigation tested at 360, 390, 768, and 1440 CSS pixels; no horizontal page overflow in these views |
| Member QR is usable on mobile | Browser assertion verified the entire QR fits above fixed navigation after scrolling; visual review confirmed contrast and unobstructed QR margin |
| Role boundaries hold | Owner/staff/member bootstrap scopes, forbidden member writes/exports, staff pricing restrictions, invalid-Origin rejection |
| Financial workflows hold | Unpaid registration, rejection of overpayment/negative payments/mismatched memberships, concurrent-payment protection, paid QR check-in and duplicate rejection, future renewal and idempotent retry |
| CSV workflow works | Repeatable read-only preview, invalid headers, duplicate-row rejection, transactional commit, existing-email detection, first membership after import |
| First-login behavior works | Disposable member forced to change password; rotated session remains usable afterward; original handoff member retains mandatory first-login change |
| Three handoff logins work | Each account authenticated against the deployed app; role and mandatory-change flags checked; secure HTTP-only production session cookies confirmed |
| Demonstration data exists | 72 baseline fictional members, plus synthetic QA records; payment history spans multiple months; attendance's stored business date matches its Manila timestamp |
| Seed is repeatable | Seed rerun detected its completion marker and left existing accounts unchanged |
| Runtime dependency audit | `npm audit --omit=dev` reported **0 vulnerabilities** |
| Repository is private | Confirmed with GitHub CLI; private environment files and generated artifacts are ignored; staged contents checked against actual secret values before committing |

Browser tests create synthetic records and plans in the demo database. Counts and dashboards may therefore differ from the original seed. Test credentials are stored only in ignored local environment files; handoff credentials are supplied privately in the conversation, not in this repository.

## Boundaries and known limitations

- This is an academic, production-minded demonstration, not certification for live financial operations. All starting records are synthetic.
- Phone-based initial member passwords were explicitly requested despite the documented guessing risk. Mandatory change, hashing, session controls, and rate limiting mitigate but do not eliminate that pre-first-login risk.
- Cash/GCash/bank transfer amounts are manual records. No online payment gateway or external transfer verification is implemented.
- QR token/API behavior and QR rendering were tested. Physical camera scanning on a real phone was **not hardware-tested**; camera permissions and manual member-code fallback remain relevant.
- Forecasting uses an explainable completed-month average with history caveats; renewal estimates use historical observations. No accuracy guarantee or trained machine-learning claim is made.
- Renewal alerts are in-app. Email/SMS delivery and automatic marketing messages are not configured.
- The full dependency audit reports five high-severity **development-tool-chain** findings rooted in `eslint-config-next`/`braces`. The available audit suggestion is a breaking downgrade; it was not applied. These findings do not appear in the production dependency audit and still deserve review when patched tooling is available.
- Before live operation, review password onboarding, privacy/consent, backup restoration, retention, account recovery, audit requirements, and payment reconciliation.

## Reproducing browser tests

Load the private demo seed variables from `.env.local`, run the development server, and run:

```sh
node --env-file=.env.local --import tsx scripts/prepare-e2e.ts
node --env-file=.env.e2e.local node_modules/@playwright/test/cli.js test
```

The preparation script creates a separate paid QA member and changes that account's password without consuming the handoff member's first-login flow. To validate the deployment:

```sh
E2E_BASE_URL=https://cordova-fit-hub.vercel.app \
  node --env-file=.env.e2e.local node_modules/@playwright/test/cli.js test
```

Run mutation tests only against this authorized synthetic database. Do not run them against a real gym's records.
