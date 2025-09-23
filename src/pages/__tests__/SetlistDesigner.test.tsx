import React from "react";
import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import SetlistDesigner from "../SetlistDesigner";

describe("SetlistDesigner", () => {
  it("renders the tour tab with running order guidance", () => {
    const html = renderToStaticMarkup(<SetlistDesigner />);

    expect(html).toContain("Setlist Designer");
    expect(html).toContain("World Tour Kickoff");
    expect(html).toContain("Running order");
  });

  it("seeds sample songs and production moments", () => {
    const html = renderToStaticMarkup(<SetlistDesigner />);

    expect(html).toContain("Skyline Anthem");
    expect(html).toContain("Fireworks Cascade");
  });
});
