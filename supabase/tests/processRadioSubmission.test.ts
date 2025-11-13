import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import path from "path";

type RadioSubmissionRow = {
  id: string;
  song_id: string;
  station_id: string;
  week_submitted: string | null;
  status: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
};

type SongRow = {
  id: string;
  hype: number;
  band_id: string | null;
  total_radio_plays: number;
  streams: number;
  revenue: number;
  last_radio_play: string | null;
};

type StationRow = {
  id: string;
  name: string;
  listener_base: number;
};

type ShowRow = {
  id: string;
  station_id: string;
  is_active: boolean;
  time_slot: number;
};

type PlaylistRow = {
  id: string;
  show_id: string;
  song_id: string;
  week_start_date: string;
  times_played: number;
  added_at: string;
  is_active: boolean;
};

type PlayRow = {
  id: string;
  playlist_id: string;
  show_id: string;
  song_id: string;
  station_id: string;
  listeners: number;
  hype_gained: number;
  streams_boost: number;
  sales_boost: number;
  played_at: string;
};

type BandRow = {
  id: string;
  fame: number;
};

type BandFameEventRow = {
  id: string;
  band_id: string;
  fame_gained: number;
  event_type: string;
  event_data: Record<string, unknown>;
};

type BandEarningRow = {
  id: string;
  band_id: string;
  amount: number;
  source: string;
  description: string;
  metadata: Record<string, unknown>;
};

type FailurePoint =
  | "before_accept"
  | "after_accept"
  | "after_playlist"
  | "after_play"
  | "after_song_update"
  | "after_band_update"
  | "after_fame_event"
  | "after_band_earnings";

type SummaryPayload = {
  submission_id: string;
  playlist_id: string;
  play_id: string;
  listeners: number;
  hype_gain: number;
  streams_boost: number;
  sales_boost: number;
  week_start_date: string;
  show_id: string;
  band_id: string | null;
  playlist_times_played: number;
  is_new_playlist: boolean;
};

type ProcessOptions = {
  now?: Date;
  random?: number;
  forceFailure?: FailurePoint;
};

type DatabaseState = {
  submissions: RadioSubmissionRow[];
  songs: SongRow[];
  stations: StationRow[];
  shows: ShowRow[];
  playlists: PlaylistRow[];
  plays: PlayRow[];
  bands: BandRow[];
  bandFameEvents: BandFameEventRow[];
  bandEarnings: BandEarningRow[];
  idCounter: number;
};

class FakeDatabase {
  submissions: RadioSubmissionRow[] = [];
  songs: SongRow[] = [];
  stations: StationRow[] = [];
  shows: ShowRow[] = [];
  playlists: PlaylistRow[] = [];
  plays: PlayRow[] = [];
  bands: BandRow[] = [];
  bandFameEvents: BandFameEventRow[] = [];
  bandEarnings: BandEarningRow[] = [];
  #idCounter = 0;

  constructor(initial?: Partial<DatabaseState>) {
    if (initial) {
      this.submissions = structuredClone(initial.submissions ?? []);
      this.songs = structuredClone(initial.songs ?? []);
      this.stations = structuredClone(initial.stations ?? []);
      this.shows = structuredClone(initial.shows ?? []);
      this.playlists = structuredClone(initial.playlists ?? []);
      this.plays = structuredClone(initial.plays ?? []);
      this.bands = structuredClone(initial.bands ?? []);
      this.bandFameEvents = structuredClone(initial.bandFameEvents ?? []);
      this.bandEarnings = structuredClone(initial.bandEarnings ?? []);
      this.#idCounter = initial.idCounter ?? 0;
    }
  }

  snapshot(): DatabaseState {
    return {
      submissions: structuredClone(this.submissions),
      songs: structuredClone(this.songs),
      stations: structuredClone(this.stations),
      shows: structuredClone(this.shows),
      playlists: structuredClone(this.playlists),
      plays: structuredClone(this.plays),
      bands: structuredClone(this.bands),
      bandFameEvents: structuredClone(this.bandFameEvents),
      bandEarnings: structuredClone(this.bandEarnings),
      idCounter: this.#idCounter,
    };
  }

  restore(state: DatabaseState) {
    this.submissions = structuredClone(state.submissions);
    this.songs = structuredClone(state.songs);
    this.stations = structuredClone(state.stations);
    this.shows = structuredClone(state.shows);
    this.playlists = structuredClone(state.playlists);
    this.plays = structuredClone(state.plays);
    this.bands = structuredClone(state.bands);
    this.bandFameEvents = structuredClone(state.bandFameEvents);
    this.bandEarnings = structuredClone(state.bandEarnings);
    this.#idCounter = state.idCounter;
  }

  transaction<T>(fn: () => T): T {
    const snapshot = this.snapshot();
    try {
      return fn();
    } catch (error) {
      this.restore(snapshot);
      throw error;
    }
  }

