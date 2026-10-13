import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const get=(p:string)=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");
const worker=get("../../../supabase/functions/generate-daily-sales/index.ts");
const sql=get("../../../supabase/migrations/20261013180000_release_inventory_reconciliation_queue.sql");
describe("inventory recovery",()=>{
it("persists failed compensations and retains critical failure",()=>{
expect(worker).toContain('.from("release_inventory_reconciliation_queue")');
expect(worker).toContain("CRITICAL_INVENTORY_RECONCILIATION_REQUIRED");
});
it("allows privileged queue reconciliation without double settlement",()=>{
expect(sql).toContain("FOR UPDATE SKIP LOCKED");
expect(sql).toContain("restore_release_inventory_claim");
expect(sql).toContain("status='resolved'");
expect(sql).toContain("SERVICE_ROLE_REQUIRED");
});
});