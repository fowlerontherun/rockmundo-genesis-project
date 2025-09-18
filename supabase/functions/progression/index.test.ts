import { describe, expect, it } from "bun:test";

import { fetchProfileState, loadActiveProfile } from "./index.ts";
import type { Database } from "../../../src/lib/supabase-types.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

type QueryResult = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

class MockQuery<T> {
  #single = false;
  constructor(private readonly result: QueryResult) {}

  select(_columns: string) {
    return this;
  }

  eq(_column: string, _value: unknown) {
    return this;
  }

  order(_column: string, _options?: { ascending?: boolean; nullsFirst?: boolean }) {
    return this;
  }

  limit(_count: number) {
    return this;
  }

  maybeSingle() {
    this.#single = true;
    return this;
  }

  then<TResult1 = unknown, TResult2 = unknown>(
    onfulfilled?: (value: TResult1) => TResult1 | Promise<TResult1>,
    onrejected?: (reason: TResult2) => TResult2 | Promise<TResult2>,
  ) {
    const payload = this.#buildPayload() as TResult1;
    return Promise.resolve(payload).then(onfulfilled, onrejected);
  }

  #buildPayload() {
    if (this.result.error) {
      return this.#single
        ? { data: null, error: this.result.error }
        : { data: [], error: this.result.error };
    }

    const data = this.result.data;

    if (this.#single) {
      if (Array.isArray(data)) {
        return { data: data[0] ?? null, error: null };
      }
      return { data: data ?? null, error: null };
    }

    if (Array.isArray(data)) {
      return { data, error: null };
    }

    if (data === null || data === undefined) {
      return { data: [], error: null };
    }

    return { data: [data], error: null };
  }
}

class MockSupabaseClient {
  constructor(private readonly tables: Record<string, QueryResult>) {}

  from(_table: string) {
    const result = this.tables[_table] ?? { data: [], error: null };
    return new MockQuery(result);
  }
}

describe("progression profile state", () => {
  const profileRow: Database["public"]["Tables"]["profiles"]["Row"] = {
    id: "profile-1",
    user_id: "user-1",
    username: "player_one",
    display_name: "Player One",
    avatar_url: null,
    bio: null,
    level: 5,
    experience: 1200,
    experience_at_last_weekly_bonus: 900,
    cash: 0,
    fame: 10,
    fans: 25,
    last_weekly_bonus_at: "2024-01-01T00:00:00Z",
    weekly_bonus_streak: 2,
    weekly_bonus_metadata: { streak: 2, bonus_awarded: 150 },
    created_at: "2023-12-01T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
  };

  const walletRow: Database["public"]["Tables"]["player_xp_wallet"]["Row"] = {
    profile_id: "profile-1",
    xp_balance: 500,
    lifetime_xp: 3000,
    xp_spent: 200,
    attribute_points_earned: 7,
    skill_points_earned: 4,
    last_recalculated: "2024-01-02T00:00:00Z",
  };

  const attributesRow: Database["public"]["Tables"]["player_attributes"]["Row"] = {
    id: "attr-1",
    profile_id: "profile-1",
    created_at: "2023-12-01T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
    attribute_points: 3,
    attribute_points_spent: 4,
    physical_endurance: 0,
    mental_focus: 0,
    stage_presence: 0,
    crowd_engagement: 0,
    social_reach: 0,
    creativity: 0,
    technical: 0,
    business: 0,
    marketing: 0,
    composition: 0,
    musical_ability: 0,
    vocal_talent: 0,
    rhythm_sense: 0,
    creative_insight: 0,
    technical_mastery: 0,
    business_acumen: 0,
    marketing_savvy: 0,
    user_id: null,
  };

  const baseClient = () => new MockSupabaseClient({
    profiles: { data: [profileRow], error: null },
    player_xp_wallet: { data: walletRow, error: null },
    player_attributes: { data: attributesRow, error: null },
  });

  it("loads a profile without legacy point columns", async () => {
    const client = baseClient();
    const { profile } = await loadActiveProfile(
      client as unknown as SupabaseClient<Database>,
      "user-1",
    );

    expect(profile.username).toBe("player_one");
    expect(profile.weekly_bonus_metadata).toEqual({ streak: 2, bonus_awarded: 150 });
    expect((profile as unknown as Record<string, unknown>).attribute_points_available).toBeUndefined();
  });

  it("derives point availability from wallet and attributes", async () => {
    const client = baseClient();
    const state = await fetchProfileState(
      client as unknown as SupabaseClient<Database>,
      "profile-1",
    );

    expect(state.pointAvailability).toEqual({
      attribute_points_available: 3,
      skill_points_available: 4,
    });
    expect(state.profile.weekly_bonus_metadata).toEqual({ streak: 2, bonus_awarded: 150 });
  });
});
