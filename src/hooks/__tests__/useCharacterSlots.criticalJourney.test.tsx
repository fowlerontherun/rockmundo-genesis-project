import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/hooks/use-auth-context", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from },
}));

import { useCharacterSlots } from "../useCharacterSlots";

const createQueryBuilder = () => {
  const builder: any = {};
  for (const method of ["select", "eq", "is", "order", "limit", "neq", "update", "upsert"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.insert = mocks.insert.mockImplementation(() => builder);
  builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  builder.single = vi.fn(async () => ({ data: null, error: null }));
  builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null, count: 0 }).then(resolve, reject);
  return builder;
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockImplementation(() => createQueryBuilder());
});

describe("character creation critical journey", () => {
  it("uses the authoritative character-creation RPC and returns its profile id", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ id: "profile-new" }], error: null });
    const { result } = renderHook(() => useCharacterSlots(), { wrapper: createWrapper() });

    let createdProfileId: string | undefined;
    await act(async () => {
      createdProfileId = await result.current.createCharacter.mutateAsync();
    });

    expect(createdProfileId).toBe("profile-new");
    expect(mocks.rpc).toHaveBeenCalledWith("create_character_profile");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("fails visibly when the RPC succeeds without returning a profile id", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useCharacterSlots(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(result.current.createCharacter.mutateAsync()).rejects.toThrow("Failed to create character profile");
    });
  });

  it("does not hide non-compatibility RPC failures behind the legacy fallback", async () => {
    const permissionError = { code: "42501", message: "permission denied" };
    mocks.rpc.mockResolvedValue({ data: null, error: permissionError });
    const { result } = renderHook(() => useCharacterSlots(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(result.current.createCharacter.mutateAsync()).rejects.toBe(permissionError);
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
