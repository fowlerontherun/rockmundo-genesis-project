import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261019072928_atomic_authenticated_song_marketplace_sales.sql",
  "utf8",
);
const containment = readFileSync(
  "supabase/migrations/20261019072647_revoke_unauthorised_song_marketplace_settlement.sql",
  "utf8",
);
const harness = readFileSync(
  "supabase/tests/song_marketplace_atomic_authority_harness.sql",
  "utf8",
);
const client = readFileSync("src/hooks/useSongAuctions.ts", "utf8");

describe("marketplace sale authority (#4229)", () => {
  it("does not expose legacy caller-supplied purchase amount or buyer ID", () => {
    expect(containment).toContain(
      "revoke all on function public.complete_song_sale(uuid,uuid,numeric) from public,anon,authenticated;",
    );
    expect(containment).toContain(
      "revoke all on function public.place_song_bid(uuid,uuid,numeric) from public,anon,authenticated;",
    );
    expect(migration).toContain("revoke insert on public.marketplace_transactions");
    expect(migration).toContain("revoke insert on public.marketplace_bids");
    expect(client).not.toContain('supabase.rpc("complete_song_sale"');
    expect(client).not.toContain('supabase.rpc("place_song_bid"');
  });

  it("derives the buyer character and sale price, and settles under a lock", () => {
    expect(client).toContain('p_action: "buy"');
    expect(client).toContain('p_action: "accept_bid"');
    expect(client).toContain("p_actor_profile_id: profileId");
    expect(migration).toContain("v_account:=auth.uid()");
    expect(migration).toContain("v_listing.listing_type='fixed_price'");
    expect(migration).toContain("v_price:=v_listing.asking_price");
    expect(migration).toContain("v_price:=v_listing.buyout_price");
    expect(migration).toContain("v_price:=v_bid.bid_amount");
    expect(migration).toContain("where id=p_listing_id for update");
    expect(migration).toContain("marketplace_one_completed_sale_per_listing_20261019");
    expect(migration).toContain("where id=v_buyer_profile_id and cash>=v_price");
    expect(migration).toContain("where id=v_seller_profile_id");
    expect(migration).toContain("v_song.user_id<>v_listing.seller_user_id");
  });

  it("binds auction bids to a real authenticated character", () => {
    expect(client).toContain('supabase.rpc("place_song_bid_authorized"');
    expect(migration).toContain("bidder_profile_id");
    expect(migration).toContain("song_bid_profile_not_owned");
    expect(migration).toContain("song_bid_insufficient_cash");
    expect(migration).toContain("song_sale_missing_authorized_bid");
  });

  it("keeps a rollback-only transactional fraud and economy integration suite", () => {
    expect(harness).toContain("BEGIN;");
    expect(harness).toContain("ROLLBACK;");
    expect(harness).toContain("borrowed_other_profile");
    expect(harness).toContain("fixed_price_settlement_incorrect");
    expect(harness).toContain("accepted_bid_settlement_incorrect");
    expect(harness).toContain("legacy_sale_accepted_tampered_price");
  });
});
