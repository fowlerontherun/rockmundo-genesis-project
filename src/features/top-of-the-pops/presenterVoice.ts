import type { TotpPresenterKey } from "./presenters";

/**
 * Shared presenter voice engine for Top of the Pops.
 *
 * One module owns every spoken presenter line so the archive player, the
 * continuity links and the chart rundown all sound like the same broadcast:
 * the same voice per presenter, the same script tidy-up, the same ducking
 * signal for the music bed, and the same recorded-audio-first fallback chain.
 */

export interface TotpPresenterVoiceProfile {
  /** Speaking rate for the browser voice (1 = normal). */
  rate: number;
  /** Pitch for the browser voice (1 = normal). */
  pitch: number;
  /** Playback rate applied to pre-recorded presenter audio. */
  recordedRate: number;
  /** Preferred installed-voice names, most wanted first. */
  preferredVoices: string[];
  /** Voice gender hint used when no preferred name is installed. */
  gender: "male" | "female";
}

const DEFAULT_PROFILE: TotpPresenterVoiceProfile = {
  rate: 1.06,
  pitch: 1.02,
  recordedRate: 1.02,
  preferredVoices: ["Google UK English Male", "Daniel", "Arthur", "Oliver"],
  gender: "male",
};

export const TOTP_PRESENTER_VOICE_PROFILES: Record<TotpPresenterKey, TotpPresenterVoiceProfile> = {
  alex_rayne: DEFAULT_PROFILE,
  maya_stone: {
    rate: 1.1,
    pitch: 1.14,
    recordedRate: 1.04,
    preferredVoices: ["Google UK English Female", "Serena", "Kate", "Martha"],
    gender: "female",
  },
  jack_mercer: {
    rate: 1.02,
    pitch: 0.94,
    recordedRate: 1,
    preferredVoices: ["Google UK English Male", "Daniel", "Arthur"],
    gender: "male",
  },
  nia_vale: {
    rate: 1.08,
    pitch: 1.08,
    recordedRate: 1.03,
    preferredVoices: ["Google UK English Female", "Martha", "Serena"],
    gender: "female",
  },
};

export function totpPresenterVoiceProfile(key?: string | null): TotpPresenterVoiceProfile {
  return TOTP_PRESENTER_VOICE_PROFILES[(key ?? "alex_rayne") as TotpPresenterKey] ?? DEFAULT_PROFILE;
}

const FEMALE_HINT = /(female|serena|martha|kate|fiona|samantha|amelie|karen|moira|tessa|zira|hazel|libby|sonia)/i;
const MALE_HINT = /(male|daniel|arthur|oliver|george|ryan|thomas|alex|fred|david|guy)/i;
const NOVELTY = /(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|ralph|kathy)/i;

/**
 * Score installed voices and return the most broadcast-appropriate one.
 * British English wins, then the presenter's own gender, then any English
 * voice. Novelty system voices are pushed to the bottom.
 */
export function pickTotpPresenterVoice<T extends { name: string; lang: string; localService?: boolean }>(
  voices: readonly T[],
  profile: TotpPresenterVoiceProfile,
): T | null {
  if (!voices.length) return null;
  const scored = voices
    .filter((voice) => /^en/i.test(voice.lang))
    .map((voice) => {
      let score = 0;
      const preferredIndex = profile.preferredVoices.findIndex(
        (name) => name.toLowerCase() === voice.name.toLowerCase(),
      );
      if (preferredIndex >= 0) score += 100 - preferredIndex;
      if (/en[-_]GB/i.test(voice.lang)) score += 40;
      const hint = profile.gender === "female" ? FEMALE_HINT : MALE_HINT;
      if (hint.test(voice.name)) score += 20;
      if (voice.localService === false) score += 6; // cloud voices sound smoother
      if (NOVELTY.test(voice.name)) score -= 80;
      return { voice, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.voice ?? null;
}

const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\bNo\.?\s*(\d+)/gi, "number $1"],
  [/\bUK\b/g, "U K"],
  [/\bTOTP\b/gi, "Top of the Pops"],
  [/\bfeat\.?\b/gi, "featuring"],
  [/\bft\.?\b/gi, "featuring"],
  [/\bvs\.?\b/gi, "versus"],
  [/&/g, "and"],
  [/\b(\d+)(st|nd|rd|th)\b/g, "$1$2"],
];

/**
 * Tidy a written running-sheet line into something a voice reads cleanly:
 * expand broadcast shorthand, give exclamations a beat of air, collapse
 * stray whitespace and guarantee closing punctuation.
 */
export function prepareTotpPresenterScript(text: string): string {
  let script = text.replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of ABBREVIATIONS) script = script.replace(pattern, replacement);
  script = script.replace(/([!?])\s*/g, "$1 ");
  script = script.replace(/\s*—\s*/g, ", ");
  script = script.replace(/\.{3,}/g, ", ");
  script = script.replace(/\s+([,.!?])/g, "$1").replace(/\s+/g, " ").trim();
  if (script && !/[.!?]$/.test(script)) script += ".";
  return script;
}

