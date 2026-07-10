import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SocialPrivacySettingsCard } from "../components/SocialPrivacySettingsCard";

vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");

const maybeSingle = vi.fn();
const single = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const selectAfterRead = vi.fn(() => ({ eq }));
const selectAfterWrite = vi.fn(() => ({ single }));
const upsert = vi.fn(() => ({ select: selectAfterWrite }));
const from = vi.fn(() => ({ select: selectAfterRead, upsert }));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const profileId = "11111111-1111-4111-8111-111111111111";
const row = {
  profile_id: profileId,
  profile_visibility: "public",
  city_visibility: "friends",
  activity_visibility: "friends",
  online_status_visibility: "private",
  relationship_visibility: "friends",
  dm_permission: "friends",
  allow_band_invites: true,
  allow_company_invites: true,
};

function renderCard(id: string | null = profileId) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><SocialPrivacySettingsCard profileId={id} /></QueryClientProvider>);
}

beforeEach(() => vi.clearAllMocks());

describe("SocialPrivacySettingsCard", () => {
  it("shows an unauthenticated empty state", () => {
    renderCard(null);
    expect(screen.getByText(/sign in and select a character/i)).toBeInTheDocument();
  });

  it("shows an error state when loading fails", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: new Error("permission denied") });
    renderCard();
    expect(await screen.findByRole("alert")).toHaveTextContent("permission denied");
  });

  it("saves changed settings and prevents duplicate submissions while saving", async () => {
    maybeSingle.mockResolvedValueOnce({ data: row, error: null });
    let resolveSave: (value: unknown) => void = () => undefined;
    single.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));
    const user = userEvent.setup();

    renderCard();
    const bandInviteSwitch = await screen.findByRole("switch", { name: /allow band invitations/i });
    await user.click(bandInviteSwitch);
    const saveButton = screen.getByRole("button", { name: /save privacy settings/i });
    await user.click(saveButton);

    expect(saveButton).toBeDisabled();
    await user.click(saveButton);
    expect(upsert).toHaveBeenCalledTimes(1);

    resolveSave({ data: { ...row, allow_band_invites: false }, error: null });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/up to date/i));
  });
});
