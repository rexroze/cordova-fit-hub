export function pesosToCents(value: number): number {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error("Amount must be positive");
  const cents = Math.round(value * 100);
  if (Math.abs(value * 100 - cents) > 1e-7)
    throw new Error("Amount must use at most two decimal places");
  return cents;
}
export function centsToPesos(cents: number): number {
  return cents / 100;
}
