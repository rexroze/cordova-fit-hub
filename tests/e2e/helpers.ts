import {
  expect,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from "@playwright/test";

export type Role = "owner" | "staff" | "member";
export const credentials: Record<Role, { email?: string; password?: string }> =
  {
    owner: {
      email: process.env.E2E_OWNER_EMAIL,
      password: process.env.E2E_OWNER_PASSWORD,
    },
    staff: {
      email: process.env.E2E_STAFF_EMAIL,
      password: process.env.E2E_STAFF_PASSWORD,
    },
    member: {
      email: process.env.E2E_MEMBER_EMAIL,
      password: process.env.E2E_MEMBER_PASSWORD,
    },
  };

export function available(role: Role): boolean {
  return Boolean(credentials[role].email && credentials[role].password);
}

export async function login(request: APIRequestContext, role: Role) {
  const { email, password } = credentials[role];
  if (!email || !password)
    throw new Error(`Missing E2E_${role.toUpperCase()}_EMAIL/PASSWORD`);
  const response = await request.post("/api/auth/login", {
    data: { email, password },
    headers: { origin: requestBase(request) },
  });
  expect(
    response.ok(),
    `Login for ${role} failed: ${await response.text()}`,
  ).toBeTruthy();
  return response;
}

function requestBase(request: APIRequestContext): string {
  return process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
}

export async function api(
  request: APIRequestContext,
  method: string,
  path: string,
  data?: unknown,
): Promise<APIResponse> {
  return request.fetch(path, {
    method,
    ...(data === undefined ? {} : { data }),
    headers: { origin: requestBase(request) },
  });
}

export async function loginPage(page: Page, role: Role) {
  const { email, password } = credentials[role];
  if (!email || !password)
    throw new Error(`Missing E2E_${role.toUpperCase()}_EMAIL/PASSWORD`);
  await page.goto("/login");
  const emailInput = page
    .locator('input[type="email"], input[name="email"]')
    .first();
  const passwordInput = page
    .locator('input[type="password"], input[name="password"]')
    .first();
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await page.locator('button[type="submit"]').first().click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 15_000 });
}

export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
