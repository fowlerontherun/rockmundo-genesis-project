import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useReleasePartySession } from "./useReleasePartySession";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  invalidate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from },
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

const questions = Array.from({ length: 5 }, (_, n) => ({
  id: `question-${n}`,
  question_text: `Question ${n}`,
  category: "fan_interaction",
  party_context: ["all"],
  option_a_text: "A",
  option_a_effects: { hype_mult: 1.2, fan_mult: 1, cash_mult: 1, reputation: {} },
  option_b_text: "B",
  option_b_effects: { hype_mult: 1, fan_mult: 1, cash_mult: 1 },
  option_c_text: "C",
  option_c_effects: { hype_mult: 1, fan_mult: 1, cash_mult: 1 },
  option_d_text: "D",
  option_d_effects: { hype_mult: 0.8, fan_mult: 1, cash_mult: 1 },
}));

async function completedParty() {
  const hook = renderHook(() =>
    useReleasePartySession("release-1", "Release", "account-1", "band-1"),
  );
  await act(async () => { await hook.result.current.startParty(); });
  for (let i = 0; i < 5; i++) {
    act(() => { hook.result.current.handleAnswer("a"); });
  }
  expect(hook.result.current.phase).toBe("results");
  expect(hook.result.current.answers).toHaveLength(5);
  return hook;
}

describe("release party atomic settlement (#4272)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ select: () => Promise.resolve({ data: questions, error: null }) });
    mocks.invalidate.mockResolvedValue(undefined);
    mocks.rpc.mockResolvedValue({
      data: { success: true, already_completed: false, hype_awarded: 73, hype_score: 373 },
      error: null,
    });
  });

  it("trusts server-computed reward, not the browser's projected hype", async () => {
    const hook = await completedParty();
    expect(hook.result.current.hypeAwarded).toBe(120);
    let saved = false;
    await act(async () => { saved = await hook.result.current.finishParty(); });
    expect(saved).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledOnce();
    const [functionName, args] = mocks.rpc.mock.calls[0];
    expect(functionName).toBe("settle_release_party_atomic");
    expect(args.p_release_id).toBe("release-1");
    expect(args.p_answers).toHaveLength(5);
    expect(args).not.toHaveProperty("hype_awarded");
    expect(args).not.toHaveProperty("user_id");
    expect(hook.result.current.hypeAwarded).toBe(73);
    expect(mocks.success).toHaveBeenCalledWith("Release party added 73 hype!");
  });

  it("never shows success when the database rejects the transaction; permits retry", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "permission denied" } });
    const hook = await completedParty();
    let saved = true;
    await act(async () => { saved = await hook.result.current.finishParty(); });
    expect(saved).toBe(false);
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalled();
    await act(async () => { saved = await hook.result.current.finishParty(); });
    expect(saved).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.success).toHaveBeenCalledTimes(1);
  });

  it("does not invent success for an ambiguous empty RPC response", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    const hook = await completedParty();
    let saved = true;
    await act(async () => { saved = await hook.result.current.finishParty(); });
    expect(saved).toBe(false);
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("reports already-completed retries without awarding additional hype", async () => {
    mocks.rpc.mockResolvedValue({
      data: { success: true, already_completed: true, hype_awarded: 91, hype_score: 191 },
      error: null,
    });
    const hook = await completedParty();
    let saved = false;
    await act(async () => { saved = await hook.result.current.finishParty(); });
    expect(saved).toBe(true);
    expect(mocks.success).toHaveBeenCalledWith(
      "This release party was already completed; no additional hype was awarded.",
    );
  });

  it("serializes rapid duplicate Done clicks while the result is unresolved", async () => {
    let resolveRpc: (value: unknown) => void = () => {};
    mocks.rpc.mockImplementation(() => new Promise((resolve) => { resolveRpc = resolve; }));
    const hook = await completedParty();
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = hook.result.current.finishParty();
      second = hook.result.current.finishParty();
    });
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(await second).toBe(false);
    await act(async () => {
      resolveRpc({
        data: { success: true, already_completed: false, hype_awarded: 90 },
        error: null,
      });
      expect(await first).toBe(true);
    });
    expect(mocks.success).toHaveBeenCalledTimes(1);
  });

  it("refuses to save incomplete five-question sessions", async () => {
    const hook = renderHook(() =>
      useReleasePartySession("release-1", "Release", "account-1", "band-1"),
    );
    await act(async () => {
      expect(await hook.result.current.finishParty()).toBe(false);
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