  createId(prefix: string) {
    this.#idCounter += 1;
    return `${prefix}-${this.#idCounter}`;
  }
}

function computeWeekStart(date: Date): string {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay();
  utcDate.setUTCDate(utcDate.getUTCDate() - day);
  return utcDate.toISOString().split("T")[0];
}

function processRadioSubmission(
  db: FakeDatabase,
  submissionId: string,
  options: ProcessOptions = {}
): SummaryPayload {
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const randomValue = options.random ?? 0.42;

  return db.transaction(() => {
    const submission = db.submissions.find((row) => row.id === submissionId);
    if (!submission) {
      throw new Error(`Radio submission ${submissionId} not found`);
    }

    const song = db.songs.find((row) => row.id === submission.song_id);
    if (!song) {
      throw new Error(`Song ${submission.song_id} not found`);
    }

    const station = db.stations.find((row) => row.id === submission.station_id);
    if (!station) {
      throw new Error(`Station ${submission.station_id} not found`);
    }

    const show = db.shows
      .filter((row) => row.station_id === submission.station_id && row.is_active)
      .sort((a, b) => a.time_slot - b.time_slot)[0];

    if (!show) {
      throw new Error(`No active show found for station ${submission.station_id}`);
    }

    const weekStartDate = submission.week_submitted ?? computeWeekStart(now);

    if (options.forceFailure === "before_accept") {
      throw new Error("Simulated failure before acceptance");
    }

    submission.status = "accepted";
    submission.reviewed_at = nowIso;
    submission.rejection_reason = null;

    if (options.forceFailure === "after_accept") {
      throw new Error("Simulated failure after acceptance");
    }

    let playlist = db.playlists.find(
      (row) =>
        row.show_id === show.id &&
        row.song_id === submission.song_id &&
        row.week_start_date === weekStartDate
    );
    let isNewPlaylist = false;

    if (playlist) {
      playlist.times_played = (playlist.times_played ?? 0) + 1;
      playlist.added_at = nowIso;
      playlist.is_active = true;
    } else {
      playlist = {
        id: db.createId("playlist"),
        show_id: show.id,
        song_id: submission.song_id,
        week_start_date: weekStartDate,
        times_played: 1,
        added_at: nowIso,
        is_active: true,
      };
      db.playlists.push(playlist);
      isNewPlaylist = true;
    }

    if (options.forceFailure === "after_playlist") {
      throw new Error("Simulated failure after playlist handling");
    }

    const multiplier = 0.55 + randomValue * 0.35;
    const listeners = Math.max(100, Math.round(station.listener_base * multiplier));
    const hypeGain = Math.max(1, Math.round(listeners * 0.002));
    const streamsBoost = Math.max(10, Math.round(listeners * 0.6));
    const salesBoost = Math.max(5, Math.round(listeners * 0.015));

    const play: PlayRow = {
      id: db.createId("play"),
      playlist_id: playlist.id,
      show_id: show.id,
      song_id: submission.song_id,
      station_id: submission.station_id,
      listeners,
      hype_gained: hypeGain,
      streams_boost: streamsBoost,
      sales_boost: salesBoost,
      played_at: nowIso,
    };
    db.plays.push(play);

    if (options.forceFailure === "after_play") {
      throw new Error("Simulated failure after play logging");
    }

    song.hype += hypeGain;
    song.total_radio_plays += 1;
    song.last_radio_play = nowIso;
    song.streams += streamsBoost;
    song.revenue += salesBoost;

    if (options.forceFailure === "after_song_update") {
      throw new Error("Simulated failure after song update");
    }

    if (song.band_id) {
      const band = db.bands.find((row) => row.id === song.band_id);
      if (!band) {
        throw new Error(`Band ${song.band_id} not found`);
      }

      band.fame = Number((band.fame + 0.1).toFixed(1));

      if (options.forceFailure === "after_band_update") {
        throw new Error("Simulated failure after band update");
      }

      const fameEvent: BandFameEventRow = {
        id: db.createId("fame-event"),
        band_id: band.id,
        fame_gained: 0.1,
        event_type: "radio_play",
        event_data: {
          station_id: submission.station_id,
          station_name: station.name,
          play_id: play.id,
        },
      };
      db.bandFameEvents.push(fameEvent);

      if (options.forceFailure === "after_fame_event") {
        throw new Error("Simulated failure after fame event");
      }

      if (salesBoost > 0) {
        const earning: BandEarningRow = {
          id: db.createId("earning"),
          band_id: band.id,
          amount: salesBoost,
          source: "radio_play",
          description: `Radio play on ${station.name}`,
          metadata: {
            station_id: submission.station_id,
            station_name: station.name,
            song_id: song.id,
            play_id: play.id,
          },
        };
        db.bandEarnings.push(earning);

        if (options.forceFailure === "after_band_earnings") {
          throw new Error("Simulated failure after band earnings");
        }
      }
    }

    return {
      submission_id: submission.id,
      playlist_id: playlist.id,
      play_id: play.id,
      listeners,
      hype_gain: hypeGain,
      streams_boost: streamsBoost,
      sales_boost: salesBoost,
      week_start_date: weekStartDate,
      show_id: show.id,
      band_id: song.band_id,
      playlist_times_played: playlist.times_played,
      is_new_playlist: isNewPlaylist,
    } satisfies SummaryPayload;
  });
}

