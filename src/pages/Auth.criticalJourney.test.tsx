import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  toast: vi.fn(),
  authCallback: null as ((event: string, session: unknown) => void) | null,
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  resend: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const router = await importOriginal<typeof import("react-router-dom")>();
  return { ...router, useNavigate: () => mocks.navigate };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      updateUser: mocks.updateUser,
      signOut: mocks.signOut,
      resend: mocks.resend,
    },
  },
}));

vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/hooks/useTranslation", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/useSiteConfig", () => ({ useSiteConfig: () => ({ data: undefined }) }));
vi.mock("@/hooks/usePlayerPresenceStats", () => ({
  usePlayerPresenceStats: () => ({ totalPlayers: 10, onlinePlayers: 2, loading: false, error: null }),
}));
vi.mock("@/components/legal/TermsDialog", () => ({
  TERMS_VERSION: "test",
  TermsDialog: ({ triggerText }: { triggerText: string }) => <span>{triggerText}</span>,
}));

import Auth from "./Auth";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authCallback = null;
  window.history.replaceState(null, "", "/auth");
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.onAuthStateChange.mockImplementation((callback) => {
    mocks.authCallback = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  mocks.signInWithPassword.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  mocks.signUp.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.resend.mockResolvedValue({ error: null });
});

describe("Auth critical journey", () => {
  it("signs in with Supabase and returns the player to Home", async () => {
    render(<Auth />);

    fireEvent.change(screen.getByLabelText("forms.email", { selector: "#login-email" }), {
      target: { value: "player@example.com" },
    });
    fireEvent.change(screen.getByLabelText("forms.password", { selector: "#login-password" }), {
      target: { value: "Password1" },
    });
    fireEvent.submit(screen.getByLabelText("forms.email", { selector: "#login-email" }).closest("form")!);

    await waitFor(() => expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "player@example.com",
      password: "Password1",
    }));
    expect(mocks.navigate).toHaveBeenCalledWith("/home", { replace: true });
  });

  it("creates an email account with the canonical confirmation redirect", async () => {
    const user = userEvent.setup();
    render(<Auth />);
    await user.click(screen.getByRole("tab", { name: "auth.signUp" }));

    await waitFor(() => expect(document.getElementById("signup-email")).toBeInTheDocument());
    fireEvent.change(document.getElementById("signup-email")!, {
      target: { value: "new-player@example.com" },
    });
    fireEvent.change(document.getElementById("signup-password")!, {
      target: { value: "StrongPass1" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "auth.createAccount" }));

    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledWith({
      email: "new-player@example.com",
      password: "StrongPass1",
      options: { emailRedirectTo: `${window.location.origin}/auth` },
    }));
    expect(screen.getByText(/auth.verificationSent/)).toBeInTheDocument();
  });

  it("completes a password-recovery session and signs out the recovered session", async () => {
    render(<Auth />);
    await waitFor(() => expect(mocks.onAuthStateChange).toHaveBeenCalled());

    act(() => mocks.authCallback?.("PASSWORD_RECOVERY", null));
    fireEvent.change(screen.getByLabelText("auth.newPassword"), { target: { value: "Recovered1" } });
    fireEvent.change(screen.getByLabelText("auth.confirmNewPassword"), { target: { value: "Recovered1" } });
    fireEvent.click(screen.getByRole("button", { name: "auth.updatePassword" }));

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith({ password: "Recovered1" }));
    expect(mocks.signOut).toHaveBeenCalled();
    expect(screen.getByText("auth.passwordUpdatedSuccess")).toBeInTheDocument();
  });
});
