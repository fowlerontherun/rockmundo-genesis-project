import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

const { sendDirectMessage, validateDirectMessageInput } = await import("../services/directMessages");

const recipientProfileId = "22222222-2222-4222-8222-222222222222";
const clientMessageId = "33333333-3333-4333-8333-333333333333";

beforeEach(() => vi.clearAllMocks());

describe("direct message safety service", () => {
  it("trims and validates message input before backend writes", () => {
    expect(validateDirectMessageInput(recipientProfileId, " hello ")).toEqual({
      recipientProfileId,
      body: "hello",
    });
  });

  it("rejects invalid recipients before backend writes", async () => {
    await expect(sendDirectMessage("not-a-profile", "hello", clientMessageId)).rejects.toThrow("valid player");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects empty messages before backend writes", async () => {
    await expect(sendDirectMessage(recipientProfileId, "   ", clientMessageId)).rejects.toThrow("Write a message");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects overlong messages before backend writes", async () => {
    await expect(sendDirectMessage(recipientProfileId, "x".repeat(2001), clientMessageId)).rejects.toThrow("2,000");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends valid messages through the guarded RPC", async () => {
    rpc.mockResolvedValueOnce({ data: { id: "dm-1", body: "hello" }, error: null });

    await expect(sendDirectMessage(recipientProfileId, " hello ", clientMessageId)).resolves.toMatchObject({ body: "hello" });
    expect(rpc).toHaveBeenCalledWith("send_direct_message_idempotent", {
      p_recipient_profile_id: recipientProfileId,
      p_message_body: "hello",
      p_client_message_id: clientMessageId,
    });
  });

  it("maps blocked or unauthorized backend failures to friendly errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "This player is not available for direct messages." } });

    await expect(sendDirectMessage(recipientProfileId, "hello", clientMessageId)).rejects.toThrow("not available");
  });

  it("maps unauthenticated backend failures to friendly errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "You need an active player profile before sending direct messages." } });

    await expect(sendDirectMessage(recipientProfileId, "hello", clientMessageId)).rejects.toThrow("Sign in");
  });
});