function createBaseDatabase() {
  const submissionId = "submission-1";
  return {
    submissionId,
    db: new FakeDatabase({
      submissions: [
        {
          id: submissionId,
          song_id: "song-1",
          station_id: "station-1",
          week_submitted: "2024-01-07",
          status: null,
          reviewed_at: null,
          rejection_reason: "pending",
        },
      ],
      songs: [
        {
          id: "song-1",
          hype: 10,
          band_id: "band-1",
          total_radio_plays: 5,
          streams: 1000,
          revenue: 200,
          last_radio_play: null,
        },
      ],
      stations: [
        { id: "station-1", name: "Galaxy FM", listener_base: 1000 },
      ],
      shows: [
        { id: "show-1", station_id: "station-1", is_active: true, time_slot: 1 },
        { id: "show-2", station_id: "station-1", is_active: true, time_slot: 2 },
      ],
      playlists: [],
      plays: [],
      bands: [{ id: "band-1", fame: 2 }],
      bandFameEvents: [],
      bandEarnings: [],
    }),
  };
}

describe("process_radio_submission simulation", () => {
  it("processes a submission and returns a detailed summary", () => {
    const { db, submissionId } = createBaseDatabase();
    const summary = processRadioSubmission(db, submissionId, {
      now: new Date("2024-01-08T12:00:00Z"),
      random: 0.2,
    });

    expect(summary.is_new_playlist).toBe(true);
    expect(summary.listeners).toBe(620);
    expect(summary.hype_gain).toBe(1);
    expect(summary.streams_boost).toBe(372);
    expect(summary.sales_boost).toBe(9);
    expect(summary.playlist_times_played).toBe(1);

    expect(db.playlists).toHaveLength(1);
    expect(db.plays).toHaveLength(1);
    expect(db.bandFameEvents).toHaveLength(1);
    expect(db.bandEarnings).toHaveLength(1);

    const updatedSong = db.songs[0];
    expect(updatedSong.hype).toBe(11);
    expect(updatedSong.total_radio_plays).toBe(6);
    expect(updatedSong.streams).toBe(1372);
    expect(updatedSong.revenue).toBe(209);

    const submission = db.submissions[0];
    expect(submission.status).toBe("accepted");
    expect(submission.reviewed_at).toBeTruthy();
  });

  it("rolls back when playlist creation fails", () => {
    const { db, submissionId } = createBaseDatabase();
    const before = db.snapshot();

    expect(() =>
      processRadioSubmission(db, submissionId, {
        now: new Date("2024-01-08T12:00:00Z"),
        random: 0.2,
        forceFailure: "after_playlist",
      })
    ).toThrow("Simulated failure after playlist handling");

    expect(db.snapshot()).toEqual(before);
  });

  it("rolls back when band updates fail even after earlier changes", () => {
    const { db, submissionId } = createBaseDatabase();
    db.playlists.push({
      id: "playlist-existing",
      show_id: "show-1",
      song_id: "song-1",
      week_start_date: "2024-01-07",
      times_played: 1,
      added_at: "2024-01-01T00:00:00Z",
      is_active: true,
    });

    const before = db.snapshot();

    expect(() =>
      processRadioSubmission(db, submissionId, {
        now: new Date("2024-01-08T12:00:00Z"),
        random: 0.2,
        forceFailure: "after_band_update",
      })
    ).toThrow("Simulated failure after band update");

    expect(db.snapshot()).toEqual(before);
  });
});

describe("process_radio_submission SQL definition", () => {
  it("exposes the expected failure hooks", () => {
    const sqlPath = path.resolve(
      "supabase/migrations/20290603110000_create_process_radio_submission_function.sql"
    );
    const sql = readFileSync(sqlPath, "utf-8");
    const markers: FailurePoint[] = [
      "before_accept",
      "after_accept",
      "after_playlist",
      "after_play",
      "after_song_update",
      "after_band_update",
      "after_fame_event",
      "after_band_earnings",
    ];

    for (const marker of markers) {
      const phrase = `Simulated failure ${marker.replaceAll("_", " ")}`;
      expect(sql).toContain(phrase);
    }
  });
});
