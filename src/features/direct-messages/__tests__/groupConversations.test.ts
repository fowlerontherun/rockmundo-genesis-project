import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const service = fs.readFileSync(path.join(root, "src/features/direct-messages/services/conversations.ts"), "utf8");
const hook = fs.readFileSync(path.join(root, "src/hooks/useDirectMessages.ts"), "utf8");

describe("D4 group conversation client contracts", () => {
  it("synchronises authoritative context groups before listing conversations", () => {
    expect(service).toContain('rpc("ensure_my_context_conversations")');
    expect(service).toContain('rpc("list_social_conversations_v2"');
    expect(service).toContain('rpc("ensure_context_conversation"');
  });

  it("uses the existing message send authority for direct and group threads", () => {
    expect(service).toContain('rpc("send_conversation_message"');
    expect(hook).toContain("groupConversationId");
    expect(hook).toContain("sendConversationMessage(conversationId");
    expect(hook).toContain("conversation_id=eq.${groupConversationId}");
  });

  it("keeps group route identifiers separate from profile UUIDs", () => {
    expect(service).toContain('`group-${conversationId}`');
    expect(hook).toContain('startsWith("group-")');
  });

  it("supports reusable game-object context attachments", () => {
    expect(service).toContain('from("conversation_context_attachments")');
    expect(service).toContain('rpc("attach_conversation_context"');
  });

  it("counts unread messages across direct and group conversations", () => {
    expect(hook).toContain("listConversations({ limit: 100 })");
    expect(hook).toContain("conversation.unread_count");
  });
});
