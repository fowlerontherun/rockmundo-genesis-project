import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const sql=readFileSync(fileURLToPath(new URL("../../../supabase/migrations/20261013183000_label_release_contract_safe.sql",import.meta.url)),"utf8");
describe("label owner contract release",()=>{
it("requires ownership and prevents advance write-offs",()=>{
expect(sql).toContain("LABEL_OWNER_REQUIRED");
expect(sql).toContain("UNRECOUPED_ADVANCE_REQUIRES_SETTLEMENT");
expect(sql).toContain("FOR UPDATE");
expect(sql).toContain("AND status='active'");
});
});