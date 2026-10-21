import { useId } from "react";
import { motion } from "framer-motion";
import { BookOpen, Clapperboard, Headphones, Mic2, Newspaper, Radio, Video, Waves } from "lucide-react";
import type { InterviewPresenter, InterviewerMood } from "@/data/interviewPresenters";

type StagePhase = "intro" | "question" | "reaction" | "results";

interface InterviewerStageProps {
  presenter: InterviewPresenter;
  mediaType: string;
  outletName: string;
  showName?: string;
  phase: StagePhase;
  dialogue: string;
  mood?: InterviewerMood;
}

const studioIcons = {
  tv: Video,
  film: Clapperboard,
  radio: Radio,
  podcast: Headphones,
  magazine: BookOpen,
  newspaper: Newspaper,
  internet: Waves,
} as const;

const studioLabels: Record<string, string> = {
  tv: "ON CAMERA",
  film: "ROLLING",
  radio: "ON AIR",
  podcast: "RECORDING",
  magazine: "FEATURE INTERVIEW",
  newspaper: "PRESS INTERVIEW",
  internet: "LIVE STREAM",
};

const Portrait = ({ presenter, mood }: { presenter: InterviewPresenter; mood: InterviewerMood }) => {
  const { skin, hair, jacket, accent, hairstyle, glasses, beard } = presenter.appearance;
  const rawId = useId().replace(/:/g, "");
  const backgroundId = `interview-backdrop-${rawId}`;
  const clipId = `interview-portrait-${rawId}`;
  const mouth = mood === "amused" || mood === "warm" || mood === "impressed"
    ? "M85 116 Q101 131 116 115"
    : mood === "challenging" ? "M89 121 Q100 117 113 121"
      : mood === "awkward" ? "M89 120 Q101 123 113 118" : "M90 118 Q101 126 112 118";

  return (
    <svg viewBox="0 0 200 200" role="img" aria-label={`Illustrated portrait of ${presenter.name}`}
      className="h-24 w-24 shrink-0 sm:h-36 sm:w-36 drop-shadow-xl">
      <defs>
        <linearGradient id={backgroundId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.52" />
          <stop offset="100%" stopColor="#17182c" />
        </linearGradient>
        <clipPath id={clipId}><rect x="3" y="3" width="194" height="194" rx="24" /></clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="200" height="200" fill={`url(#${backgroundId})`} />
        <circle cx="160" cy="32" r="58" fill={accent} opacity=".15" />
        <path d="M13 211 Q22 152 74 151 L124 151 Q180 151 195 211" fill={jacket} />
        <path d="M75 152 L99 183 L125 152" fill={accent} opacity=".9" />
        <path d="M90 129 H111 V163 Q100 175 89 163Z" fill={skin} />
        {hairstyle === "long" || hairstyle === "waves" ? (
          <path d="M57 77 Q54 21 101 21 Q154 19 148 75 L153 160 Q137 166 126 153 L72 153 Q60 166 49 157Z" fill={hair} />
        ) : (
          <path d="M61 84 Q48 32 84 27 Q133 11 148 65 L143 94 L59 94Z" fill={hair} />
        )}
        <ellipse cx="100" cy="94" rx="41" ry="52" fill={skin} />
        <path d="M58 82 Q62 30 100 29 Q138 24 146 77 Q127 71 113 50 Q89 78 58 82Z" fill={hair} />
        {hairstyle === "waves" && <path d="M56 67 Q45 91 56 134 Q62 150 48 157 M147 70 Q158 95 146 135 Q140 151 154 158" stroke={hair} strokeWidth="13" fill="none" strokeLinecap="round" />}
        {hairstyle === "swept" && <path d="M64 61 Q102 21 144 58 Q115 65 89 54 Q78 70 64 71Z" fill={hair} />}
        {hairstyle === "short" && <path d="M70 45 Q99 27 133 47" stroke={hair} strokeWidth="10" fill="none" strokeLinecap="round" />}
        <ellipse cx="59" cy="100" rx="7" ry="13" fill={skin} />
        <ellipse cx="141" cy="100" rx="7" ry="13" fill={skin} />
        <path d="M72 88 Q85 82 94 89 M107 89 Q118 83 131 89" stroke={hair} strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="82" cy="97" r="3" fill="#24202a" />
        <circle cx="118" cy="97" r="3" fill="#24202a" />
        <path d="M100 96 L96 110 Q100 113 105 110" stroke="#834f49" opacity=".55" strokeWidth="2" fill="none" strokeLinecap="round" />
        {beard && <path d="M69 116 Q72 152 100 157 Q127 151 132 115 Q116 142 100 140 Q84 141 69 116Z" fill={hair} opacity=".75" />}
        <path d={mouth} stroke={beard ? "#eabf9c" : "#8d444e"} strokeWidth="2.8" fill="none" strokeLinecap="round" />
        {glasses && (
          <g fill="none" stroke="#302f3d" strokeWidth="3.5">
            <rect x="65" y="88" width="33" height="23" rx="8" />
            <rect x="102" y="88" width="33" height="23" rx="8" />
            <path d="M98 96 Q100 93 102 96 M64 95 L56 91 M136 95 L144 91" />
          </g>
        )}
        <path d="M8 197 H192" stroke={accent} strokeWidth="4" opacity=".8" />
      </g>
      <rect x="2.5" y="2.5" width="195" height="195" rx="24" stroke={accent} strokeOpacity=".4" strokeWidth="5" fill="none" />
    </svg>
  );
};

export const InterviewerStage = ({
  presenter, mediaType, outletName, showName, phase, dialogue, mood = "curious",
}: InterviewerStageProps) => {
  const StudioIcon = studioIcons[mediaType as keyof typeof studioIcons] || Mic2;
  const broadcast = ["tv", "film", "internet"].includes(mediaType);
  const audio = ["radio", "podcast"].includes(mediaType);
  const label = studioLabels[mediaType] || "IN CONVERSATION";

  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-br from-[#181225] via-[#2a193e] to-[#112f3d] p-3 text-white sm:p-4">
      {/* Vector studio lights and print/audio motifs: no remote art to load. */}
      <div aria-hidden className="pointer-events-none absolute -top-20 left-1/4 h-44 w-40 rotate-12 rounded-full bg-fuchsia-400/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-10 -bottom-24 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-slate-200">
          <StudioIcon className="h-3.5 w-3.5 text-cyan-300" aria-hidden />
          <span className="truncate">{outletName}</span>
          {showName && <span className="hidden truncate text-slate-400 sm:inline">/ {showName}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[10px] font-bold tracking-wide">
          {broadcast || audio ? <span className="h-1.5 w-1.5 rounded-full bg-red-400 motion-safe:animate-pulse" /> : <Newspaper className="h-3 w-3" aria-hidden />}
          {label}
        </div>
      </div>
      <div className="relative flex items-start gap-3 sm:gap-5">
        <motion.div
          key={`${presenter.id}:${phase === "reaction" ? mood : "idle"}`}
          initial={{ opacity: 0.7, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="shrink-0"
        >
          <Portrait presenter={presenter} mood={mood} />
        </motion.div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="leading-tight">
            <p className="font-oswald text-base font-bold sm:text-lg">{presenter.name}</p>
            <p className="text-xs text-slate-300">{presenter.role}</p>
          </div>
          <motion.div
            key={`${phase}:${dialogue}`}
            initial={{ opacity: 0, x: 7 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="relative rounded-xl rounded-tl-sm border border-white/15 bg-white/10 px-3 py-3 shadow-inner backdrop-blur-sm"
            aria-live={phase === "reaction" ? "polite" : "off"}
          >
            <p className="text-sm font-medium leading-relaxed sm:text-base">“{dialogue}”</p>
          </motion.div>
        </div>
      </div>
      <div aria-hidden className="relative mt-3 flex h-4 items-end justify-between gap-0.5 border-t border-white/10 pt-2">
        {Array.from({ length: audio ? 30 : 18 }, (_, i) => (
          <span key={i} className="flex-1 rounded-sm bg-cyan-300/40"
            style={{ height: `${20 + ((i * 17 + presenter.id.length * 7) % 75)}%` }} />
        ))}
      </div>
    </div>
  );
};
