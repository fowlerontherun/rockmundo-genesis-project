import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const read=(p:string)=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");
const sql=read("../../../supabase/migrations/20261013140000_admin_xp_grant_idempotency.sql");
const handler=read("../../../supabase/functions/progression/handlers-admin.ts");
describe("admin grant idempotency",()=>{
it("rejects missing idempotency token and conflicts",()=>{
expect(handler).toContain("Admin grant requires a stable request_id");
expect(sql).toContain("ADMIN_GRANT_REQUEST_CONFLICT");
});
it("atomically records one request per target and credits once",()=>{
expect(sql).toContain("PRIMARY KEY(request_id,profile_id)");
expect(sql).toContain("IF v_inserted=0 THEN");
expect(sql).toContain("RETURN false");
expect(sql).toContain("INSERT INTO public.experience_ledger");
expect(handler).toContain("else if (applied === true)");
});
});