import { describe, expect, it, vi } from "vitest";
import { bindDjDeckLifecycle } from "./deckAudioLifecycle";

function setup(initialVisibility: DocumentVisibilityState = "visible") {
  const page = new EventTarget();
  const viewport = new EventTarget();
  let visibility = initialVisibility;
  Object.defineProperty(page, "visibilityState", { get: () => visibility });
  const player = { pause: vi.fn() };
  const unbind = bindDjDeckLifecycle(
    player as unknown as HTMLMediaElement,
    page as unknown as Document,
    viewport as unknown as Window,
  );
  return {
    page, viewport, player, unbind,
    setVisibility(value: DocumentVisibilityState) { visibility = value; },
  };
}

describe("DJ deck audio lifecycle on mobile and desktop", () => {
  it("pauses when backgrounded, without auto-resuming on return", () => {
    const ctx = setup();
    expect(ctx.player.pause).not.toHaveBeenCalled();
    ctx.setVisibility("hidden");
    ctx.page.dispatchEvent(new Event("visibilitychange"));
    expect(ctx.player.pause).toHaveBeenCalledTimes(1);
    ctx.setVisibility("visible");
    ctx.page.dispatchEvent(new Event("visibilitychange"));
    expect(ctx.player.pause).toHaveBeenCalledTimes(1);
    ctx.unbind();
  });

  it("pauses if the studio opens while the tab is already hidden", () => {
    const ctx = setup("hidden");
    expect(ctx.player.pause).toHaveBeenCalledTimes(1);
    ctx.unbind();
  });

  it("pauses on Android page freeze, but never auto-resumes on thaw", () => {
    const ctx = setup();
    ctx.page.dispatchEvent(new Event("freeze"));
    expect(ctx.player.pause).toHaveBeenCalledTimes(1);
    ctx.setVisibility("visible");
    ctx.page.dispatchEvent(new Event("resume"));
    expect(ctx.player.pause).toHaveBeenCalledTimes(1);
    ctx.unbind();
    ctx.page.dispatchEvent(new Event("freeze"));
    expect(ctx.player.pause).toHaveBeenCalledTimes(2);
  });

  it("pauses on pagehide and removes listeners and stops playback on cleanup", () => {
    const ctx = setup();
    ctx.viewport.dispatchEvent(new Event("pagehide"));
    expect(ctx.player.pause).toHaveBeenCalledTimes(1);
    ctx.unbind();
    expect(ctx.player.pause).toHaveBeenCalledTimes(2);
    ctx.setVisibility("hidden");
    ctx.page.dispatchEvent(new Event("visibilitychange"));
    ctx.viewport.dispatchEvent(new Event("pagehide"));
    expect(ctx.player.pause).toHaveBeenCalledTimes(2);
  });
});
