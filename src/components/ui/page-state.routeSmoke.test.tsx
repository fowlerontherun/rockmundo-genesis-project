import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PageEmptyState, PageErrorState, PageLoadingState } from "./page-state";

describe("P4 shared route page states", () => {
  it("exposes an accessible loading state", () => {
    render(<PageLoadingState title="Loading route" description="Fetching player data" />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading route")).toBeInTheDocument();
    expect(screen.getByText("Fetching player data")).toBeInTheDocument();
  });

  it("renders an explicit empty state with a recovery action", () => {
    render(
      <PageEmptyState
        title="Nothing here yet"
        description="Create the first item to continue."
        action={<button type="button">Create item</button>}
      />,
    );

    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
    expect(screen.getByText("Create the first item to continue.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create item" })).toBeInTheDocument();
  });

  it("renders an actionable error state and retries without losing the page", () => {
    const onRetry = vi.fn();
    render(
      <PageErrorState
        title="Route could not be loaded"
        description="The request failed safely."
        onRetry={onRetry}
        retryLabel="Retry route"
      />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry route" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
