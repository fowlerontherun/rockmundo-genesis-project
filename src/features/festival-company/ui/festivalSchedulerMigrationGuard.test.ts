import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20291215090000_festival_phase2a_visual_scheduling.sql"), "utf8");

describe("revisioned festival scheduler migration safeguards", () => {
  it("keeps generated template slots private until explicitly approved", () => {
    expect(migration).toContain("'publicVisible',false),NULL,key)");
    expect(migration).toContain("UPDATE public.festival_schedule_items SET status='published'");
    expect(migration).not.toContain("SET public_visible=true, status='published'");
  });

  it("uses unique numbered keys for repeated template slot titles", () => {
    expect(migration).toContain("item_index:=item_index+1");
    expect(migration).toContain("item_index::text");
    expect(migration).not.toContain("replace(item->>'title',' ','_')");
  });

  it("rejects publication of locked or archived revisions", () => {
    expect(migration).toContain("IF r.state NOT IN ('draft','ready_for_review') THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_REVISION_NOT_EDITABLE'; END IF; conflicts:=");
  });

  it("does not expose internal revision fields in the public projection", () => {
    expect(migration).toContain("'revision',(SELECT jsonb_build_object('id',r.id,'revisionNumber',r.revision_number,'publishedAt',r.published_at) FROM r)");
    expect(migration).not.toContain("'revision',(SELECT to_jsonb(r) FROM r)");
  });

  it("protects scheduler tables and revokes public privileged RPC execution", () => {
    for (const table of ["festival_schedule_revisions", "festival_schedule_stage_operating_hours", "festival_schedule_items", "festival_schedule_audit_events"]) {
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    }
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.festival_schedule_publish(uuid,uuid,boolean,text) FROM PUBLIC, anon;");
  });
});
