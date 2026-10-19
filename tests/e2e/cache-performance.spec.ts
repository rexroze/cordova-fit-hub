import { expect, test } from "@playwright/test";
import { available, login, loginPage, uniqueSuffix } from "./helpers";

function gate() {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { waiting, release };
}

test.describe("workspace caching and loading", () => {
  test("cold entry has a skeleton and one request; warm navigation reuses data", async ({
    page,
  }) => {
    test.skip(
      !available("owner"),
      "Owner verification credentials are required.",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await login(page.request, "owner");
    const pending = gate();
    let bootstrapRequests = 0;
    let sessionRequests = 0;
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (path === "/api/bootstrap") bootstrapRequests++;
      if (path === "/api/auth/me") sessionRequests++;
    });
    await page.route("**/api/bootstrap*", async (route) => {
      await pending.waiting;
      await route.continue();
    });
    try {
      await page.goto("/members");
      await expect(page.getByTestId("workspace-skeleton")).toBeVisible();
    } finally {
      pending.release();
    }
    await expect(
      page.getByRole("heading", { name: "Members", exact: true }),
    ).toBeVisible();
    expect(bootstrapRequests).toBe(1);
    expect(sessionRequests).toBe(0);
    const start = performance.now();
    await page.getByRole("link", { name: "Payments", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Payments", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("workspace-skeleton")).toHaveCount(0);
    await page.getByRole("link", { name: "Dashboard", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Your gym, at a glance" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Members", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Members", exact: true }),
    ).toBeVisible();
    expect(bootstrapRequests).toBe(1);
    expect(sessionRequests).toBe(0);
    console.log(
      JSON.stringify({
        scenario: "three-warm-navigations",
        bootstrapRequests: 0,
        sessionRequests: 0,
        elapsedMs: Math.round(performance.now() - start),
      }),
    );
  });

  test("manual background refresh preserves content instead of blanking the page", async ({
    page,
  }) => {
    test.skip(
      !available("owner"),
      "Owner verification credentials are required.",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await loginPage(page, "owner");
    const heading = page.getByRole("heading", {
      name: "Your gym, at a glance",
    });
    await expect(heading).toBeVisible();
    const pending = gate();
    await page.route("**/api/bootstrap*", async (route) => {
      await pending.waiting;
      await route.continue();
    });
    try {
      await page
        .getByRole("button", { name: "Refresh workspace", exact: true })
        .click();
      await expect(
        page.getByTestId("workspace-refresh-indicator"),
      ).toBeVisible();
      await expect(heading).toBeVisible();
      await expect(page.getByTestId("workspace-skeleton")).toHaveCount(0);
    } finally {
      pending.release();
    }
    await expect(page.getByTestId("workspace-refresh-indicator")).toHaveCount(
      0,
    );
    await expect(heading).toBeVisible();
  });

  test("member registration refreshes cached lists and survives warm navigation", async ({
    page,
  }) => {
    test.skip(
      !available("staff"),
      "Staff verification credentials are required.",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await loginPage(page, "staff");
    await expect(
      page.getByRole("heading", { name: "Your gym, at a glance" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Members", exact: true }).click();
    await page.getByRole("button", { name: /Add member/ }).click();
    const dialog = page.getByRole("dialog", { name: "Register a member" });
    const suffix = uniqueSuffix();
    const name = `Cache QA ${suffix}`;
    await dialog.getByLabel("Full name", { exact: true }).fill(name);
    await dialog
      .getByLabel("Email", { exact: true })
      .fill(`cache-${suffix}@example.test`);
    await dialog.getByLabel("Phone", { exact: true }).fill("+639171234567");
    await dialog
      .getByRole("button", { name: "Register member", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("row", { name: new RegExp(name) }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Dashboard", exact: true }).click();
    await page.getByRole("link", { name: "Members", exact: true }).click();
    await expect(
      page.getByRole("row", { name: new RegExp(name) }),
    ).toBeVisible();
  });

  test("logout and member login never reuse the owner workspace", async ({
    page,
  }) => {
    test.skip(
      !available("owner") || !available("member"),
      "Owner and member verification credentials are required.",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await loginPage(page, "owner");
    await expect(
      page.getByRole("heading", { name: "Your gym, at a glance" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Sign out/ })
      .first()
      .click();
    await expect(page).toHaveURL(/login/);
    const pending = gate();
    await page.route("**/api/bootstrap*", async (route) => {
      await pending.waiting;
      await route.continue();
    });
    try {
      await loginPage(page, "member");
      await expect(page.getByTestId("workspace-skeleton")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Your gym, at a glance" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "Staff", exact: true }),
      ).toHaveCount(0);
    } finally {
      pending.release();
    }
    await expect(
      page.getByRole("heading", { name: "Your Fit Hub", exact: true }),
    ).toBeVisible();
  });

  test("logging out in another tab clears the first tab workspace", async ({
    page,
    context,
  }) => {
    test.skip(
      !available("owner"),
      "Owner verification credentials are required.",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await loginPage(page, "owner");
    await expect(
      page.getByRole("heading", { name: "Your gym, at a glance" }),
    ).toBeVisible();
    const other = await context.newPage();
    await other.setViewportSize({ width: 1440, height: 1000 });
    await other.goto("/dashboard");
    await expect(
      other.getByRole("heading", { name: "Your gym, at a glance" }),
    ).toBeVisible();
    await other
      .getByRole("button", { name: /Sign out/ })
      .first()
      .click();
    await expect(page).toHaveURL(/login/);
    await expect(
      page.getByRole("heading", { name: "Your gym, at a glance" }),
    ).toHaveCount(0);
    await other.close();
  });

  test("an expired server session clears cached content instead of displaying it indefinitely", async ({
    page,
  }) => {
    test.skip(
      !available("owner"),
      "Owner verification credentials are required.",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await loginPage(page, "owner");
    await expect(
      page.getByRole("heading", { name: "Your gym, at a glance" }),
    ).toBeVisible();
    await page.route("**/api/bootstrap*", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Authentication required" }),
      }),
    );
    await page
      .getByRole("button", { name: "Refresh workspace", exact: true })
      .click();
    await expect(page).toHaveURL(/login/);
    await expect(
      page.getByRole("heading", { name: "Your gym, at a glance" }),
    ).toHaveCount(0);
  });

  test("a failed background network refresh keeps the last good content with a visible warning", async ({
    page,
  }) => {
    test.skip(
      !available("owner"),
      "Owner verification credentials are required.",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await loginPage(page, "owner");
    const heading = page.getByRole("heading", {
      name: "Your gym, at a glance",
    });
    await expect(heading).toBeVisible();
    await page.route("**/api/bootstrap*", (route) => route.abort("failed"));
    await page
      .getByRole("button", { name: "Refresh workspace", exact: true })
      .click();
    await expect(page.locator('.notice[role="alert"]')).toBeVisible();
    await expect(heading).toBeVisible();
    await expect(page.getByTestId("workspace-skeleton")).toHaveCount(0);
  });
});

test("public landing page loads local photos and links to sign-in without requesting private data", async ({
  page,
}) => {
  let privateRequests = 0;
  page.on("request", (request) => {
    if (/\/api\/(bootstrap|auth\/me)/.test(request.url())) privateRequests++;
  });
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /sign in/i }).first(),
    ).toHaveAttribute("href", "/login");
    const images = page.locator("main img");
    expect(await images.count()).toBeGreaterThanOrEqual(2);
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          image.evaluate(
            (node: HTMLImageElement) => node.complete && node.naturalWidth > 0,
          ),
        )
        .toBeTruthy();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.screenshot({
      path: `test-results/landing-${width}.png`,
      fullPage: true,
    });
  }
  expect(privateRequests).toBe(0);
});
