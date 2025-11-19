import { awardsMockServer } from "@/mocks/awardsMockServer";

type Filter = Record<string, any>;

type SelectResult<T> = { data: T[]; error: null };

type InsertResult<T> = {
  data: T[];
  error: null;
  select: () => Promise<SelectResult<T>>;
  single: () => Promise<{ data: T; error: null }>;
};

const buildInsertResult = <T>(data: T[]): InsertResult<T> => ({
  data,
  error: null,
  select: async () => ({ data, error: null }),
  single: async () => ({ data: data[0], error: null }),
});

class MockQueryBuilder<T> {
  private filters: Filter = {};

  constructor(private table: string) {}

  eq(column: string, value: any) {
    this.filters[column] = value;
    return this;
  }

  order() {
    return this;
  }

  async select(): Promise<SelectResult<T>> {
    switch (this.table) {
      case "award_shows":
        return { data: awardsMockServer.getShows() as T[], error: null };
      case "award_nominations":
        return { data: awardsMockServer.getNominations(this.filters as any) as T[], error: null };
      case "award_wins":
        return { data: awardsMockServer.getWins(this.filters as any) as T[], error: null };
      default:
        return { data: [] as T[], error: null };
    }
  }

  async single() {
    const { data, error } = await this.select();
    return { data: (data as any)[0] ?? null, error };
  }

  insert(payload: any): InsertResult<T> {
    if (this.table === "award_nominations") {
      const created = awardsMockServer.submitNomination(payload);
      return buildInsertResult([created] as T[]);
    }

    if (this.table === "award_votes") {
      const created = awardsMockServer.castVote(payload.nomination_id, payload.voter_id);
      return buildInsertResult([{ ...created, id: payload.nomination_id }] as T[]);
    }

    return buildInsertResult([payload]);
  }

  delete() {
    return { data: [] as T[], error: null };
  }
}

export const supabaseMock = {
  auth: {
    async getUser() {
      return { data: { user: { id: "mock-user" } }, error: null };
    },
  },
  from<T>(table: string) {
    return new MockQueryBuilder<T>(table as any);
  },
  functions: {
    async invoke() {
      return { data: null, error: null };
    },
  },
  rpc: async () => ({ data: null, error: null }),
};
