export type CheckoutCurrency = "usd" | "gbp" | "eur";

export const CHECKOUT_CURRENCIES: CheckoutCurrency[] = ["usd", "gbp", "eur"];

export const CURRENCY_META: Record<CheckoutCurrency, { label: string; symbol: string; name: string }> = {
  usd: { label: "USD", symbol: "$", name: "US Dollar" },
  gbp: { label: "GBP", symbol: "£", name: "Pound Sterling" },
  eur: { label: "EUR", symbol: "€", name: "Euro" },
};

const STORAGE_KEY = "rockmundo:checkout-currency";

export const isCheckoutCurrency = (value: unknown): value is CheckoutCurrency =>
  typeof value === "string" && (CHECKOUT_CURRENCIES as string[]).includes(value);

export const getStoredCurrency = (): CheckoutCurrency => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isCheckoutCurrency(stored)) return stored;
    const locale = navigator.language?.toLowerCase() ?? "";
    if (locale.includes("gb")) return "gbp";
    if (/-(de|fr|es|it|ie|nl|be|at|pt|fi|gr|sk|si|lv|lt|ee|cy|mt|lu)$/.test(locale)) return "eur";
  } catch {
    // ignore storage/navigator access issues
  }
  return "usd";
};

export const storeCurrency = (currency: CheckoutCurrency) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, currency);
  } catch {
    // ignore storage failures
  }
};

/** Amounts in minor units, mirroring the Stripe price currency_options. */
export const CHECKOUT_PRICING = {
  vipMonthly: { usd: 499, gbp: 399, eur: 469 },
  vipQuarterly: { usd: 1249, gbp: 999, eur: 1169 },
  vipAnnual: { usd: 3999, gbp: 3199, eur: 3749 },
  donation: { usd: 1000, gbp: 800, eur: 950 },
  characterSlot: { usd: 650, gbp: 500, eur: 599 },
} as const satisfies Record<string, Record<CheckoutCurrency, number>>;

export type CheckoutProductKey = keyof typeof CHECKOUT_PRICING;

export const formatMinor = (minor: number, currency: CheckoutCurrency) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);

export const formatProductPrice = (product: CheckoutProductKey, currency: CheckoutCurrency) =>
  formatMinor(CHECKOUT_PRICING[product][currency], currency);
