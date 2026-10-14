import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");
const hook = read("src/hooks/useDirectMessages.ts");
const socialThread = read("src/features/social-hub/components/DirectMessageThread.tsx");
const relationThread = read("src/features/relationships/components/DirectMessagePanel.tsx");

describe("character-safe direct messaging five issue patch", () => {
  it("#4051 uses full keyset pagination and one scoped PostgREST OR filter", () => {
    expect(hook).toContain("nextDirectMessageCursor(lastPage, 100)");
    expect(hook).toContain("directMessageHistoryFilter(conversationId, directChannelId, pageParam)");
    expect(hook).not.toContain('query.lt("created_at", pageParam)');
  });

  it("#4052 subscribes to canonical and unlinked fallback direct messages", () => {
    expect(hook).toContain('name: "canonical", filter: `conversation_id=eq.${conversationId}`');
    expect(hook).toContain('name: "fallback", filter: `channel_id=eq.${directChannelId}`');
    expect(hook).toContain("if (target.fallback && row.conversation_id != null) return");
    expect(hook).toContain("channels.forEach((channel) => void supabase.removeChannel(channel))");
  });

  it("#4053 waits for canonical conversation lookup and disables both send buttons", () => {
    expect(hook).toContain("if (directOtherProfileId && !conversationId && !conversationQuery.isError)");
    expect(hook).toContain("Conversation is still opening.");
    expect(hook).toContain("if (directOtherProfileId && conversationQuery.isError)");
    expect(socialThread).toContain("sendMessage.isPending || isLoading || !draft.trim()");
    expect(relationThread).toContain("sendMessage.isPending || loading || !draft.trim()");
  });

  it("#4054 refuses to load, send, read or expose messages for a stale character", () => {
    expect(hook).toContain("activeProfileId === myProfileId");
    expect(hook).toContain("enabled: isCurrentCharacter && !!directOtherProfileId");
    expect(hook).toContain("enabled: isCurrentCharacter && !!channelId");
    expect(hook).toContain("if (!channelId || !isCurrentCharacter) return");
    expect(hook).toContain("if (!isCurrentCharacter || !myProfileId)");
    expect(hook).toContain("if (!isCurrentCharacter || !myProfileId) throw");
    expect(hook).toContain("messages: isCurrentCharacter ?");
  });

  it("#4055 only confirms the completed request's own retry key", () => {
    expect(hook).toContain("getOrCreate(identity, () => crypto.randomUUID())");
    expect(hook).toContain("onSuccess: ({ identity, messageId })");
    expect(hook).toContain("retryIdentities.current.confirm(identity, messageId)");
    expect(hook).not.toContain("retryIdentity.current = null");
  });
});
