import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("./rpc", () => ({ totpRpc: rpc }));

import { recordTotpPreflightOverride, totpAuditKindLabel } from "./productionAuditApi";

describe("Top of the Pops production audit API", () => {
  beforeEach(() => rpc.mockReset());

  it("records an explicit warning acknowledgement against the frozen manifest", async () => {
    rpc.mockResolvedValue({
      data: {
        id: "audit-1",
        episode_id: "ep-1",
        event_kind: "override",
        headline: "Preflight warning acknowledged",
        detail: { check_code: "runtime_target", reason: "Editorially acceptable" },
        passed: null,
        manifest_checksum: "checksum-1",
        actor_id: "admin-1",
        created_at: "2026-09-19T18:00:00Z",
      },
      error: null,
    });

    const entry = await recordTotpPreflightOverride({
      episodeId: "ep-1",
      manifestChecksum: "checksum-1",
      checkCode: "runtime_target",
      severity: "warning",
      reason: "Editorially acceptable",
    });

    expect(rpc).toHaveBeenCalledWith("totp_admin_record_preflight_override", {
      p_episode_id: "ep-1",
      p_manifest_checksum: "checksum-1",
      p_check_code: "runtime_target",
      p_severity: "warning",
      p_reason: "Editorially acceptable",
    });
    expect(entry.event_kind).toBe("override");
    expect(totpAuditKindLabel("override")).toBe("Acknowledgement");
  });

  it("surfaces database rejection instead of treating a blocker as acknowledged", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Blocking preflight failures cannot be overridden" } });
    await expect(recordTotpPreflightOverride({
      episodeId: "ep-1",
      manifestChecksum: "checksum-1",
      checkCode: "song_audio",
      severity: "warning",
      reason: "Attempted override",
    })).rejects.toThrow("Blocking preflight failures cannot be overridden");
  });
});
