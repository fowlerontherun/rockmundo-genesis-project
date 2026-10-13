import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const inbox = fs.readFileSync(path.join(root, "src/hooks/useInbox.ts"), "utf8");
const notifications = fs.readFileSync(path.join(root, "src/hooks/useNotificationsFeed.ts"), "utf8");

describe("stable inbox and notifications pagination contracts", () => {
  it("pages active and archived inbox by created_at and ID", () => {
    expect(inbox.match(/\.order\('created_at', \{ ascending: false \}\)/g)).toHaveLength(2);
    expect(inbox.match(/\.order\('id', \{ ascending: false \}\)/g)).toHaveLength(2);
    expect(inbox.match(/queryBuilder\.or\(beforeCreatedAtId\(cursor\)\)/g)).toHaveLength(2);
  });
  it("combines notification scope with keyset in the same OR expression", () => {
    expect(notifications).toContain("and(profile_id.eq.");
    expect(notifications).toContain("and(profile_id.is.null,or(");
    expect(notifications).toContain(".or(scope)");
    expect(notifications).toContain(".order(\"id\", { ascending: false })");
  });
});
