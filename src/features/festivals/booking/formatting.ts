export function formatBookingMoney(cents?: number | null, currency = "XXX") {
  if (typeof cents !== "number") return "TBD";
  if (!currency || currency === "XXX")
    return `${(cents / 100).toLocaleString()} credits`;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100);
}
export function formatBookingDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "TBD";
}
export function editionCurrency(
  edition?: {
    currency_code?: string | null;
    supported_currency_codes?: string[] | null;
  },
  fallback = "XXX",
) {
  return (
    edition?.currency_code ?? edition?.supported_currency_codes?.[0] ?? fallback
  );
}
