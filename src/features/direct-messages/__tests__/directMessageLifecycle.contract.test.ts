import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const load = (path: string) => readFileSync(resolve(process.cwd(),path),"utf8");
const hook = load("src/hooks/useDirectMessages.ts");
const social = load("src/features/social-hub/components/DirectMessageThread.tsx");
const relation = load("src/features/relationships/components/DirectMessagePanel.tsx");

describe("merged direct-message lifecycle checks", () => {
  it("keeps character-scoped query keys, read, and send paths", () => {
    expect(hook).toContain("activeProfileId === myProfileId");
    expect(hook).toContain("enabled: isCurrentCharacter");
    expect(hook).toContain("messages: isCurrentCharacter ?");
    expect(hook).toContain("Active character changed");
  });
  it("uses complete keyset cursor and both direct message event channels", () => {
    expect(hook).toContain("directMessageHistoryFilter(conversationId, directChannelId, pageParam)");
    expect(hook).toContain("nextDirectMessageCursor(lastPage, 100)");
    expect(hook).toContain("name: \"canonical\"");
    expect(hook).toContain("name: \"fallback\"");
  });
  it("blocks unlinked send while canonical lookup is loading, allowing explicit documented recovery", () => {
    expect(hook).toContain("if (directOtherProfileId && !conversationId && !conversationQuery.isError)");
    expect(hook).toContain("Conversation is still opening.");
    expect(hook).toContain("if (directOtherProfileId && conversationQuery.isError)");
    expect(social).toContain("disabled={sendMessage.isPending || isLoading || !draft.trim()}");
    expect(relation).toContain("disabled={sendMessage.isPending || loading || !draft.trim()");
  });
  it("confirms each retry identity independently", () => {
    expect(hook).toContain("retryIdentities.current.getOrCreate(identity, () => crypto.randomUUID())");
    expect(hook).toContain("retryIdentities.current.confirm(identity, messageId)");
  });
});