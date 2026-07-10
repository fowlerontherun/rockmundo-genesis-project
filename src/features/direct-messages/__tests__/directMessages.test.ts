import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

const { sendDirectMessage, validateDirectMessageInput } = await import("../services/directMessages");

const recipientProfileId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => vi.clearAllMocks());

describe("direct message safety service", () => {
  it("trims and validates message input before backend writes", () => {
    expect(validateDirectMessageInput(recipientProfileId, " hello ")).toEqual({
      recipientProfileId,
      body: "hello",
    });
  });

  it("rejects invalid recipients before backend writes", async () => {
    await expect(sendDirectMessage("not-a-profile", "hello")).rejects.toThrow("valid player");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects empty messages before backend writes", async () => {
    await expect(sendDirectMessage(recipientProfileId, "   ")).rejects.toThrow("Write a message");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects overlong messages before backend writes", async () => {
    await expect(sendDirectMessage(recipientProfileId, "x".repeat(2001))).rejects.toThrow("2,000");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends valid messages through the guarded RPC", async () => {
    rpc.mockResolvedValueOnce({ data: { id: "dm-1", body: "hello" }, error: null });

    await expect(sendDirectMessage(recipientProfileId, " hello ")).resolves.toMatchObject({ body: "hello" });
    expect(rpc).toHaveBeenCalledWith("send_direct_message", {
      recipient_profile_id: recipientProfileId,
      message_body: "hello",
    });
  });

  it("maps blocked or unauthorized backend failures to friendly errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "This player is not available for direct messages." } });

    await expect(sendDirectMessage(recipientProfileId, "hello")).rejects.toThrow("not available");
  });

  it("maps unauthenticated backend failures to friendly errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "You need an active player profile before sending direct messages." } });

    await expect(sendDirectMessage(recipientProfileId, "hello")).rejects.toThrow("Sign in");
  });
});
