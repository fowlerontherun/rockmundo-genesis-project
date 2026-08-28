import { describe, expect, it } from "vitest";
import { getEdgeFunctionErrorMessage } from "./edgeFunctionErrors";

describe("getEdgeFunctionErrorMessage", () => {
  it("surfaces the message returned by an Edge Function", async () => {
    const error = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      context: new Response(
        JSON.stringify({
          success: false,
          error: "scheduling_conflict",
          message: 'You have "Band rehearsal" scheduled at this time.',
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    });

    await expect(getEdgeFunctionErrorMessage(error)).resolves.toBe(
      'You have "Band rehearsal" scheduled at this time.',
    );
  });

  it("supports legacy responses that only return an error string", async () => {
    const error = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      context: new Response(JSON.stringify({ error: "User profile not found" }), { status: 500 }),
    });

    await expect(getEdgeFunctionErrorMessage(error)).resolves.toBe("User profile not found");
  });

  it("replaces Supabase's generic non-2xx message with the supplied fallback", async () => {
    const error = new Error("Edge Function returned a non-2xx status code");

    await expect(getEdgeFunctionErrorMessage(error, "Could not accept this offer.")).resolves.toBe(
      "Could not accept this offer.",
    );
  });
});
