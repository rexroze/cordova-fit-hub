import { describe, expect, it } from "vitest";
import { addMonthsClamped } from "../../lib/dates";
import { centsToPesos, pesosToCents } from "../../lib/money";
import { forecastRevenue } from "../../lib/analytics";
import {
  canAccessMember,
  canManagePlans,
  canManageStaff,
} from "../../lib/permissions";
describe("money", () => {
  it("converts exact pesos to integer centavos", () => {
    expect(pesosToCents(15.25)).toBe(1525);
    expect(centsToPesos(1525)).toBe(15.25);
  });
  it("rejects non-positive and fractional cent amounts", () => {
    expect(() => pesosToCents(0)).toThrow();
    expect(() => pesosToCents(1.001)).toThrow();
  });
});
describe("Manila calendar dates", () => {
  it("clamps month ends", () => {
    expect(addMonthsClamped("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonthsClamped("2025-01-31", 1)).toBe("2025-02-28");
  });
});
describe("forecast", () => {
  it("uses three-month average or an honest fallback", () => {
    expect(forecastRevenue([10000, 20000, 30000]).nextMonthRevenue).toBe(200);
    expect(forecastRevenue([1, 2]).sufficientData).toBe(false);
  });
});
describe("role permissions", () => {
  it("limits plan and staff management to owner and scopes member data", () => {
    expect(canManagePlans("staff")).toBe(false);
    expect(canManageStaff("owner")).toBe(true);
    expect(canAccessMember("member", "a", "b")).toBe(false);
  });
});
