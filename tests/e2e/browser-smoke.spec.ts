import { expect, test } from "@playwright/test";
import { available, loginPage } from "./helpers";

for (const role of ["owner", "staff", "member"] as const) {
  test(`browser ${role} login smoke at mobile and desktop sizes`, async ({
    page,
  }) => {
    test.skip(
      !available(role),
      `Skipped: set E2E_${role.toUpperCase()}_EMAIL and E2E_${role.toUpperCase()}_PASSWORD`,
    );
    const expectedHeading =
      role === "member" ? "Your Fit Hub" : "Your gym, at a glance";
    for (const viewport of [
      { width: 360, height: 844 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1440, height: 1000 },
    ]) {
      await page.setViewportSize(viewport);
      await loginPage(page, role);
      await expect(
        page.getByRole("heading", { name: expectedHeading, exact: true }),
      ).toBeVisible();
      await expect(
        page.locator("nav:visible, [role=navigation]:visible").first(),
      ).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow, `Horizontal overflow at ${viewport.width}px`).toBe(
        false,
      );
      await page.screenshot({
        path: `test-results/${role}-${viewport.width}x${viewport.height}.png`,
        fullPage: true,
      });
      if (role === 'member' && viewport.width === 360) {
        await expect(page.getByRole('link', { name: 'Profile details', exact: true })).toBeVisible();
        const qr = page.getByRole('img', { name: 'Your member check-in QR code' });
        await expect(qr).toBeVisible();
        await qr.evaluate(image => image.scrollIntoView({ block: 'center' }));
        const imageBox = await qr.boundingBox();
        const navBox = await page.locator('.mobile-nav').boundingBox();
        expect(imageBox).toBeTruthy();
        expect(navBox).toBeTruthy();
        expect(imageBox!.y).toBeGreaterThanOrEqual(0);
        expect(imageBox!.y + imageBox!.height).toBeLessThanOrEqual(navBox!.y);
        await page.screenshot({ path: 'test-results/member-mobile-qr-visible.png' });
      }
      if (viewport.width === 390 && (role === "staff" || role === "member")) {
        await page.getByRole("button", { name: "More", exact: true }).click();
        const drawer = page.getByRole("dialog", { name: "More navigation" });
        await drawer
          .getByRole("link", {
            name: role === "staff" ? "Check-in" : "Profile",
            exact: true,
          })
          .click();
        await expect(page).toHaveURL(role === "staff" ? /check-in/ : /profile/);
      }
      await page
        .getByRole("button", { name: /Sign out/ })
        .first()
        .click();
      await expect(page).toHaveURL(/login/);
    }
  });
}
