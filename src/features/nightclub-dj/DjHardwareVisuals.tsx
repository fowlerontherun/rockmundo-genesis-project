import { formatDjTime } from "./mixerMath";
import type { DjHotCueSlots } from "./djHardwareControls";

export function DjWaveform({
  deck, trackId, position,
}: { deck: "A" | "B"; trackId: string; position: number }) {
  // A repeatable graphic until rights-cleared audio waveform analysis exists.
  // Never present these bars as a sampled audio waveform or a beat grid.
  let seed = 0x811c9dc5;
  for (const ch of trackId) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  const bars = Array.from({ length: 90 }, (_, i) => {
    const local = Math.sin((i + 7) * .29) * .22 + Math.sin((i + 4) * .79) * .18;
    const rand = (Math.imul((seed + i * 9511) | 0, 1664525) >>> 0) / 0xffffffff;
    return 7 + Math.floor((.3 + rand * .7 + local) * 41);
  });
  const fraction = Number.isFinite(position) ? Math.min(1, Math.max(0, position)) : 0;
  return (
    <div className={`rm-dj-wave rm-dj-wave--${deck.toLowerCase()}`}
      data-testid={`dj-waveform-${deck}`} aria-hidden="true">
      <svg viewBox="0 0 360 64" preserveAspectRatio="none">
        {bars.map((height, i) => (
          <rect key={i} x={i * 4 + .65} y={(64 - height) / 2}
            width="2.35" height={height} rx=".75"
            opacity={i / bars.length < fraction ? .98 : .63} />
        ))}
      </svg>
      <span className="rm-dj-wave-playhead" style={{ left: `${fraction * 100}%` }} />
    </div>
  );
}

export function DjPlatter({
  deck, playing, disabled, onNudge,
}: {
  deck: "A" | "B";
  playing: boolean;
  disabled: boolean;
  onNudge: (direction: -1 | 1) => void;
}) {
  return (
    <div className={`rm-dj-platter-wrap rm-dj-platter-wrap--${deck.toLowerCase()}`}>
      <div className="rm-dj-platter" data-playing={playing ? "true" : "false"}
        aria-hidden="true">
        <div className="rm-dj-platter-rotor">
          <div className="rm-dj-platter-label"><span>RM</span><b>{deck}</b><small>DIRECT DRIVE</small></div>
        </div>
      </div>
      <div className="rm-dj-jog-row" role="group" aria-label={`Deck ${deck} jog controls`}>
        <button type="button" disabled={disabled} onClick={() => onNudge(-1)}
          aria-label={`Nudge Deck ${deck} back one second`}>−1s</button>
        <span>JOG / SEEK</span>
        <button type="button" disabled={disabled} onClick={() => onNudge(1)}
          aria-label={`Nudge Deck ${deck} forward one second`}>+1s</button>
      </div>
    </div>
  );
}

export function DjPadBank({
  deck, cues, mode, disabled, onPress, onToggleMode,
}: {
  deck: "A" | "B";
  cues: DjHotCueSlots;
  mode: "store" | "play";
  disabled: boolean;
  onPress: (index: number) => void;
  onToggleMode: () => void;
}) {
  return (
    <div className="rm-dj-pad-unit">
      <div className="rm-dj-pad-head">
        <span>HOT CUE / PERFORMANCE</span>
        <button type="button" aria-pressed={mode === "store"} onClick={onToggleMode}
          disabled={disabled} className="rm-dj-pad-mode">
          {mode === "store" ? "STORE ON" : "SET PADS"}
        </button>
      </div>
      <div className="rm-dj-pad-grid" role="group" aria-label={`Deck ${deck} eight hot cue pads`}>
        {Array.from({ length: 8 }, (_, i) => {
          const saved = cues[i];
          const active = typeof saved === "number";
          return (
            <button key={i} type="button" className={`rm-dj-pad rm-dj-pad--${i % 4 + 1}`}
              disabled={disabled || (mode === "play" && !active)}
              data-saved={active ? "true" : "false"}
              onClick={() => onPress(i)}
              aria-label={mode === "store"
                ? `Store Deck ${deck} hot cue ${i + 1} at current position`
                : active
                  ? `Jump Deck ${deck} to hot cue ${i + 1}, ${formatDjTime(saved)}`
                  : `Deck ${deck} hot cue ${i + 1} empty`}
              title={active ? `Cue ${i + 1} · ${formatDjTime(saved)}` : "Empty · use Set pads"}>
              <strong>{i + 1}</strong>
              <small>{active ? formatDjTime(saved) : "—"}</small>
            </button>
          );
        })}
      </div>
      <p className="rm-dj-pad-help">Store a position, then tap to jump. Pads stay local to this loaded track.</p>
    </div>
  );
}

export function DjTrimMeter({
  side, active, value,
}: { side: "A" | "B"; active: boolean; value: number }) {
  // Output-position feedback only, not a measured VU/RMS signal.
  const normalized = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <div className="rm-dj-trim-meter" aria-label={`Deck ${side} estimated output trim ${Math.round(normalized * 100)} percent`}>
      {Array.from({ length: 12 }, (_, index) => (
        <span key={index} data-lit={active && normalized >= (index + 1) / 12 ? "true" : "false"} />
      ))}
    </div>
  );
}