/**
 * Split a prepared script into sentence-sized utterances. Long single
 * utterances are truncated by some browsers, and sentence-by-sentence
 * delivery also gives natural breaths between lines.
 */
export function splitTotpPresenterScript(text: string, maxChars = 180): string[] {
  const prepared = prepareTotpPresenterScript(text);
  if (!prepared) return [];
  const sentences = prepared.match(/[^.!?]+[.!?]+/g) ?? [prepared];
  const parts: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const piece = sentence.trim();
    if (!piece) continue;
    if (current && current.length + piece.length + 1 > maxChars) {
      parts.push(current);
      current = piece;
    } else {
      current = current ? `${current} ${piece}` : piece;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function availableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices();
}

async function waitForVoices(timeoutMs = 1_200): Promise<SpeechSynthesisVoice[]> {
  const immediate = availableVoices();
  if (immediate.length || typeof window === "undefined" || !("speechSynthesis" in window)) return immediate;
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve(availableVoices());
    }, timeoutMs);
    const handler = () => {
      window.clearTimeout(timer);
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve(availableVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
  });
}

export function cancelTotpPresenterSpeech(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}

export interface TotpPresenterRecordedClip {
  url: string;
  /** Optional pause after this clip before the next fragment starts. */
  gapAfterMs?: number;
}

export interface TotpPresenterLineOptions {
  /** Script to speak when no recorded read is available. */
  text: string;
  presenterKey?: string | null;
  /** Optional complete pre-recorded presenter read, tried first. */
  recordedUrl?: string | null;
  /** Optional reusable fragment sequence, tried after the complete take. */
  recordedSequence?: TotpPresenterRecordedClip[] | null;
  /** Programme mix level for the presenter bus (0-1). */
  volume?: number;
  /** Fires when the line actually starts, so the music bed can duck. */
  onSpeakingChange?: (speaking: boolean) => void;
  /** Fires whenever the active recorded fragment changes. */
  onRecordedElementChange?: (element: HTMLAudioElement | null) => void;
  /** Fires once the whole line has been delivered. */
  onEnded?: () => void;
}

export interface TotpPresenterLineHandle {
  /** Stops the line immediately and releases the audio element. */
  stop: () => void;
  /** The recorded element, when a recorded read is playing. */
  element: HTMLAudioElement | null;
}

/**
 * Deliver one presenter line: recorded read first, browser voice as the
 * fallback, with a single speaking signal either way.
 */
