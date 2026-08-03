import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LegacyFestivalGate } from "../ui/LegacyFestivalGate";

const withEnv = (values: Record<string, string>, fn: () => void) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (import.meta as any).env;
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, env[key]]));
  Object.assign(env, values);
  try {
    fn();
  } finally {
    Object.assign(env, previous);
  }
};

describe("LegacyFestivalGate", () => {
  it("does not mount legacy gameplay while legacy writes are disabled by default", () => {
    render(
      <MemoryRouter>
        <LegacyFestivalGate area="Festival performance">
          <div>legacy-content</div>
        </LegacyFestivalGate>
      </MemoryRouter>,
    );

    expect(screen.queryByText("legacy-content")).not.toBeInTheDocument();
    expect(screen.getByText(/Legacy Festival actions are read-only/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open current Festivals/i })).toHaveAttribute("href", "/world/festivals");
  });

  it("renders children only when legacy reads and writes are explicitly enabled", () => {
    withEnv({
      VITE_FEATURE_LEGACY_FESTIVAL_SYSTEM: "true",
      VITE_FEATURE_LEGACY_FESTIVAL_READ: "true",
      VITE_FEATURE_LEGACY_FESTIVAL_WRITE: "true",
    }, () => {
      render(
        <MemoryRouter>
          <LegacyFestivalGate>
            <div>legacy-content</div>
          </LegacyFestivalGate>
        </MemoryRouter>,
      );
      expect(screen.getByText("legacy-content")).toBeInTheDocument();
    });
  });

  it("renders the rebuilding screen when legacy reads are disabled", () => {
    withEnv({ VITE_FEATURE_LEGACY_FESTIVAL_READ: "false" }, () => {
      render(
        <MemoryRouter>
          <LegacyFestivalGate area="Browser">
            <div>legacy-content</div>
          </LegacyFestivalGate>
        </MemoryRouter>,
      );
      expect(screen.queryByText("legacy-content")).not.toBeInTheDocument();
      expect(screen.getByText(/Festivals are being rebuilt/i)).toBeInTheDocument();
    });
  });
});
