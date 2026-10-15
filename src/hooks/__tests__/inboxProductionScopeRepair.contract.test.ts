import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repair = readFileSync(
  resolve(process.cwd(), "supabase/production-repairs/20261015_player_inbox_scope_repair.sql"),
  "utf8",
);

describe("production inbox scope repair", () => {
  it("preserves travel scoping while resolving only authenticated event ownership", () => {
    expect(repair).toContain("scope_player_inbox_character_context");
    expect(repair).toContain("NEW.related_entity_type = 'travel_timeline_event'");
    expect(repair).toContain("e.user_id = NEW.user_id");
    expect(repair).toContain("r.user_id = NEW.user_id");
    expect(repair).toContain("p.id = v_profile_id AND p.user_id = NEW.user_id");
    expect(repair).toContain("jsonb_build_object('profile_id', v_profile_id)");
  });

  it("marks account-wide bug report notifications explicitly", () => {
    expect(repair).toContain("NEW.related_entity_type IN ('bug_report', 'bug_report_response')");
    expect(repair).toContain('{"scope":"account"}');
  });

  it("does not guess the character for a multi-character account", () => {
    expect(repair).toContain("HAVING COUNT(*) = 1");
    expect(repair).toContain("jsonb_build_object('profile_id', one.profile_id)");
    expect(repair).not.toContain("LIMIT 1 FROM public.profiles");
    expect(repair).not.toContain("SET metadata = metadata || jsonb_build_object('scope', 'account')");
  });
});
