import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/hooks/use-auth-context";

vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");

const { supabase } = await import("@/integrations/supabase/client");
const { AuthProvider } = await import("@/hooks/useAuth");

const Consumer = () => {
  const { loading, user, signOut } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user?.id ?? "none"}</span>
      <button onClick={() => void signOut()}>Sign out</button>
    </div>
  );
};

let authCallback: ((event: string, session: any) => void) | undefined;
const unsubscribe = vi.fn();

beforeEach(() => {
  authCallback = undefined;
  unsubscribe.mockClear();
  (supabase.auth as any).onAuthStateChange = vi.fn((callback) => {
    authCallback = callback;
    return { data: { subscription: { unsubscribe } } };
  });
  (supabase.auth as any).getSession = vi.fn(async () => ({ data: { session: { user: { id: "user-1" } } }, error: null }));
  (supabase.auth as any).signOut = vi.fn(async () => ({ error: null }));
});

describe("authentication smoke tests", () => {
  it("hydrates the initial Supabase session", async () => {
    render(<AuthProvider><Consumer /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("user")).toHaveTextContent("user-1");
    expect(supabase.auth.getSession).toHaveBeenCalled();
  });

  it("responds to auth state changes and clears local state on sign out", async () => {
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("user-1"));

    act(() => authCallback?.("SIGNED_IN", { user: { id: "user-2" } }));
    expect(screen.getByTestId("user")).toHaveTextContent("user-2");

    await act(async () => screen.getByRole("button", { name: /sign out/i }).click());
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(screen.getByTestId("user")).toHaveTextContent("none");
  });
});
