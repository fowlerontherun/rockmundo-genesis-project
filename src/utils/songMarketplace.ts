export function calculateMinimumBid(currentBid: number | null, startingPrice: number): number {
  const base = currentBid || startingPrice;
  const increment = Math.max(100, Math.round(base * 0.05)); // 5% or $100 minimum
  return base + increment;
}

export function calculateMarketplaceFee(salePrice: number): number {
  return Math.round(salePrice * 0.1); // 10% fee
}

export function calculateSellerPayout(salePrice: number): number {
  return salePrice - calculateMarketplaceFee(salePrice); // 90% to seller
}

export function isAuctionEnding(endDate: string): boolean {
  const end = new Date(endDate);
  const now = new Date();
  const minutesRemaining = (end.getTime() - now.getTime()) / (1000 * 60);
  return minutesRemaining <= 5 && minutesRemaining > 0;
}

export function extendAuction(endDate: string): string {
  const end = new Date(endDate);
  end.setMinutes(end.getMinutes() + 5);
  return end.toISOString();
}

export function formatTimeRemaining(endDate: string): string {
  const end = new Date(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  
  if (diff <= 0) return "Ended";
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
