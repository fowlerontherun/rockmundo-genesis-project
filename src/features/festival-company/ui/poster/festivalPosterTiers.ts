/** Split a confirmed line-up into classic poster billing tiers. */
export function festivalPosterTiers(names: string[]) {
  const clean = names.map((n) => n.trim()).filter(Boolean).filter((n, i, a) => a.indexOf(n) === i);
  return { headliners: clean.slice(0, 1), subHeadliners: clean.slice(1, 4), support: clean.slice(4) };
}
