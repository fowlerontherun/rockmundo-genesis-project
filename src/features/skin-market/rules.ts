/** Skin Market rules — mirror the database checks in create_skin_listing / skin_market_fee. */
export const SKIN_MARKET_MIN_PRICE_MINOR = 99;
export const SKIN_MARKET_MAX_PRICE_MINOR = 4999;
export const SKIN_MARKET_FEE_RATE = 0.15;
export const SKIN_MARKET_RESERVE_MINUTES = 30;

export const isValidListingPrice = (minor: number) =>
  Number.isInteger(minor) && minor >= SKIN_MARKET_MIN_PRICE_MINOR && minor <= SKIN_MARKET_MAX_PRICE_MINOR;

export const marketFeeMinor = (priceMinor: number) => Math.round(priceMinor * SKIN_MARKET_FEE_RATE);
export const sellerPayoutMinor = (priceMinor: number) => priceMinor - marketFeeMinor(priceMinor);

export const poundsToMinor = (pounds: string | number) => Math.round(Number(pounds) * 100);
export const formatGbp = (minor: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(minor / 100);

export const canBuyListing = (listing: { seller_user_id: string }, buyerUserId: string | null) =>
  !!buyerUserId && listing.seller_user_id !== buyerUserId;

/** A reserved listing becomes buyable again once its 30-minute hold runs out. */
export const isListingAvailable = (
  listing: { status: string; reserved_until: string | null },
  now: Date = new Date(),
) =>
  listing.status === "open" ||
  (listing.status === "reserved" && !!listing.reserved_until && new Date(listing.reserved_until) < now);
