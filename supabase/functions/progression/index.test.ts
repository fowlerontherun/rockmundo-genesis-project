import { describe, expect, it } from "bun:test";

import { fetchProfileState, loadActiveProfile, __TESTING__ } from "./index.ts";
import type { Database } from "../../../src/lib/supabase-types.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

type QueryResult = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

class MockQuery<T> {
  #single = false;
  constructor(
    private readonly table: string,
    private readonly result: QueryResult,
    private readonly client: {
      recordInsert: (table: string, values: unknown) => void;
      getInsertError: (table: string) => QueryResult["error"] | null;
    },
  ) {}

  select(_columns: string) {
    return this;
  }

  eq(_column: string, _value: unknown) {
    return this;
  }

  in(_column: string, _values: unknown[]) {
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

  insert(values: unknown) {
    const error = this.client.getInsertError(this.table);
    if (error) {
      return Promise.resolve({ data: null, error });
    }

    this.client.recordInsert(this.table, values);
    const payload = Array.isArray(values) ? values : [values];
    return Promise.resolve({ data: payload, error: null });
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
  readonly inserted: Record<string, unknown[]> = {};
  readonly rpcCalls: { name: string; args: Record<string, unknown> }[] = [];

  constructor(
    private readonly tables: Record<string, QueryResult>,
    private readonly rpcResults: Record<string, QueryResult> = {},
    private readonly insertErrors: Record<string, QueryResult["error"]> = {},
  ) {}

  from(_table: string) {
    const result = this.tables[_table] ?? { data: [], error: null };
    return new MockQuery(_table, result, this);
  }

  recordInsert(table: string, values: unknown) {
    const payload = Array.isArray(values) ? values : [values];
    this.inserted[table] = [...(this.inserted[table] ?? []), ...payload];
  }

  getInsertError(table: string) {
    return this.insertErrors[table] ?? null;
  }

  rpc(name: string, args: Record<string, unknown>) {
    this.rpcCalls.push({ name, args });
    const result = this.rpcResults[name] ?? { data: null, error: null };
    return Promise.resolve(result);
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

describe("admin progression actions", () => {
  const { ACTION_HANDLERS } = __TESTING__;

  const adminProfile = {
    id: "admin-profile",
    user_id: "admin-1",
    username: "admin",
    display_name: "Admin",
    avatar_url: null,
    bio: null,
    level: 1,
    experience: 0,
    experience_at_last_weekly_bonus: 0,
    cash: 0,
    fame: 0,
    fans: 0,
    last_weekly_bonus_at: null,
    weekly_bonus_streak: 0,
    weekly_bonus_metadata: {},
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  } satisfies Database["public"]["Tables"]["profiles"]["Row"];

  const createContext = (client: MockSupabaseClient) => ({
    client: client as unknown as SupabaseClient<Database>,
    user: { id: "admin-1" },
    profile: adminProfile,
  });

  it("awards special XP to selected players efficiently", async () => {
    const tables: Record<string, QueryResult> = {
      user_roles: { data: { role: "admin" }, error: null },
      profiles: {
        data: [
          { id: "profile-10", user_id: "user-10", username: "alpha", display_name: "Alpha" },
          { id: "profile-20", user_id: "user-20", username: "beta", display_name: "Beta" },
          { id: "profile-30", user_id: "user-30", username: "gamma", display_name: "Gamma" },
        ],
        error: null,
      },
      notifications: { data: [], error: null },
    };

    const rpcResults: Record<string, QueryResult> = {
      progression_award_special_xp: {
        data: { message: "ok" },
        error: null,
      },
    };

    const client = new MockSupabaseClient(tables, rpcResults);
    const ctx = createContext(client);

    const result = await ACTION_HANDLERS.admin_award_special_xp(ctx as any, {
      amount: 150,
      profile_ids: ["profile-10", "profile-20", "profile-30"],
      reason: "Tour kickoff reward",
    });

    expect(result.message).toContain("Granted 150 XP to 3 players");
    expect(client.rpcCalls).toHaveLength(3);
    expect(client.rpcCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "progression_award_special_xp",
          args: expect.objectContaining({ p_profile_id: "profile-10", p_amount: 150 }),
        }),
        expect.objectContaining({
          name: "progression_award_special_xp",
          args: expect.objectContaining({ p_profile_id: "profile-20", p_amount: 150 }),
        }),
        expect.objectContaining({
          name: "progression_award_special_xp",
          args: expect.objectContaining({ p_profile_id: "profile-30", p_amount: 150 }),
        }),
      ]),
    );
    expect(client.inserted.notifications?.length ?? 0).toBe(3);
  });

  it("adjusts momentum for selected players when authorized", async () => {
    const tables: Record<string, QueryResult> = {
      user_roles: { data: { role: "admin" }, error: null },
      profiles: {
        data: [
          { id: "profile-2", user_id: "user-2", username: "target", display_name: "Target" },
        ],
        error: null,
      },
      notifications: { data: [], error: null },
    };

    const rpcResults: Record<string, QueryResult> = {
      progression_admin_adjust_momentum: {
        data: {
          profile_id: "profile-2",
          momentum_before: 10,
          momentum_after: 20,
          momentum_delta: 10,
          reason: "Calibration",
        },
        error: null,
      },
    };

    const client = new MockSupabaseClient(tables, rpcResults);
    const ctx = createContext(client);

    const result = await ACTION_HANDLERS.admin_adjust_momentum(ctx as any, {
      amount: 10,
      profile_ids: ["profile-2"],
      reason: "Calibration",
    });

    expect(result.message).toContain("Adjusted momentum");
    expect(client.rpcCalls).toHaveLength(1);
    expect(client.rpcCalls[0]).toEqual({
      name: "progression_admin_adjust_momentum",
      args: expect.objectContaining({
        p_profile_id: "profile-2",
        p_amount: 10,
      }),
    });
    expect(client.inserted.notifications?.length ?? 0).toBe(1);
  });

  it("rejects momentum adjustments when user lacks admin role", async () => {
    const tables: Record<string, QueryResult> = {
      user_roles: { data: null, error: null },
    };

    const client = new MockSupabaseClient(tables);
    const ctx = createContext(client);

    await expect(ACTION_HANDLERS.admin_adjust_momentum(ctx as any, {
      amount: 5,
      profile_ids: ["profile-2"],
    })).rejects.toThrow("Admin privileges are required");
  });

  it("rejects zero-value momentum adjustments", async () => {
    const tables: Record<string, QueryResult> = {
      user_roles: { data: { role: "admin" }, error: null },
      profiles: {
        data: [
          { id: "profile-3", user_id: "user-3", username: "hero", display_name: "Hero" },
        ],
        error: null,
      },
    };

    const client = new MockSupabaseClient(tables);
    const ctx = createContext(client);

    await expect(ACTION_HANDLERS.admin_adjust_momentum(ctx as any, {
      amount: 0,
      profile_ids: ["profile-3"],
    })).rejects.toThrow("Momentum adjustment must be a non-zero number");
  });

  it("updates the daily XP stipend and notifies players when requested", async () => {
    const tables: Record<string, QueryResult> = {
      user_roles: { data: { role: "admin" }, error: null },
      profiles: {
        data: [
          { id: "profile-4", user_id: "user-4", username: "alpha", display_name: "Alpha" },
          { id: "profile-5", user_id: "user-5", username: "bravo", display_name: "Bravo" },
        ],
        error: null,
      },
      notifications: { data: [], error: null },
    };

    const rpcResults: Record<string, QueryResult> = {
      progression_admin_set_daily_xp: {
        data: {
          previous_amount: 150,
          daily_xp_amount: 200,
          updated_at: "2025-01-01T00:00:00Z",
          metadata: {},
        },
        error: null,
      },
    };

    const client = new MockSupabaseClient(tables, rpcResults);
    const ctx = createContext(client);

    const result = await ACTION_HANDLERS.admin_set_daily_xp(ctx as any, {
      amount: 200,
      notify: true,
      apply_to_all: true,
      reason: "System balance update",
    });

    expect(result.message).toContain("Daily XP stipend set to 200 XP");
    expect(result.result).toMatchObject({
      daily_xp_amount: 200,
      notified_count: 2,
    });
    expect(client.rpcCalls[0]).toEqual({
      name: "progression_admin_set_daily_xp",
      args: expect.objectContaining({
        p_new_amount: 200,
        p_reason: "System balance update",
      }),
    });
    expect(client.inserted.notifications?.length ?? 0).toBe(2);
  });

  it("rejects daily stipend updates from non-admins", async () => {
    const tables: Record<string, QueryResult> = {
      user_roles: { data: null, error: null },
    };

    const client = new MockSupabaseClient(tables);
    const ctx = createContext(client);

    await expect(ACTION_HANDLERS.admin_set_daily_xp(ctx as any, {
      amount: 150,
    })).rejects.toThrow("Admin privileges are required");
  });

  it("rejects invalid daily stipend amounts", async () => {
    const tables: Record<string, QueryResult> = {
      user_roles: { data: { role: "admin" }, error: null },
    };

    const client = new MockSupabaseClient(tables);
    const ctx = createContext(client);

    await expect(ACTION_HANDLERS.admin_set_daily_xp(ctx as any, {
      amount: 0,
    })).rejects.toThrow("Daily XP amount must be a positive integer");
  });
});
