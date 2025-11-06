import type { Tables } from "@/lib/supabase-types";

export type LabelRow = Tables<"labels">;
export type DealTypeRow = Tables<"label_deal_types">;
export type TerritoryRow = Tables<"territories">;
export type ContractRow = Tables<"artist_label_contracts">;
export type ReleaseRow = Tables<"label_releases">;
export type PromotionCampaignRow = Tables<"label_promotion_campaigns">;
export type RoyaltyStatementRow = Tables<"label_royalty_statements">;
export type RosterSlotRow = Tables<"label_roster_slots">;

export interface ArtistEntity {
  id: string;
  name: string;
  type: "solo" | "band";
  genre?: string | null;
  role?: string | null;
  bandId?: string;
}

export type LabelWithRelations = LabelRow & {
  label_roster_slots?: RosterSlotRow[];
  artist_label_contracts?: Pick<ContractRow, "id" | "status">[];
  label_territories?: { territory_code: string }[];
};

export type ContractWithRelations = ContractRow & {
  labels?: Pick<LabelRow, "id" | "name" | "reputation_score" | "headquarters_city"> | null;
  label_roster_slots?: Pick<RosterSlotRow, "id" | "slot_number" | "status"> | null;
  label_releases?: (ReleaseRow & { label_promotion_campaigns?: PromotionCampaignRow[] })[];
  label_royalty_statements?: RoyaltyStatementRow[];
  label_promotion_campaigns?: PromotionCampaignRow[];
};

export type ReleaseWithRelations = ReleaseRow & {
  contract?: Pick<ContractRow, "id" | "label_id" | "band_id" | "artist_profile_id" | "status" | "releases_completed" | "release_quota"> & {
    labels?: Pick<LabelRow, "id" | "name" | "reputation_score"> | null;
  } | null;
  label_promotion_campaigns?: PromotionCampaignRow[];
};

export type RoyaltyStatementWithRelations = RoyaltyStatementRow & {
  contract?: Pick<ContractRow, "id" | "label_id" | "band_id" | "artist_profile_id" | "advance_amount" | "recouped_amount" | "royalty_artist_pct"> & {
    labels?: Pick<LabelRow, "id" | "name"> | null;
  } | null;
  release?: Pick<ReleaseRow, "id" | "title" | "release_type" | "release_date"> | null;
};
