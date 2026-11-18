import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/pages/Modeling.tsx", "utf8");
const panel = readFileSync("src/components/modeling/ModelingOffersPanel.tsx", "utf8");
const generator = readFileSync("src/utils/modelingOfferGenerator.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20261019181734_character_scoped_modeling_contracts_account_identity.sql",
  "utf8",
);
const aclMigration = readFileSync(
  "supabase/migrations/20261019182118_remove_unsafe_modeling_contract_table_grants.sql",
  "utf8",
);
const catalogue = readFileSync(
  "supabase/migrations/20261019182143_seed_modest_modeling_gig_catalogue.sql",
  "utf8",
);
const smoke = readFileSync("supabase/tests/modeling_account_profile_rls_4232.sql", "utf8");
const atomic = readFileSync(
  "supabase/migrations/20261118180100_atomic_modeling_booking_settlement.sql",
  "utf8",
);

describe("modeling offer account/character identity (#4232)", () => {
  it("passes the authenticated account and selected character separately", () => {
    expect(page).toContain("const { profileId, userId } = useActiveProfile()");
    expect(page).toContain("userId={userId}");
    expect(page).toContain("profileId={profileId}");
    expect(page).not.toContain("userId={profileId}");
    expect(panel).toContain("userId: string;");
    expect(panel).toContain("profileId: string;");
    expect(panel).toContain('assertWellnessAllows(profileId, "pr_appearance")');
    expect(generator).toContain('p_profile_id: input.profileId');
    expect(panel).not.toContain("createScheduledActivity({");
  });

  it("reads character-scoped offers and generates only for the active character", () => {
    expect(panel).toContain('["modeling-offers-pending", profileId]');
    expect(panel).toContain('.eq("profile_id", profileId)');
    expect(panel).toContain("generateModelingOffersForUser(profileId)");
    expect(panel).toContain("isOfferCooldownExpired(profileId)");
    expect(generator).toContain("rpc('generate_modeling_offers_secure'");
    expect(generator).toContain("p_profile_id: profileId");
    expect(generator).toContain("cooldownKey(profileId)");
    expect(generator).toContain("if (error) throw error;");
    expect(generator).not.toContain(".insert(offers)");
    expect(atomic).toContain("v_actor uuid := (SELECT auth.uid())");
    expect(atomic).toContain("user_id=v_actor AND is_active=true");
    expect(atomic).toContain("Photo shoots are the entry path");
    expect(atomic).toContain("WHEN 'commercial' THEN 2");
  });

  it("enforces account ownership and character FK in production schema", () => {
    expect(migration).toContain("ALTER COLUMN profile_id SET NOT NULL");
    expect(migration).toContain("FOREIGN KEY (profile_id) REFERENCES public.profiles(id)");
    expect(migration).toContain("modeling_contract_identity_ambiguous_backfill");
    expect(migration).toContain("p.user_id=(SELECT auth.uid())");
    expect(migration).toContain("modeling_contract_identity_immutable");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
  });

  it("removes RLS-bypassing table grants and seeds an actual eligible catalogue", () => {
    expect(aclMigration).toContain("REVOKE ALL ON TABLE public.player_modeling_contracts");
    expect(aclMigration).toContain("GRANT SELECT,INSERT,UPDATE");
    expect(catalogue).toContain("Local Fashion Lookbook");
    expect(catalogue).toContain("Portrait Portfolio Session");
    expect(catalogue).toContain("modeling_agencies");
    expect(catalogue).toContain("WHERE NOT EXISTS");
  });

  it("preserves a non-destructive test for multiple characters and foreign accounts", () => {
    expect(smoke).toContain("BEGIN;");
    expect(smoke).toContain("ROLLBACK;");
    expect(smoke).toContain("SET LOCAL ROLE authenticated;");
    expect(smoke).toContain("request.jwt.claim.sub");
    expect(smoke).toContain("character_A_offer_scope_failed");
    expect(smoke).toContain("character_B_offer_scope_failed");
    expect(smoke).toContain("foreign_character_offer_allowed");
    expect(smoke).toContain("modeling_offer_identity_swap_allowed");
  });

  it("locks paid modeling terms to server-issued offers and a single character", () => {
    expect(atomic).toContain("REVOKE INSERT,UPDATE,DELETE ON public.player_modeling_contracts FROM authenticated");
    expect(atomic).toContain("CREATE TABLE IF NOT EXISTS public.modeling_offer_terms");
    expect(atomic).toContain("CREATE TABLE IF NOT EXISTS public.modeling_contract_settlements");
    expect(atomic).toContain("v_contract.profile_id<>p_profile_id");
    expect(atomic).toContain("modeling_offer_terms_unverified");
  });
});
