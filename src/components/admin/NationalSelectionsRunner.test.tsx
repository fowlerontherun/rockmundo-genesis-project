import type React from "react";
import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { NationalSelectionsRunnerView } from "./NationalSelectionsRunner";

const renderView = (props: Partial<React.ComponentProps<typeof NationalSelectionsRunnerView>> = {}) =>
  renderToStaticMarkup(
    <NationalSelectionsRunnerView
      activeYear={props.activeYear ?? 2032}
      canRun={props.canRun ?? true}
      isRunning={props.isRunning ?? false}
      status={props.status ?? "idle"}
      errorMessage={props.errorMessage}
      onRun={props.onRun ?? (() => {})}
    />,
  );

describe("NationalSelectionsRunnerView", () => {
  it("renders nothing when the user cannot run the action", () => {
    const output = renderView({ canRun: false });
    expect(output).toBe("");
  });

  it("shows loading, success, and error states", () => {
    const loading = renderView({ isRunning: true });
    expect(loading).toContain("Running...");

    const success = renderView({ status: "success", activeYear: 2033 });
    expect(success).toContain("Selections randomized for 2033");

    const error = renderView({ status: "error", errorMessage: "network" });
    expect(error).toContain("Failed to run national selections: network");
  });
});