export function playTotpPresenterLine(options: TotpPresenterLineOptions): TotpPresenterLineHandle {
  const profile = totpPresenterVoiceProfile(options.presenterKey);
  const volume = Math.max(0, Math.min(1, options.volume ?? 0.95));
  const handle: TotpPresenterLineHandle = { stop: () => {}, element: null };
  let cancelled = false;
  let speaking = false;
  let gapTimer = 0;
  let resolveGap: (() => void) | null = null;

  const setElement = (element: HTMLAudioElement | null) => {
    handle.element = element;
    options.onRecordedElementChange?.(element);
  };

  const setSpeaking = (value: boolean) => {
    if (speaking === value) return;
    speaking = value;
    options.onSpeakingChange?.(value);
  };

  const finish = () => {
    setElement(null);
    setSpeaking(false);
    if (!cancelled) options.onEnded?.();
  };

  const speakWithBrowserVoice = async () => {
    setElement(null);
    if (cancelled || typeof window === "undefined" || !("speechSynthesis" in window)) {
      finish();
      return;
    }
    const parts = splitTotpPresenterScript(options.text);
    if (!parts.length) {
      finish();
      return;
    }
    const voices = await waitForVoices();
    if (cancelled) return;
    const voice = pickTotpPresenterVoice(voices, profile);
    window.speechSynthesis.cancel();
    setSpeaking(true);
    parts.forEach((part, index) => {
      const utterance = new SpeechSynthesisUtterance(part);
      utterance.rate = profile.rate;
      utterance.pitch = profile.pitch;
      utterance.volume = volume;
      if (voice) utterance.voice = voice;
      if (index === parts.length - 1) {
        utterance.onend = finish;
        utterance.onerror = finish;
      }
      window.speechSynthesis.speak(utterance);
    });
  };

  const playable = async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(url, { method: "HEAD" });
      return response.ok;
    } catch {
      return false;
    }
  };

  const playRecordedElement = (url: string): Promise<void> => new Promise((resolve, reject) => {
    if (cancelled) {
      resolve();
      return;
    }
    const audio = new Audio(url);
    audio.volume = volume;
    audio.playbackRate = profile.recordedRate;
    audio.onended = () => {
      if (handle.element === audio) setElement(null);
      resolve();
    };
    audio.onerror = () => {
      if (handle.element === audio) setElement(null);
      reject(new Error("Recorded presenter fragment failed to play."));
    };
    setElement(audio);
    void audio.play().catch((error) => {
      if (handle.element === audio) setElement(null);
      reject(error);
    });
  });

  const playRecordedSequence = async (clips: TotpPresenterRecordedClip[]) => {
    const normalized = clips.filter((clip) => clip.url?.trim()).map((clip) => ({
      url: clip.url.trim(),
      gapAfterMs: Math.max(0, Math.min(500, Math.round(clip.gapAfterMs ?? 70))),
    }));
    if (!normalized.length) {
      await speakWithBrowserVoice();
      return;
    }

    const availability = await Promise.all(normalized.map((clip) => playable(clip.url)));
    if (cancelled) return;
    if (availability.some((available) => !available)) {
      await speakWithBrowserVoice();
      return;
    }

    setSpeaking(true);
    try {
      for (let index = 0; index < normalized.length; index += 1) {
        if (cancelled) return;
        const clip = normalized[index];
        await playRecordedElement(clip.url);
        if (cancelled) return;
        if (index < normalized.length - 1 && clip.gapAfterMs > 0) {
          await new Promise<void>((resolve) => {
            resolveGap = resolve;
            gapTimer = window.setTimeout(() => {
              gapTimer = 0;
              resolveGap = null;
              resolve();
            }, clip.gapAfterMs);
          });
        }
      }
      finish();
    } catch {
      if (!cancelled) await speakWithBrowserVoice();
    }
  };

  const startPlayback = async () => {
    if (options.recordedUrl) {
      const available = await playable(options.recordedUrl);
      if (cancelled) return;
      if (available) {
        setSpeaking(true);
        try {
          await playRecordedElement(options.recordedUrl);
          if (!cancelled) finish();
          return;
        } catch {
          // Fall through to fragments/browser voice.
        }
      }
    }

    const sequence = options.recordedSequence?.filter((clip) => clip.url?.trim()) ?? [];
    if (sequence.length) {
      await playRecordedSequence(sequence);
      return;
    }

    await speakWithBrowserVoice();
  };

  void startPlayback();

  handle.stop = () => {
    cancelled = true;
    if (gapTimer && typeof window !== "undefined") window.clearTimeout(gapTimer);
    gapTimer = 0;
    resolveGap?.();
    resolveGap = null;
    setSpeaking(false);
    if (handle.element) {
      handle.element.pause();
      handle.element.onended = null;
      handle.element.onerror = null;
      setElement(null);
    } else {
      setElement(null);
    }
    cancelTotpPresenterSpeech();
  };

  return handle;
}
