import React from "react";
import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import SetlistDesigner from "../SetlistDesigner";

describe("SetlistDesigner", () => {
  it("renders the support act tab with running order guidance", () => {
    const html = renderToStaticMarkup(<SetlistDesigner />);

    expect(html).toContain("Setlist Designer");
    expect(html).toContain("Twilight Spark Warmup");
    expect(html).toContain("Running order");
  });

  it("seeds sample songs and production moments", () => {
    const html = renderToStaticMarkup(<SetlistDesigner />);

    expect(html).toContain("Signal Flare");
    expect(html).toContain("Crowd Pulse Check");
  });
});
