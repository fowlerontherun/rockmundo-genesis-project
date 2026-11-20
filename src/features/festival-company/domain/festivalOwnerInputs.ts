/** Reject financial input rather than silently sending a different amount. */
export function parseFestivalFee(value: string): number | null {
  const text = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const minor = Math.round(Number(text) * 100);
  return Number.isSafeInteger(minor) && minor >= 0 ? minor : null;
}

export function parseFestivalCapacity(value: string, maximum: number): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const capacity = Number(value);
  return Number.isSafeInteger(capacity) && capacity >= 0 && capacity <= maximum ? capacity : null;
}