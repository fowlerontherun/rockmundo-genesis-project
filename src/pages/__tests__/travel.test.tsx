import React from "react";
import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import Travel from "../Travel";

describe("Travel page", () => {
  it("renders key section headings", () => {
    const html = renderToStaticMarkup(<Travel />);

    expect(html).toContain("Flights");
    expect(html).toContain("Trains");
    expect(html).toContain("Rideshare");
    expect(html).toContain("Private Jet");
    expect(html).toContain("Band Vehicle");
  });
});
