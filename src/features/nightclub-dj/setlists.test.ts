import { describe, expect, it } from "vitest";
import {
  DJ_SETLIST_MAX_TRACKS, djSetlistIsValid, djSetlistSummary, djSetlistTrackKey,
  moveDjSetlistItem, toDjSetlistItem,
} from "./setlists";
import type { DjAudioTrack } from "./library";

const game: DjAudioTrack = {
  id: "game:one", source: "game", sourceId: "one", title: "First Track",
  artist: "The Players", genre: "Rock", bpm: null, musicalKey: null,
  durationSeconds: 180, audioUrl: "https://example.com/one.mp3", storagePath: null,
  mine: true, sharedForDj: false,
};
const admin: DjAudioTrack = {
  id: "admin:two", source: "admin", sourceId: "two", title: "Club Beat",
  artist: "DJ Test", genre: "House", bpm: 126, musicalKey: "Am",
  durationSeconds: null, audioUrl: null,
  storagePath: "catalog/00000000-0000-0000-0000-000000000000/beat.mp3",
  mine: false, sharedForDj: true,
};

describe("DJ setlist draft and track readiness", () => {
  it("stores a source-qualified track identity independent of expiring signed URLs", () => {
    expect(toDjSetlistItem(game)).toEqual({ source: "game", id: "one" });
    expect(toDjSetlistItem(admin)).toEqual({ source: "admin", id: "two" });
    expect(djSetlistTrackKey(toDjSetlistItem(admin))).toBe("admin:two");
  });

  it("summarises known, unknown and unavailable playtime", () => {
    const items = [toDjSetlistItem(game), toDjSetlistItem(admin)];
    expect(djSetlistSummary(items, [game, admin])).toEqual({
      count: 2, durationSeconds: 180, unknownDuration: 1, missing: 0,
    });
    expect(djSetlistSummary(items, [game])).toEqual({
      count: 2, durationSeconds: 180, unknownDuration: 0, missing: 1,
    });
    expect(djSetlistIsValid(items, [game])).toBe(false);
    expect(djSetlistIsValid(items, [game, admin])).toBe(true);
  });

  it("enforces draft track limits", () => {
    expect(djSetlistIsValid([], [game])).toBe(false);
    expect(djSetlistIsValid(Array(DJ_SETLIST_MAX_TRACKS + 1).fill(toDjSetlistItem(game)), [game])).toBe(false);
  });

  it("reorders immutably and ignores out-of-bounds moves", () => {
    const a = toDjSetlistItem(game), b = toDjSetlistItem(admin);
    const original = [a, b];
    expect(moveDjSetlistItem(original, 1, 0)).toEqual([b, a]);
    expect(original).toEqual([a, b]);
    expect(moveDjSetlistItem(original, -1, 0)).toEqual(original);
    expect(moveDjSetlistItem(original, 1, 5)).toEqual(original);
  });
});
