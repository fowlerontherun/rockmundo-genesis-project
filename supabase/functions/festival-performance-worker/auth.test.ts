import { assert, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isTrustedFestivalWorkerRequest } from "./auth.ts";

Deno.test("scheduled-style x-worker-secret request is accepted", () => {
  const request = new Request("https://worker.invalid", { method: "POST", headers: { "x-worker-secret": "vault-value" } });
  assert(isTrustedFestivalWorkerRequest(request, "vault-value"));
});

Deno.test("invalid or unconfigured worker secrets are rejected", () => {
  const request = new Request("https://worker.invalid", { method: "POST", headers: { "x-worker-secret": "wrong" } });
  assertFalse(isTrustedFestivalWorkerRequest(request, "vault-value"));
  assertFalse(isTrustedFestivalWorkerRequest(request, undefined));
});
