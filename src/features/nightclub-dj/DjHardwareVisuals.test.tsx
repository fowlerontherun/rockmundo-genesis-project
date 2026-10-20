import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DjPadBank, DjPlatter, DjTrimMeter, DjWaveform } from "./DjHardwareVisuals";
import { emptyDjHotCues, storeDjHotCue } from "./djHardwareControls";

describe("RockMundo DJ hardware UI semantics", () => {
  it("renders eight pads on each deck with real accessible store actions", () => {
    const html = renderToStaticMarkup(
      <DjPadBank deck="A" cues={emptyDjHotCues()} mode="store" disabled={false}
        onPress={() => undefined} onToggleMode={() => undefined} />,
    );
    expect((html.match(/class="rm-dj-pad rm-dj-pad--/g) ?? [])).toHaveLength(8);
    expect(html).toContain("Store Deck A hot cue 1 at current position");
    expect(html).toContain("Store Deck A hot cue 8 at current position");
    expect(html).toContain('aria-pressed="true"');
  });

  it("distinguishes a saved zero-time cue from an unset pad in playback mode", () => {
    const slots = storeDjHotCue(emptyDjHotCues(), 0, 0, 120);
    const html = renderToStaticMarkup(
      <DjPadBank deck="B" cues={slots} mode="play" disabled={false}
        onPress={() => undefined} onToggleMode={() => undefined} />,
    );
    expect(html).toContain("Jump Deck B to hot cue 1, 0:00");
    expect(html).toContain("Deck B hot cue 2 empty");
    expect(html).toContain('data-saved="true"');
    expect(html).toContain('data-saved="false"');
  });

  it("makes jog controls buttons without claiming unimplemented scratching", () => {
    const html = renderToStaticMarkup(
      <DjPlatter deck="A" playing={true} disabled={false} onNudge={() => undefined} />,
    );
    expect(html).toContain("Nudge Deck A back one second");
    expect(html).toContain("Nudge Deck A forward one second");
    expect(html).toContain('data-playing="true"');
    expect(html).not.toContain("Scratch");
  });

  it("labels waveform as decorative and output meter as estimated trim", () => {
    const wave = renderToStaticMarkup(<DjWaveform deck="B" trackId="game:one" position={.35} />);
    expect(wave).toContain('aria-hidden="true"');
    expect(wave).toContain('data-testid="dj-waveform-B"');
    const meter = renderToStaticMarkup(<DjTrimMeter side="A" value={.6} active={true} />);
    expect(meter).toContain("estimated output trim 60 percent");
    expect((meter.match(/data-lit="true"/g) ?? []).length).toBeGreaterThan(0);
  });
});