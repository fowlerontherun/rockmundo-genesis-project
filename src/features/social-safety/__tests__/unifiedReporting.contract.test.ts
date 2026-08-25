import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("D3 unified social reporting authority", () => {
  it("routes Twaater reporting through the unified RPC instead of the removed legacy report table", () => {
    const source = read("src/hooks/useTwaaterModeration.ts");
    expect(source).toContain('rpc("report_social_target"');
    expect(source).toContain('target_type: "twaater_post"');
    expect(source).not.toContain('from("twaat_reports"');
  });

  it("offers content-level reporting on DMs, chat and social invites", () => {
    expect(read("src/features/social-hub/components/DirectMessageThread.tsx")).toContain('targetType="direct_message"');
    expect(read("src/components/fm/chat/ChatRoomView.tsx")).toContain('targetType="chat_message"');
    expect(read("src/features/social-hub/components/InvitesInbox.tsx")).toContain('targetType="social_invite"');
  });

  it("uses audited moderation RPCs rather than direct report-table updates", () => {
    const source = read("src/pages/admin/PlayerReports.tsx");
    expect(source).toContain('rpc("get_moderation_report_queue"');
    expect(source).toContain('rpc("moderate_player_report"');
    expect(source).not.toMatch(/\.from\(["']player_reports["']\)\.update/);
  });
});
