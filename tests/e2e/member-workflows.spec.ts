import { expect, test } from "@playwright/test";
import { api, available, login, uniqueSuffix } from "./helpers";

test.describe("member and payment workflows", () => {
  test("creates disposable member, enforces initial password change, then exercises payment and check-in", async ({
    request,
  }) => {
    test.skip(
      !available("staff"),
      "Skipped: set E2E_STAFF_EMAIL and E2E_STAFF_PASSWORD",
    );
    await login(request, "staff");
    const bootstrapResponse = await api(request, "GET", "/api/bootstrap");
    expect(bootstrapResponse.ok()).toBeTruthy();
    const bootstrap = await bootstrapResponse.json();
    const plan =
      bootstrap.plans.find((item: { active?: boolean }) => item.active) ??
      bootstrap.plans[0];
    expect(
      plan,
      "A plan is required for synthetic member workflows",
    ).toBeTruthy();
    const suffix = uniqueSuffix();
    const email = `e2e-${suffix}@example.invalid`;
    const created = await api(request, "POST", "/api/members", {
      name: `E2E Synthetic ${suffix}`,
      email,
      phone: `+639${suffix.replace(/\D/g, "").slice(-9).padStart(9, "0")}`,
      source: "e2e-test",
      planId: plan.id,
      amountPaid: 0,
      paymentMethod: "cash",
    });
    expect(created.status(), await created.text()).toBe(201);
    const member = (await created.json()).member;
    expect(member).toBeTruthy();

    const excessiveRegistration = await api(request, "POST", "/api/members", {
      name: `E2E Overpaid ${suffix}`,
      email: `e2e-overpaid-${suffix}@example.invalid`,
      phone: `+638${suffix.replace(/\D/g, "").slice(-9).padStart(9, "0")}`,
      source: "e2e-test",
      planId: plan.id,
      amountPaid: plan.price + 1,
      paymentMethod: "cash",
    });
    expect([400, 409, 422]).toContain(excessiveRegistration.status());

    await api(request, "POST", "/api/auth/logout");
    const password = `Disposable-${suffix}-Aa1!`;
    const memberLogin = await request.post("/api/auth/login", {
      data: { email, password: member.phone },
      headers: { origin: process.env.E2E_BASE_URL || "http://127.0.0.1:3000" },
    });
    expect(memberLogin.ok(), await memberLogin.text()).toBeTruthy();
    const blockedBootstrap = await api(request, "GET", "/api/bootstrap");
    expect([401, 403]).toContain(blockedBootstrap.status());
    const changed = await api(request, "POST", "/api/auth/password", {
      currentPassword: member.phone,
      newPassword: password,
    });
    expect(changed.ok(), await changed.text()).toBeTruthy();
    const memberData = await (await api(request, 'GET', '/api/bootstrap')).json();
    const qrToken = memberData.members[0].qrToken;
    expect(qrToken).toBeTruthy();

    await api(request, "POST", "/api/auth/logout");
    await login(request, "staff");
    const unpaid = await api(request, "POST", "/api/check-in", {
      code: qrToken,
      method: "qr",
    });
    expect([400, 403, 409]).toContain(unpaid.status());

    const fresh = await (await api(request, "GET", "/api/bootstrap")).json();
    const membership = fresh.memberships.find(
      (item: { memberId: string }) => item.memberId === member.id,
    );
    expect(membership).toBeTruthy();
    const foreignMembership = fresh.memberships.find(
      (item: { memberId: string }) => item.memberId !== member.id,
    );
    if (foreignMembership) {
      const mismatch = await api(request, "POST", "/api/payments", {
        memberId: member.id,
        membershipId: foreignMembership.id,
        amount: 1,
        method: "cash",
      });
      expect([400, 404, 409]).toContain(mismatch.status());
    }
    const attempts = await Promise.all([
      api(request, "POST", "/api/payments", {
        memberId: member.id,
        membershipId: membership.id,
        amount: plan.price,
        method: "cash",
      }),
      api(request, "POST", "/api/payments", {
        memberId: member.id,
        membershipId: membership.id,
        amount: plan.price,
        method: "cash",
      }),
    ]);
    expect(attempts.filter((response) => response.ok())).toHaveLength(1);
    for (const response of attempts)
      expect([201, 400, 409]).toContain(response.status());
    const paymentState = await (
      await api(request, "GET", "/api/bootstrap")
    ).json();
    const totalPaid = paymentState.payments
      .filter(
        (item: { membershipId: string }) => item.membershipId === membership.id,
      )
      .reduce(
        (total: number, item: { amount: number }) => total + item.amount,
        0,
      );
    expect(totalPaid).toBeLessThanOrEqual(plan.price);
    const negative = await api(request, "POST", "/api/payments", {
      memberId: member.id,
      membershipId: membership.id,
      amount: -1,
      method: "cash",
    });
    expect([400, 422]).toContain(negative.status());
    const checked = await api(request, "POST", "/api/check-in", {
      code: qrToken,
      method: "qr",
    });
    expect(checked.ok(), await checked.text()).toBeTruthy();
    const duplicate = await api(request, "POST", "/api/check-in", {
      code: member.memberCode,
      method: "manual",
    });
    expect([400, 409]).toContain(duplicate.status());

    const renewal = await api(
      request,
      "POST",
      `/api/members/${member.id}/renew`,
      { planId: plan.id, amountPaid: plan.price, paymentMethod: "cash", idempotencyKey: `renew-${suffix}` },
    );
    expect(renewal.status(), await renewal.text()).toBe(201);
    const renewed = (await renewal.json()).membership;
    const retried = await api(request, 'POST', `/api/members/${member.id}/renew`, {
      planId: plan.id, amountPaid: plan.price, paymentMethod: 'cash', idempotencyKey: `renew-${suffix}`,
    });
    expect(retried.ok()).toBeTruthy();
    expect((await retried.json()).membership.id).toBe(renewed.id);
    expect(renewed.startsAt).toBe(
      membership.expiresAt > new Date().toISOString().slice(0, 10)
        ? membership.expiresAt
        : renewed.startsAt,
    );
    expect(Date.parse(`${renewed.expiresAt}T00:00:00Z`)).toBeGreaterThan(
      Date.parse(`${renewed.startsAt}T00:00:00Z`),
    );
    const afterRenew = await (
      await api(request, "GET", "/api/bootstrap")
    ).json();
    expect(
      afterRenew.memberships.some(
        (item: { id: string }) => item.id === membership.id,
      ),
    ).toBeTruthy();
  });

  test("CSV preview rejects invalid input and detects duplicate synthetic member", async ({
    request,
  }) => {
    test.skip(
      !available("staff"),
      "Skipped: set E2E_STAFF_EMAIL and E2E_STAFF_PASSWORD",
    );
    await login(request, "staff");
    const invalid = await api(request, "POST", "/api/import", {
      csv: "not,a,valid,member\n",
      preview: true,
    });
    expect([400, 422]).toContain(invalid.status());
    const suffix = uniqueSuffix();
    const email = `e2e-import-${suffix}@example.invalid`;
    const bootstrap = await (
      await api(request, "GET", "/api/bootstrap")
    ).json();
    const plan =
      bootstrap.plans.find((item: { active?: boolean }) => item.active) ??
      bootstrap.plans[0];
    const csv = `name,email,phone,source,planId,amountPaid,paymentMethod\nE2E Import ${suffix},${email},+639123456789,e2e-test,${plan.id},0,cash`;
    const first = await api(request, "POST", "/api/import", {
      csv,
      preview: true,
    });
    expect(first.ok(), await first.text()).toBeTruthy();
    const again = await api(request, "POST", "/api/import", {
      csv,
      preview: true,
    });
    expect(again.ok(), await again.text()).toBeTruthy();
    const after = await (await api(request, "GET", "/api/bootstrap")).json();
    expect(after.members).toHaveLength(bootstrap.members.length);
    const duplicateRows = `name,email,phone,source,planId,amountPaid,paymentMethod\nE2E Import ${suffix},${email},+639123456789,e2e-test,${plan.id},0,cash\nE2E Import Duplicate ${suffix},${email},+639123456789,e2e-test,${plan.id},0,cash`;
    const duplicate = await api(request, "POST", "/api/import", {
      csv: duplicateRows,
      preview: true,
    });
    expect(duplicate.ok()).toBeTruthy();
    expect((await duplicate.json()).errors.length).toBeGreaterThan(0);
    const rejected = await api(request, 'POST', '/api/import', { csv: duplicateRows, preview: false });
    expect(rejected.status()).toBe(400);
    const committed = await api(request, 'POST', '/api/import', { csv, preview: false });
    expect(committed.status(), await committed.text()).toBe(201);
    const imported = await (await api(request, 'GET', '/api/bootstrap')).json();
    const member = imported.members.find((item: { email: string }) => item.email === email);
    expect(member).toBeTruthy();
    const renewal = await api(request, 'POST', `/api/members/${member.id}/renew`, {
      planId: plan.id, amountPaid: plan.price, paymentMethod: 'cash', idempotencyKey: `csv-renew-${suffix}`,
    });
    expect(renewal.status(), await renewal.text()).toBe(201);
    const existing = await api(request, 'POST', '/api/import', { csv, preview: true });
    expect((await existing.json()).errors.length).toBeGreaterThan(0);
  });
});
