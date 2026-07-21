import { describe, expect, it } from "vitest";
import { isMissingSupabaseRpcError, SUPABASE_RPC_SCHEMA_UNAVAILABLE_MESSAGE } from "./supabaseRpcErrors";

describe("supabaseRpcErrors", () => {
  it("detects missing RPC and schema-cache errors", () => {
    expect(isMissingSupabaseRpcError({ code: "PGRST202" })).toBe(true);
    expect(isMissingSupabaseRpcError({ message: "Could not find the function public.get_banking_dashboard without parameters in the schema cache" })).toBe(true);
    expect(isMissingSupabaseRpcError({ details: "function not found" })).toBe(true);
    expect(isMissingSupabaseRpcError({ message: "network failed" })).toBe(false);
  });

  it("uses the safe player-facing service update message", () => {
    expect(SUPABASE_RPC_SCHEMA_UNAVAILABLE_MESSAGE).toBe("Banking is temporarily unavailable while the finance service is being updated. Please try again shortly.");
  });
});
