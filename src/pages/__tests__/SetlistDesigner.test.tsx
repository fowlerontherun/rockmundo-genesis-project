import React from "react";
import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import SetlistDesigner, { SONG_LIMITS, initialSetlists } from "../SetlistDesigner";

describe("SetlistDesigner", () => {
  it("renders the headliner tab with running order guidance", () => {
    const html = renderToStaticMarkup(<SetlistDesigner />);

    expect(html).toContain("Setlist Designer");
    expect(html).toContain("Signal Flare");
    expect(html).toContain("Running order");
  });

  it("seeds sample songs and production moments", () => {
    const html = renderToStaticMarkup(<SetlistDesigner />);

    expect(html).toContain("Signal Flare");
    expect(html).toContain("Crowd Pulse Check");
  });

  it("surfaces the song limit message when a setlist is at capacity", () => {
    const cappedSetlists = {
      ...initialSetlists,
      act: {
        ...initialSetlists.act,
        items: [
          ...initialSetlists.act.items,
          {
            id: "act-limit-test",
            type: "song" as const,
            title: "Limit Signal",
            detail: "Test track inserted to reach the capacity cap.",
            duration: "3:30",
          },
        ],
      },
    };

    const html = renderToStaticMarkup(
      <SetlistDesigner
        initialState={cappedSetlists}
        initialEditing={{ act: true }}
        initialActiveTab="act"
      />,
    );

    expect(html).toContain("Song limit reached");

    const updatedSongCount = cappedSetlists.act.items.filter((item) => item.type === "song").length;
    const songLimit = SONG_LIMITS.act;
    expect(html).toContain(`${updatedSongCount}/${songLimit}`);
  });
});
