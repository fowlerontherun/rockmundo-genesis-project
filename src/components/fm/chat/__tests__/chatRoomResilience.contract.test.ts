import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("chat room resilience", () => {
  const hook = read("src/components/fm/chat/useChatRoom.ts");
  const view = read("src/components/fm/chat/ChatRoomView.tsx");

  it("invalidates stale room loads when the selected channel changes", () => {
    expect(hook).toContain("const requestId = ++requestIdRef.current");
    expect(hook).toContain("if (requestId !== requestIdRef.current) return");
    expect(hook).toContain("requestIdRef.current += 1");
  });

  it("exposes room load failures instead of presenting an empty room", () => {
    expect(hook).toContain('setError("Chat messages could not be loaded.")');
    expect(hook).toContain("error,");
    expect(hook).toContain("refetch: fetchMessages");
    expect(view).toContain("role=\"alert\"");
    expect(view).toContain("Retry");
    expect(view).toContain("onClick={() => void refetch()}");
  });
});
