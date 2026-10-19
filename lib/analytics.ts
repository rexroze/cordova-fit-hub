import type { Analytics } from "./contracts";

/** Expects one revenue total for each completed calendar month, oldest first. */
export function forecastRevenue(monthlyCents: number[]): Analytics["forecast"] {
  const completed = monthlyCents.slice(-3);
  const sufficientData = completed.length === 3;
  const nextMonthCents = sufficientData
    ? Math.round(completed.reduce((sum, amount) => sum + amount, 0) / 3)
    : completed.length
      ? completed[completed.length - 1]
      : 0;
  return {
    nextMonthRevenue: nextMonthCents / 100,
    method: sufficientData
      ? "three_completed_month_average"
      : "latest_available_month_fallback",
    explanation: sufficientData
      ? "Average revenue from the three most recently completed months."
      : `Only ${completed.length} completed month${completed.length === 1 ? " is" : "s are"} available; using the latest available month${completed.length ? "" : " total of zero"}.`,
    sufficientData,
  };
}
