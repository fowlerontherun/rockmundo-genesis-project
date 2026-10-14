import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const load = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const hook = load("src/hooks/useDirectMessages.ts");
const history = load("src/features/direct-messages/services/messageHistory.ts");
const thread = load("src/features/social-hub/components/DirectMessageThread.tsx");
const panel = load("src/features/relationships/components/DirectMessagePanel.tsx");

describe("direct-message active identity and lifecycle safeguards", () => {
  it("#4054 gates queries, realtime events, sends and reads to the selected character", () => {
    expect(hook).toContain("activeProfileId === myProfileId");
    expect(hook).toContain("const verifyActiveCharacter = async () => {");
    expect(hook).toContain("const activeProfile = await getActiveProfile(userId)");
    expect(hook).toContain("await verifyActiveCharacter();");
    expect(hook).toContain("enabled: isActiveCharacter && !!directOtherProfileId");
    expect(hook).toContain("enabled: isActiveCharacter && !!channelId && !!conversationId");
    expect(hook).toContain("if (!isActiveCharacter || !channelId || !myProfileId || !conversationId) return;");
    expect(hook).toContain("messages: isActiveCharacter ? mergeMessagePages(");
    expect(hook).toContain("if (!myProfileId || !userId || activeProfileId !== myProfileId) return;");
    expect(hook).toContain("await verifyActiveCharacter();\n      if (!conversationId || !canSendMessage) return;");
  });

  it("#4053 never falls back to legacy sending while conversation is unresolved", () => {
    expect(hook).toContain("conversationQuery.isSuccess");
    expect(hook).toContain("if (!conversationId || !canSendMessage)");
    expect(hook).toContain("await sendConversationMessage(conversationId, body, id)");
    expect(hook).not.toContain("sendDirectMessageService(");
    for (const component of [thread, panel]) {
      expect(component).toContain("canSendMessage");
      expect(component).toContain("Opening conversation");
      expect(component).toContain("disabled={!canSendMessage");
    }
  });

  it("#4052 watches both canonical conversation events and legacy pair events", () => {
    expect(hook).toContain("const invalidateThread = () => {");
    expect(hook).toContain("const channels = groupConversationId");
    expect(hook).toContain("`conversation_id=eq.${conversationId}`");
    expect(hook).toContain("`channel_id=eq.${directChannelId}`");
    expect(hook).toContain("for (const channel of channels) void supabase.removeChannel(channel);");
  });

  it("#4051 paginates direct history by the complete (created_at,id) tuple", () => {
    expect(hook).toContain('.order("created_at", { ascending: false })');
    expect(hook).toContain('.order("id", { ascending: false })');
    expect(hook).toContain("nextDirectMessageCursor(lastPage, 100)");
    expect(hook).toContain("directMessageHistoryPredicate(");
    expect(history).toContain("id.lt.${cursor.id}");
    expect(history).toContain("created_at.lt.${cursor.created_at}");
    expect(history).toContain("conversation_id.is.null,channel_id.eq.${channelId}");
    expect(hook).not.toContain('query.lt("created_at", pageParam)');
  });

  it("#4055 retains B retry key when A completes and scopes identity per character/thread", () => {
    expect(hook).toContain("new DirectMessageRetryTracker()");
    expect(hook).toContain("JSON.stringify([myProfileId, conversationId, directOtherProfileId ?? \"\", body])");
    expect(hook).toContain("retryIdentities.current.claim(identity)");
    expect(hook).toContain("retryIdentities.current.complete(identity, id)");
    expect(hook).not.toContain("retryIdentity.current = null");
  });
});
