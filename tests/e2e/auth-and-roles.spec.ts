import { expect, test } from "@playwright/test";
import { api, available, login } from "./helpers";

test.describe("authenticated API roles", () => {
  for (const role of ["owner", "staff", "member"] as const) {
    test(`${role} session and bootstrap scope`, async ({ request }) => {
      test.skip(
        !available(role),
        `Skipped: set E2E_${role.toUpperCase()}_EMAIL and E2E_${role.toUpperCase()}_PASSWORD`,
      );
      await login(request, role);
      const me = await api(request, "GET", "/api/auth/me");
      expect(me.ok()).toBeTruthy();
      expect((await me.json()).user.role).toBe(role);
      const bootstrap = await api(request, "GET", "/api/bootstrap");
      expect(bootstrap.ok()).toBeTruthy();
      const data = await bootstrap.json();
      expect(data.user.role).toBe(role);
      for (const key of [
        "plans",
        "members",
        "memberships",
        "payments",
        "attendance",
        "staff",
        "analytics",
      ])
        expect(data).toHaveProperty(key);
      if (role === "member") {
        expect(data.analytics).toBeNull();
        expect(data.members).toHaveLength(1);
        const members = await api(request, "POST", "/api/members", {});
        expect([401, 403]).toContain(members.status());
        const checkin = await api(request, "POST", "/api/check-in", {
          code: "invalid",
          method: "manual",
        });
        expect([401, 403]).toContain(checkin.status());
        const exportResponse = await api(
          request,
          "GET",
          "/api/export?type=members",
        );
        expect([401, 403]).toContain(exportResponse.status());
      }
    });
  }

  test("staff cannot manage plans while owner can access plans", async ({
    request,
  }) => {
    test.skip(
      !available("staff") || !available("owner"),
      "Skipped: configure both staff and owner E2E credentials",
    );
    await login(request, "staff");
    const forbidden = await api(request, "POST", "/api/plans", {
      name: `E2E ${Date.now()}`,
      durationMonths: 1,
      price: 1,
    });
    expect([401, 403]).toContain(forbidden.status());
    await api(request, "POST", "/api/auth/logout");
    await login(request, "owner");
    const suffix = Date.now();
    const created = await api(request, "POST", "/api/plans", {
      name: `E2E Plan ${suffix}`,
      durationMonths: 1,
      price: 1234.5,
    });
    expect(created.status(), await created.text()).toBe(201);
    const plan = (await created.json()).plan;
    const edited = await api(request, "PATCH", `/api/plans/${plan.id}`, {
      name: `E2E Plan ${suffix} Edited`,
      durationMonths: 3,
      price: 2345,
    });
    expect(edited.ok(), await edited.text()).toBeTruthy();
    expect((await edited.json()).plan.name).toBe(`E2E Plan ${suffix} Edited`);
  });

  test("rejects requests with an untrusted Origin", async ({ request }) => {
    test.skip(
      !available("staff"),
      "Skipped: set E2E_STAFF_EMAIL and E2E_STAFF_PASSWORD",
    );
    await login(request, "staff");
    const response = await request.post("/api/members", {
      data: {
        name: "E2E Origin Probe",
        email: `e2e-origin-${Date.now()}@example.invalid`,
        phone: "+639123456789",
        source: "e2e-test",
      },
      headers: { origin: "https://untrusted.invalid" },
    });
    expect([400, 403]).toContain(response.status());
  });
});
