import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

// Run only against the isolated synthetic demonstration deployment.
// This creates a separate QA member so the handoff member keeps first-login behavior.
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const ownerEmail = process.env.DEMO_OWNER_EMAIL;
const ownerPassword = process.env.DEMO_OWNER_PASSWORD;
const staffEmail = process.env.DEMO_STAFF_EMAIL;
const staffPassword = process.env.DEMO_STAFF_PASSWORD;
if (!ownerEmail || !ownerPassword || !staffEmail || !staffPassword) {
  throw new Error(
    "Load the private demo credential environment before preparing E2E.",
  );
}
let cookie = "";
async function api(path: string, data?: unknown) {
  const response = await fetch(new URL(path, base), {
    method: data === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: new URL(base).origin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      `${path}: HTTP ${response.status}: ${result.error || "Request failed"}`,
    );
  return result;
}

await api("/api/auth/login", { email: staffEmail, password: staffPassword });
const bootstrap = await api("/api/bootstrap");
if (!bootstrap.isDemo)
  throw new Error("Refusing to create QA records in a non-demo application.");
const plan = bootstrap.plans.find(
  (item: { active: boolean; price: number }) => item.active && item.price > 0,
);
if (!plan) throw new Error("An active paid plan is required.");
const suffix = randomBytes(6).toString("hex");
const memberEmail = `qa.member.${suffix}@example.test`;
const phone = `+63917${String(parseInt(suffix.slice(0, 6), 16))
  .padStart(7, "0")
  .slice(-7)}`;
await api("/api/members", {
  name: "Synthetic QA Member",
  email: memberEmail,
  phone,
  source: "QA verification",
  planId: plan.id,
  amountPaid: plan.price,
  paymentMethod: "cash",
});
await api("/api/auth/logout", {});
await api("/api/auth/login", { email: memberEmail, password: phone });
const password = `QA-${randomBytes(18).toString("base64url")}!`;
await api("/api/auth/password", {
  currentPassword: phone,
  newPassword: password,
});
await api("/api/bootstrap");
await api("/api/auth/logout", {});

const values = {
  E2E_OWNER_EMAIL: ownerEmail,
  E2E_OWNER_PASSWORD: ownerPassword,
  E2E_STAFF_EMAIL: staffEmail,
  E2E_STAFF_PASSWORD: staffPassword,
  E2E_MEMBER_EMAIL: memberEmail,
  E2E_MEMBER_PASSWORD: password,
};
writeFileSync(
  ".env.e2e.local",
  Object.entries(values)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join("\n") + "\n",
  { mode: 0o600 },
);
console.log(
  "Prepared a separate synthetic QA member. Credentials saved to ignored .env.e2e.local; no handoff password changed.",
);
