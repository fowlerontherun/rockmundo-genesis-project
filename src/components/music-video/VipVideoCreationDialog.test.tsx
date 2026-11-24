import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { VipVideoCreationDialog } from "./VipVideoCreationDialog";

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));

const props = {
  isVip: true,
  songs: [{ id: "song-1", title: "A Recorded Song" }],
  profileCash: 80_000,
};

describe("VIP AI music-video creation modes", () => {
  it("defaults to a minimal basic form without requiring scenes", () => {
    render(<VipVideoCreationDialog {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /AI Video Generator/i }));
    expect(screen.getByRole("button", { name: "Basic Video" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Pick a look and we'll direct the shot for you.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Main Shot / Action (optional)")).not.toBeInTheDocument();
    expect(screen.queryByText(/Scene Descriptions/)).not.toBeInTheDocument();
    expect(screen.getByText(/does not create a full-song edit or sync the song audio/)).toBeInTheDocument();
  });

  it("reveals opt-in camera, lighting and motion controls", () => {
    render(<VipVideoCreationDialog {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /AI Video Generator/i }));
    fireEvent.click(screen.getByRole("button", { name: "Advanced Video" }));
    expect(screen.getByRole("button", { name: "Advanced Video" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Main Shot / Action (optional)")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Camera Movement" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Lighting" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Colour Palette" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Subject Motion" })).toBeInTheDocument();
  });
});
