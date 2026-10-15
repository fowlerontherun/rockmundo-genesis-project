// A response can be lost after a purchase has committed. Keep the same
// idempotency key across hook instances and page reloads in this browser tab.
// Clear only after the purchase and follow-up confirmation have succeeded.
const pendingRequests = new Map<string, string>();
const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const underworldPurchaseRequestStorageKey = (
  profileId: string,
  productId: string,
  paymentMethod: "cash" | "crypto",
): string => `rockmundo:underworld-purchase:v1:${profileId}:${productId}:${paymentMethod}`;

export const getOrCreateUnderworldPurchaseRequestId = (
  profileId: string,
  productId: string,
  paymentMethod: "cash" | "crypto",
): string => {
  const key = underworldPurchaseRequestStorageKey(profileId, productId, paymentMethod);
  const inMemory = pendingRequests.get(key);
  if (inMemory) return inMemory;

  let saved: string | null = null;
  try {
    if (typeof window !== "undefined") saved = window.sessionStorage.getItem(key);
  } catch {
    // Privacy-restricted browsers can block sessionStorage.
  }
  const requestId = saved && isUuid(saved) ? saved : crypto.randomUUID();
  pendingRequests.set(key, requestId);
  try {
    if (typeof window !== "undefined") window.sessionStorage.setItem(key, requestId);
  } catch {
    // In-memory retries still work if sessionStorage is unavailable.
  }
  return requestId;
};

export const clearUnderworldPurchaseRequestId = (
  profileId: string,
  productId: string,
  paymentMethod: "cash" | "crypto",
): void => {
  const key = underworldPurchaseRequestStorageKey(profileId, productId, paymentMethod);
  pendingRequests.delete(key);
  try {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(key);
  } catch {
    // Ignored: stale storage must never make a successful purchase fail.
  }
};
