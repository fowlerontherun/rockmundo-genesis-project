import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const first = readFileSync(resolve(process.cwd(),
  "supabase/migrations/20250918174219_create_friendships_table.sql"), "utf8");
const repaired = readFileSync(resolve(process.cwd(),
  "supabase/migrations/20251013054723_7ccda721-13cc-4289-950b-54ae35e41898.sql"), "utf8");

describe("friendships clean schema replay", () => {
  it("does not rename nonexistent legacy columns from the September canonical table", () => {
    expect(first).toContain("requestor_id uuid NOT NULL");
    expect(first).toContain("addressee_id uuid NOT NULL");
    expect(repaired).toContain("column_name='user_id'");
    expect(repaired).toContain("column_name='friend_user_id'");
    expect(repaired).toContain("manual reconciliation required");
  });

  it("keeps friendship policies character-owned rather than comparing auth user IDs to profile IDs", () => {
    expect(repaired).toContain("p.id = requestor_id AND p.user_id = auth.uid()");
    expect(repaired).toContain("p.id = addressee_id AND p.user_id = auth.uid()");
    expect(repaired).not.toContain("auth.uid() = requestor_id");
    expect(repaired).not.toContain("auth.uid() = addressee_id");
  });
});
