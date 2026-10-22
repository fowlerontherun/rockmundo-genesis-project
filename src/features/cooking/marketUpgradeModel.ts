/** Server-priced market tiers reflected for display only; RPC is authoritative. */
export function marketUpgradeCost(currentLevel: number): number | null {
  return Number.isInteger(currentLevel) && currentLevel >= 1 && currentLevel < 5
    ? 20000 * 2 ** (currentLevel - 1)
    : null;
}
export function marketUpgradeCooldownUntil(lastUpgradedAt: string | null): number | null {
  if (!lastUpgradedAt) return null;
  const date = Date.parse(lastUpgradedAt);
  return Number.isFinite(date) ? date + 7 * 24 * 60 * 60 * 1000 : null;
}
