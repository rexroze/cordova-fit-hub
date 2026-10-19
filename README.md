# Cordova Fit Hub

A full-stack gym management and business analytics application built with Next.js, TypeScript, and Neon PostgreSQL. The initial deployment is an **academic demonstration using synthetic data**, not a live gym payment processor.

**Live app:** https://cordova-fit-hub.vercel.app · See [deployment and validation evidence](VALIDATION.md) for completed checks and known limitations.

The public homepage introduces the member experience using locally hosted licensed photography; source and attribution details are in [IMAGE_CREDITS.md](IMAGE_CREDITS.md) and the public footer. Workspace views use page-shaped loading skeletons and a private, in-memory 30-second cache. See [PERFORMANCE.md](PERFORMANCE.md) for the refresh policy, account-isolation safeguards, and measured request reduction.

## Roles and workflows

| Role | Access |
| --- | --- |
| Owner | Gym dashboard, members, plans and pricing, renewals, manual payments, attendance, analytics, CSV import/export, and staff accounts |
| Staff | Member registration and updates, renewals, manual payment records, check-in, attendance, analytics, CSV workflows; no plan pricing or staff administration |
| Member | Their own membership, payment history, attendance, profile, and check-in QR |

Staff register members with an email address and phone number. At the project owner's request, a new member's initial password is their supplied phone number. **This is guessable and less secure than a random invitation credential.** A mandatory password change blocks all other member operations until completed. Never use this convention for a real gym without reviewing the risk. Owner and staff demo passwords are generated separately and are not published in the repository.

QR codes identify a member; they do not grant permission to record attendance. Only an authenticated owner or staff account can check someone in. Manual member-code entry is available when a camera is unavailable. Physical camera permission and device compatibility vary by browser.

## Operating rules

- Currency: Philippine pesos (PHP), stored as integer centavos.
- Business calendar: `Asia/Manila`. Timestamps are stored with timezone information.
- Plans: monthly, quarterly, and annual; the owner controls prices and availability.
- Membership expiry is exclusive: a membership ending on a date is no longer active on that date.
- A renewal begins at the latest future expiry or today when the previous membership has expired. Calendar-month arithmetic clamps to the last valid day of the destination month.
- Check-in requires a currently active, fully paid membership, with one check-in per member per Manila calendar day.
- Payments are staff-entered cash, GCash, or bank transfer records. Recording a payment does **not** verify an external transfer or process money.
- Membership prices are historical snapshots; editing a plan must not rewrite past charges.

## Local development

Requirements: a supported Node.js release, npm, and a dedicated PostgreSQL database. Use a pooled Neon connection for deployed serverless workloads.

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local` and configure the documented variables. Do not commit either a real connection string or demo credentials.
3. Run the database scripts with the environment loaded:

   ```sh
   node --env-file=.env.local --import tsx scripts/db-push.ts
   node --env-file=.env.local --import tsx scripts/seed.ts
   ```

4. Run `npm run dev` and open `http://localhost:3000`.

The seed is explicit, never triggered by an HTTP request or deployment. Use it only in an isolated demonstration database. Do not point the application or tests at unrelated projects or production gym records.

## Analytics and coursework

The demonstration covers the five requested variables through linked records:

1. **Customer/member:** member identifiers and profiles.
2. **Sales/revenue:** paid amounts recorded against memberships.
3. **Transactions:** payment dates, methods, and references.
4. **Product/service:** membership plans and membership history.
5. **Marketing:** each member's acquisition/referral source.

Attendance, expiry dates, and renewals add operational context. A small plan catalog does not itself represent 50 different services: the relevant observations are member-linked plan selections. Confirm that interpretation and permission to use synthetic data with your instructor. Demo records are labeled in the authenticated interface.

Descriptive metrics summarize stored activity. Forecasts must show the method, available history, and limitations. Recommendations are explainable decision support, not guaranteed outcomes, medical advice, or an automated marketing campaign. In-app renewal information does not send email or SMS.

### CSV

Member imports use UTF-8 CSV with a header:

```csv
name,email,phone,source
Sample Member,sample@example.test,+639171234567,Referral
```

Preview the import before committing it. The maximum is 500 records and 1 MB per upload. Each email must be unique. Imports create accounts with the same mandatory phone-password-change workflow; share access details privately. Exports are authorized server-side and must escape spreadsheet formula prefixes.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

Browser/API tests are in `tests/e2e`. Install the browser with `npx playwright install chromium`, then provide `E2E_OWNER_EMAIL`, `E2E_OWNER_PASSWORD`, `E2E_STAFF_EMAIL`, `E2E_STAFF_PASSWORD`, `E2E_MEMBER_EMAIL`, and `E2E_MEMBER_PASSWORD` through an ignored environment file or the process environment. Use a member account whose first-login password change has already been completed. No test credential belongs in tracked source.

Run `npx playwright test`. Set `E2E_BASE_URL` to test a deployed preview instead of the local development server. Missing credential inputs cause explicit skips; skips are not evidence that a workflow passed. These tests create additional synthetic members, payments, and attendance. Run them only against the approved demo database.

## Deployment and security notes

- Configure `DATABASE_URL` and the application URL in Vercel's server-side environment; never prefix the connection string with `NEXT_PUBLIC_`.
- Use HTTPS. Session cookies are HTTP-only, same-site, and secure in production. Sessions are represented by hashed opaque tokens in the database.
- Keep the GitHub repository private. Secrets and generated test/build artifacts must remain ignored.
- Owner/staff credentials grant access to all demonstration records. Do not publish them in the UI, repository, screenshots, or issue tracker.
- Before real use: replace phone-based initial passwords, arrange account recovery and communications, verify backup/restore procedures and retention, review consent/privacy obligations, and validate real operating policies and payment reconciliation.
- A Vercel preview may be protected by team deployment settings. A working public handoff requires checking those settings and testing the actual supplied URL.

Final deployment coordinates and validation results are supplied separately at handoff; no credentials are stored in this document.
