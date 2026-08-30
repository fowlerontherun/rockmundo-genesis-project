import { useCallback, useEffect, useState } from "react";
import {
  CheckoutCurrency,
  getStoredCurrency,
  storeCurrency,
} from "@/lib/checkoutCurrency";

const EVENT_NAME = "rockmundo:checkout-currency-changed";

export function useCheckoutCurrency() {
  const [currency, setCurrencyState] = useState<CheckoutCurrency>(() => getStoredCurrency());

  useEffect(() => {
    const handler = (event: Event) => {
      const next = (event as CustomEvent<CheckoutCurrency>).detail;
      if (next) setCurrencyState(next);
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  const setCurrency = useCallback((next: CheckoutCurrency) => {
    storeCurrency(next);
    setCurrencyState(next);
    window.dispatchEvent(new CustomEvent<CheckoutCurrency>(EVENT_NAME, { detail: next }));
  }, []);

  return { currency, setCurrency };
}
