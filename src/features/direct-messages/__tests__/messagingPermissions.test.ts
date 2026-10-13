import { describe, expect, it } from "vitest";
import { messagingPermissionService } from "../services/messagingPermissions";

const base = { senderProfileId: "sender", recipientProfileId: "recipient" };

describe("MessagingPermissionService", () => {
  it("allows friends even when recipient defaults to friends-only", () => {
    expect(messagingPermissionService.canStartConversation({ ...base, areFriends: true }).allowed).toBe(true);
  });

  it("only allows shared-band contact when band contact is enabled", () => {
    expect(messagingPermissionService.canStartConversation({ ...base, recipientPreference: "friends_and_band", shareBand: true }).allowed).toBe(true);
    expect(messagingPermissionService.canStartConversation({ ...base, recipientPreference: "friends", shareBand: true }).allowed).toBe(false);
  });

  it.each(["everyone", "friends", "friends_and_band", "existing_conversations"] as const)(
    "rejects coworker-only access under %s unless explicitly everyone", (preference) => {
      const result = messagingPermissionService.canSendMessage({ ...base, shareCompany: true, recipientPreference: preference });
      expect(result.allowed).toBe(preference === "everyone");
    },
  );

  it("none blocks friends, bands, coworkers and existing direct conversations", () => {
    const context = { ...base, recipientPreference: "none" as const, areFriends: true, shareBand: true, shareCompany: true, hasExistingConversation: true };
    expect(messagingPermissionService.canStartConversation(context).allowed).toBe(false);
    expect(messagingPermissionService.canSendMessage(context).allowed).toBe(false);
    expect(messagingPermissionService.canUploadAttachment(context).allowed).toBe(false);
  });

  it("friends-only does not allow old conversations, non-friend bands or coworkers", () => {
    expect(messagingPermissionService.canSendMessage({ ...base, recipientPreference: "friends", hasExistingConversation: true, shareBand: true, shareCompany: true }).allowed).toBe(false);
    expect(messagingPermissionService.canSendMessage({ ...base, recipientPreference: "friends", areFriends: true }).allowed).toBe(true);
  });

  it("friends_and_band does not allow coworkers or old chats alone", () => {
    expect(messagingPermissionService.canSendMessage({ ...base, recipientPreference: "friends_and_band", hasExistingConversation: true, shareCompany: true }).allowed).toBe(false);
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
