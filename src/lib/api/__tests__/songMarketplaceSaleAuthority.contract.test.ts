import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20261019083500_authoritative_song_marketplace_sale.sql",
  "utf8",
);
const harness = readFileSync("supabase/tests/marketplace_authoritative_sale_4229.sql", "utf8");
const hooks = readFileSync("src/hooks/useSongAuctions.ts", "utf8");
const listings = readFileSync("src/components/marketplace/MyAuctionListingsTab.tsx", "utf8");

describe("authoritative song marketplace sale (#4229)", () => {
  it("never charges a browser-nominated account or trusts a browser price", () => {
    expect(sql).toContain("v_actor uuid := auth.uid()");
    expect(sql).toContain("p_buyer_user_id IS DISTINCT FROM v_actor");
    expect(sql).toContain("p_sale_price<>v_price");
    expect(sql).toContain("v_listing.asking_price");
    expect(sql).toContain("v_listing.buyout_price");
    expect(sql).toContain("v_price<=0");
    expect(sql).not.toContain("WHERE user_id = p_buyer_user_id");
  });

  it("claims the listing and song, pins buyers to an active character, and updates one wallet per party", () => {
    expect(sql).toMatch(/public\.marketplace_listings[\s\S]*?WHERE id=p_listing_id FOR UPDATE;/);
    expect(sql).toContain("WHERE id=v_listing.song_id FOR UPDATE");
    expect(sql).toContain("v_song.user_id IS DISTINCT FROM v_listing.seller_user_id");
    expect(sql).toContain("v_buyer_profile_id:=public.current_active_player_profile_id()");
    expect(sql).toContain("WHERE id=v_buyer_profile_id AND user_id=v_actor");
    expect(sql).toContain("WHERE id=v_seller_profile_id AND user_id=v_listing.seller_user_id");
    expect(sql).toContain("profile_id=v_buyer_profile_id,band_id=NULL");
    expect(sql).toContain("Seller character attribution required");
    expect(sql).not.toContain("SET cash = cash - p_sale_price WHERE user_id");
  });

  it("prevents replay and survives the prior marketplace cancellation guard", () => {
    expect(sql).toContain("marketplace_transactions_one_completed_per_listing");
    expect(sql).toContain("listing_status <> 'active'");
    expect(sql).toContain("Listing has expired");
    expect(sql).toContain("v_song.is_purchased");
    const listingTransition = sql.indexOf("UPDATE public.marketplace_listings SET listing_status='sold'");
    const completedLedger = sql.indexOf("INSERT INTO public.marketplace_transactions(");
    expect(listingTransition).toBeGreaterThan(-1);
    expect(completedLedger).toBeGreaterThan(listingTransition);
    expect(sql).toContain("IF NOT FOUND THEN RAISE EXCEPTION 'MARKETPLACE_LISTING_CHANGED'");
  });

  it("blocks unsafe, unescrowed seller-accepted auction bids until #4230 is fixed", () => {
    expect(sql).toContain("Auction winning-bid settlement requires verified bidder escrow");
    expect(sql).toContain("v_listing.listing_type='auction'");
    expect(sql).toContain("v_listing.buyout_price IS NOT NULL");
    expect(hooks).not.toContain("const acceptBid = useMutation");
    expect(listings).toContain("Auction bid acceptance is temporarily unavailable");
    expect(listings).not.toContain("acceptBid.mutate");
  });

  it("attributes new listings to a character and hides band-owned songs", () => {
    expect(hooks).toContain("profile_id: profileId");
    expect(hooks).toContain('if (!userId || !profileId) throw new Error');
    expect(hooks).toContain('.is("band_id", null)');
    expect(hooks).toContain('supabase.rpc("complete_song_sale"');
  });

  it("retains a rollback-only validation fixture for spoofing, prices, replay and wallets", () => {
    expect(harness).toContain("BEGIN;");
    expect(harness).toContain("ROLLBACK;");
    expect(harness).toContain("forged_buyer_rejected");
    expect(harness).toContain("auction_bid_not_settled");
    expect(harness).toContain("repeat_rejected");
    expect(harness).toContain("all_other_account_characters_unchanged");
    expect(harness).toContain("two_unique_transactions");
  });
});
