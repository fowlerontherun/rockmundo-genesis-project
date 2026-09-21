/**
 * Browser-side export of a Top of the Pops broadcast.
 *
 * Records the rendered broadcast canvas with `HTMLCanvasElement.captureStream()`
 * and mixes the song/presenter audio elements through a WebAudio
 * `MediaStreamDestination`, producing a single WebM file the player can
 * download or upload to Google Drive.
 */

/** Delivery profile the browser export aims at. */
export const TOTP_EXPORT_PROFILE = {
  frameRate: 30,
  videoBitsPerSecond: 8_000_000,
  audioBitsPerSecond: 192_000,
  label: "1080p · 30 fps · 8 Mbps · stereo",
} as const;

export interface TotpExportProgress {
  state: "recording" | "finishing";
  /** 0-100 progress through the episode while recording. */
  percent: number;
}

export interface TotpExportOptions {
  /** Element containing the broadcast canvas (the `[data-totp-broadcast]` wrapper or an ancestor). */
  container: HTMLElement;
  /** Song bed audio element, if one is attached to the performance. */
  songAudio?: HTMLAudioElement | null;
  /** Presenter voice audio element, if one is currently loaded. */
  presenterAudio?: HTMLAudioElement | null;
  /**
   * Lets the caller route presenter elements created after export starts into
   * the already-live WebAudio graph. Fragmented presenter reads create a fresh
   * Audio element for each phrase/name clip, so a one-time snapshot is not enough.
   */
  onAudioRouterReady?: (route: ((element: HTMLAudioElement | null) => void) | null) => void;
  /** Total episode length in milliseconds — recording stops at the latest when this elapses. */
  durationMs: number;
  onProgress?: (progress: TotpExportProgress) => void;
}

export class TotpExportUnsupportedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "TotpExportUnsupportedError";
  }
}

/** Pick the best MediaRecorder mime type this browser can produce. */
export function totpExportMimeType(): string {
  if (typeof MediaRecorder === "undefined") {
    throw new TotpExportUnsupportedError("This browser cannot record video. Try Chrome, Edge or Firefox on a computer.");
  }
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  const supported = candidates.find((type) => MediaRecorder.isTypeSupported(type));
  if (!supported) {
    throw new TotpExportUnsupportedError("This browser cannot record video. Try Chrome, Edge or Firefox on a computer.");
  }
  return supported;
}

function findBroadcastCanvas(container: HTMLElement): HTMLCanvasElement {
  const canvas = container.querySelector<HTMLCanvasElement>("canvas");
  if (!canvas) throw new TotpExportUnsupportedError("The broadcast picture is not ready yet — let the episode load, then try again.");
  if (typeof canvas.captureStream !== "function") {
    throw new TotpExportUnsupportedError("This browser cannot record video. Try Chrome, Edge or Firefox on a computer.");
  }
  return canvas;
}

/**
 * Record the broadcast until `shouldStop()` returns true or the duration
 * elapses. The caller is responsible for restarting playback before calling
 * this and for pausing playback afterwards.
 */
export async function recordTotpBroadcast(options: TotpExportOptions & { shouldStop?: () => boolean }): Promise<Blob> {
  const mimeType = totpExportMimeType();
  const canvas = findBroadcastCanvas(options.container);
  const videoStream = canvas.captureStream(TOTP_EXPORT_PROFILE.frameRate);

  // Mix whatever audio elements exist into a single track. If audio routing
  // fails (e.g. cross-origin restrictions) we still export the picture.
  let audioContext: AudioContext | null = null;
  const cleanupAudio: Array<() => void> = [];
  try {
    const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextCtor) {
      audioContext = new AudioContextCtor();
      const destination = audioContext.createMediaStreamDestination();
      const routedElements = new Set<HTMLAudioElement>();
      const routeAudio = (element: HTMLAudioElement | null) => {
        if (!element || routedElements.has(element)) return;
        try {
          const source = audioContext!.createMediaElementSource(element);
          source.connect(destination);
          source.connect(audioContext!.destination); // keep it audible while recording
          routedElements.add(element);
          cleanupAudio.push(() => source.disconnect());
        } catch {
          // Element already routed elsewhere or not capturable — skip it.
        }
      };
      routeAudio(options.songAudio ?? null);
      routeAudio(options.presenterAudio ?? null);
      options.onAudioRouterReady?.(routeAudio);
      for (const track of destination.stream.getAudioTracks()) videoStream.addTrack(track);
    }
  } catch {
    audioContext = null;
  }

  const recorder = new MediaRecorder(videoStream, {
    mimeType,
    videoBitsPerSecond: TOTP_EXPORT_PROFILE.videoBitsPerSecond,
    audioBitsPerSecond: TOTP_EXPORT_PROFILE.audioBitsPerSecond,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };

  const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
  recorder.start(1_000);

  const startedAt = performance.now();
  const maxMs = options.durationMs + 5_000;
  await new Promise<void>((resolve) => {
    const poll = () => {
      const elapsed = performance.now() - startedAt;
      options.onProgress?.({ state: "recording", percent: Math.min(100, Math.round((elapsed / Math.max(1, options.durationMs)) * 100)) });
      if (options.shouldStop?.() || elapsed >= maxMs) { resolve(); return; }
      window.setTimeout(poll, 250);
    };
    poll();
  });

  options.onProgress?.({ state: "finishing", percent: 100 });
  recorder.stop();
  await stopped;

  options.onAudioRouterReady?.(null);
  for (const cleanup of cleanupAudio) cleanup();
  if (audioContext) void audioContext.close().catch(() => undefined);
  for (const track of videoStream.getTracks()) track.stop();

  if (chunks.length === 0) throw new TotpExportUnsupportedError("Nothing was recorded — play the episode once, then try exporting again.");
  return new Blob(chunks, { type: mimeType.split(";")[0] });
}

/** Trigger a browser download of the exported episode. */
export function downloadTotpExport(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Build a broadcast-safe file name for an episode export. */
export function totpExportFileName(episodeNumber: number | null | undefined, episodeDate: string | null | undefined, blob?: Blob): string {
  const numberPart = episodeNumber != null ? `episode-${episodeNumber}` : "episode";
  const datePart = episodeDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const extension = blob?.type.includes("mp4") ? "mp4" : "webm";
  return `top-of-the-pops-${numberPart}-${datePart}.${extension}`;
}
