import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LegacyFestivalGate } from "../ui/LegacyFestivalGate";

// The gate reads from resolveFestivalFeatureFlags which reads from
// import.meta.env. We simulate the "disabled" state by temporarily
// setting the env var before render, then clearing after.

const withEnv = (key: string, value: string, fn: () => void) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (import.meta as any).env;
  const prev = env[key];
  env[key] = value;
  try { fn(); } finally { env[key] = prev; }
};

describe("LegacyFestivalGate", () => {
  it("renders children when legacy is enabled (default)", () => {
    render(
      <MemoryRouter>
        <LegacyFestivalGate>
          <div>legacy-content</div>
        </LegacyFestivalGate>
      </MemoryRouter>,
    );
    expect(screen.getByText("legacy-content")).toBeInTheDocument();
  });

  it("renders the rebuilding screen when legacy is disabled", () => {
    withEnv("VITE_FEATURE_LEGACY_FESTIVAL_SYSTEM", "false", () => {
      render(
        <MemoryRouter>
          <LegacyFestivalGate area="Browser">
            <div>legacy-content</div>
          </LegacyFestivalGate>
        </MemoryRouter>,
      );
      expect(screen.queryByText("legacy-content")).not.toBeInTheDocument();
      expect(
        screen.getByText(/Festivals are being rebuilt/i),
      ).toBeInTheDocument();
    });
  });
});
