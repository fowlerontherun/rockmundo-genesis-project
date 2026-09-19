import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TotpBroadcastPictureBoundary } from "./TotpBroadcastPictureBoundary";

vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn() },
}));

function BrokenPicture(): JSX.Element {
  throw new Error("WebGL context lost");
}

describe("TotpBroadcastPictureBoundary", () => {
  it("keeps a programme-shaped recovery surface when the 3D picture fails", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <TotpBroadcastPictureBoundary resetKey="episode-1">
        <BrokenPicture />
      </TotpBroadcastPictureBoundary>,
    );

    expect(screen.getByText("Studio picture temporarily unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Audio, captions and programme graphics are continuing/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry picture/i })).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("renders the studio normally when its child is healthy", () => {
    render(
      <TotpBroadcastPictureBoundary resetKey="episode-1">
        <div>studio picture</div>
      </TotpBroadcastPictureBoundary>,
    );
    expect(screen.getByText("studio picture")).toBeInTheDocument();
  });
});
