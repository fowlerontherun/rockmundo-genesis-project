import { describe, expect, it, mock } from "bun:test";
import type { Database } from "../../../src/types/database-fallback.ts";

mock.module("https://esm.sh/@supabase/supabase-js@2.57.4", () => ({
  createClient: () => {
    throw new Error("createClient should not be called in tests");
  },
}));

mock.module("../_shared/deno/std@0.168.0/http/server.ts", () => ({
  serve: () => undefined,
}));

const { handleSpendSkillXp } = await import("./handlers.ts");

type ProfileState = {
  profile: Database["public"]["Tables"]["profiles"]["Row"];
  wallet: Database["public"]["Tables"]["player_xp_wallet"]["Row"] | null;
  attributes: Database["public"]["Tables"]["player_attributes"]["Row"] | null;
  pointAvailability: {
    attribute_points_available: number;
    skill_points_available: number;
  };
};

class MockSupabaseClient {
  public lastUpserts: Record<string, unknown> = {};

  constructor(
    private tables: Partial<{
      [K in keyof Database["public"]["Tables"]]: Array<
        Database["public"]["Tables"][K]["Row"]
      >;
    }> = {},
  ) {}

  from(table: keyof Database["public"]["Tables"]) {
    const matchKeys: Partial<
      Record<keyof Database["public"]["Tables"], string[]>
    > = {
      skill_progress: ["profile_id", "skill_slug"],
      player_xp_wallet: ["profile_id"],
      profiles: ["id"],
      player_attributes: ["profile_id"],
    };

    const client = this;
    const query = {
      filters: [] as Array<{ column: string; value: unknown }>,
      select() {
        return query;
      },
      eq(column: string, value: unknown) {
        query.filters.push({ column, value });
        return query;
      },
      maybeSingle() {
        const rows = (client.tables[table] ?? []) as Array<Record<string, unknown>>;
        const match = rows.find((row) =>
          query.filters.every((filter) => row?.[filter.column] === filter.value),
        );
        return Promise.resolve({ data: (match ?? null) as unknown, error: null });
      },
      upsert(payload: Record<string, unknown> | Record<string, unknown>[], _options?: unknown) {
        const payloads = Array.isArray(payload) ? payload : [payload];
        const existingRows = (client.tables[table] ?? []) as Array<Record<string, unknown>>;
        const keys = matchKeys[table] ?? [];
        const updatedRows = [...existingRows];

        let lastEntry: Record<string, unknown> | null = null;
        for (const entry of payloads) {
          const index = updatedRows.findIndex((row) =>
            keys.length === 0
              ? false
              : keys.every((key) => row?.[key] === entry[key]),
          );
          const base = index >= 0 ? updatedRows[index] : {};
          const merged = { ...base, ...entry } as Record<string, unknown>;

          if (index >= 0) {
            updatedRows[index] = merged;
          } else {
            updatedRows.push(merged);
          }

          lastEntry = merged;
        }

        client.tables[table] = updatedRows as never;
        client.lastUpserts[table as string] = Array.isArray(payload)
          ? payloads.map((entry) => ({ ...entry }))
          : lastEntry;

        return Promise.resolve({ data: null, error: null });
      },
      update(payload: Record<string, unknown>) {
        return {
          eq(column: string, value: unknown) {
            query.filters.push({ column, value });
            const rows = (client.tables[table] ?? []) as Array<Record<string, unknown>>;
            let updatedRow: Record<string, unknown> | null = null;

            const nextRows = rows.map((row) => {
              const matches = query.filters.every((filter) => row?.[filter.column] === filter.value);
              if (matches) {
                updatedRow = { ...row, ...payload };
                return updatedRow;
              }
              return row;
            });

            client.tables[table] = nextRows as never;
            return Promise.resolve({ data: updatedRow, error: null });
          },
        };
      },
    };

    return query;
  }
}

describe("handleSpendSkillXp", () => {
  it("applies escalating XP thresholds when multiple levels are earned", async () => {
    const profileRow: Database["public"]["Tables"]["profiles"]["Row"] = {
      id: "profile-1",
      user_id: "user-1",
      username: "player_one",
      display_name: "Player One",
      age: 21,
      level: 0,
      experience: 0,
      cash: 0,
      fame: 0,
      fans: 0,
      experience_at_last_weekly_bonus: 0,
      last_weekly_bonus_at: "2024-01-01T00:00:00Z",
      weekly_bonus_streak: 0,
      weekly_bonus_metadata: {},
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    const walletRow: Database["public"]["Tables"]["player_xp_wallet"]["Row"] = {
      profile_id: "profile-1",
      xp_balance: 1000,
      xp_spent: 0,
      lifetime_xp: 1000,
      skill_points_earned: 0,
      attribute_points_earned: 0,
      last_recalculated: "2024-01-01T00:00:00Z",
    };

    const skillRow: Database["public"]["Tables"]["skill_progress"]["Row"] = {
      id: "skill-1",
      profile_id: "profile-1",
      skill_slug: "guitar",
      current_level: 0,
      current_xp: 0,
      required_xp: 100,
      last_practiced_at: "2024-01-01T00:00:00Z",
      metadata: {},
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    const mockClient = new MockSupabaseClient({
      profiles: [profileRow],
      player_xp_wallet: [walletRow],
      skill_progress: [skillRow],
      player_attributes: [],
    });

    const profileState: ProfileState = {
      profile: profileRow,
      wallet: walletRow,
      attributes: null,
      pointAvailability: {
        attribute_points_available: 0,
        skill_points_available: 0,
      },
    };

    const result = await handleSpendSkillXp(
      mockClient as unknown as Parameters<typeof handleSpendSkillXp>[0],
      "user-1",
      profileState,
      "guitar",
      400,
    );

    const skillUpsert = mockClient.lastUpserts["skill_progress"] as Record<string, unknown>;

    expect(skillUpsert.current_level).toBe(2);
    expect(skillUpsert.current_xp).toBe(150);
    expect(skillUpsert.required_xp).toBe(Math.floor(100 * Math.pow(1.5, 2)));

    expect(result.state.wallet?.xp_balance).toBe(600);
  });
});
