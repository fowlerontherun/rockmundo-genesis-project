import { describe, expect, it } from "vitest";
import { messagingPermissionService } from "../services/messagingPermissions";

const base = { senderProfileId: "sender", recipientProfileId: "recipient" };

describe("MessagingPermissionService", () => {
  it("allows friends even when recipient defaults to friends-only", () => {
    expect(messagingPermissionService.canStartConversation({ ...base, areFriends: true }).allowed).toBe(true);
  });

  it("allows shared band context through the central permission hook", () => {
    expect(messagingPermissionService.canStartConversation({ ...base, shareBand: true }).allowed).toBe(true);
  });

  it("uses neutral wording for blocked or restricted conversations", () => {
    const result = messagingPermissionService.canSendMessage({ ...base, blocked: true, areFriends: true });
    expect(result.allowed).toBe(false);
    expect(result.userMessage).toBe("Messaging is unavailable for this conversation.");
  });

  it("allows existing-conversation continuation separately from new starts", () => {
    expect(messagingPermissionService.canStartConversation({ ...base, recipientPreference: "existing_conversations", hasExistingConversation: true }).allowed).toBe(false);
    expect(messagingPermissionService.canSendMessage({ ...base, recipientPreference: "existing_conversations", hasExistingConversation: true }).allowed).toBe(true);
  });
});
