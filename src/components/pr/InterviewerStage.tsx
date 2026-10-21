import { useId, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Camera, Clapperboard, Headphones, Mic2, Newspaper, Radio, UserRound, UsersRound, Video, Waves } from "lucide-react";
import { chooseInterviewShot, type InterviewCameraShot } from "@/data/interviewCamera";
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
  questionIndex: number;
  guestName: string;
  guestAvatarSrc?: string | null;
  guestStatus: "loading" | "ready" | "unavailable";
  playerLine?: string;
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
  questionIndex, guestName, guestAvatarSrc, guestStatus, playerLine,
}: InterviewerStageProps) => {
  const sceneKey = `${phase}:${questionIndex}`;
  const [manualShot, setManualShot] = useState<{ sceneKey: string; value: InterviewCameraShot } | null>(null);
  const shot = manualShot?.sceneKey === sceneKey ? manualShot.value : chooseInterviewShot(phase, questionIndex);

  const StudioIcon = studioIcons[mediaType as keyof typeof studioIcons] || Mic2;
  const broadcast = ["tv", "film", "internet"].includes(mediaType);
  const audio = ["radio", "podcast"].includes(mediaType);
  const print = ["newspaper", "magazine"].includes(mediaType);
  const label = studioLabels[mediaType] || "IN CONVERSATION";
  const stageColour = audio
    ? "from-[#111b31] via-[#184552] to-[#24213b]"
    : print ? "from-[#302333] via-[#403344] to-[#1a3744]"
      : mediaType === "internet" ? "from-[#111a36] via-[#283b70] to-[#361a4b]"
        : "from-[#181225] via-[#2a193e] to-[#112f3d]";

  return (
    <div className={`relative overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-br ${stageColour} p-3 text-white sm:p-4`}>
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

      <div className="relative space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
            {shot === "wide" ? "Two-shot" : shot === "host" ? "Presenter camera" : "Artist camera"}
          </span>
          <div className="flex items-center gap-1" role="group" aria-label="Interview camera angle">
            {(["wide", "host", "guest"] as const).map((view) => {
              const Icon = view === "wide" ? UsersRound : view === "host" ? Camera : UserRound;
              return <button
                key={view}
                type="button"
                onClick={() => setManualShot({ sceneKey, value: view })}
                aria-label={view === "wide" ? "Two-person view" : view === "host" ? "Focus interviewer" : "Focus my avatar"}
                aria-pressed={shot === view}
                className={`rounded-md border px-2.5 py-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${shot === view ? "border-cyan-300/80 bg-cyan-300/20 text-white" : "border-white/20 bg-black/20 text-slate-300 hover:bg-white/15"}`}
              ><Icon className="h-3.5 w-3.5" aria-hidden /></button>;
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            key={`host:${shot}:${phase}`}
            initial={{ opacity: .7, scale: .97 }}
            animate={{ opacity: shot === "guest" ? .65 : 1, scale: shot === "host" ? 1.02 : 1 }}
            transition={{ duration: .2 }}
            className={`relative flex min-w-0 flex-col items-center justify-center rounded-xl border bg-black/20 p-2 text-center ${shot === "host" ? "border-cyan-300/80 ring-1 ring-cyan-300/35" : "border-white/15"}`}
          >
            <Portrait presenter={presenter} mood={mood} />
            <p className="mt-1 truncate w-full font-oswald text-sm font-semibold sm:text-base">{presenter.name}</p>
            <p className="max-w-full truncate text-[10px] text-slate-300 sm:text-xs">{presenter.role}</p>
          </motion.div>
          <motion.div
            key={`guest:${shot}:${phase}`}
            initial={{ opacity: .7, scale: .97 }}
            animate={{ opacity: shot === "host" ? .75 : 1, scale: shot === "guest" ? 1.02 : 1 }}
            transition={{ duration: .2 }}
            className={`relative flex min-w-0 flex-col items-center justify-center rounded-xl border bg-black/20 p-2 text-center ${shot === "guest" ? "border-violet-300/80 ring-1 ring-violet-300/35" : "border-white/15"}`}
          >
            <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-violet-300/30 bg-[#171b30] sm:h-36 sm:w-36">
              {guestAvatarSrc && guestStatus === "ready" ? (
                <img src={guestAvatarSrc} alt={`Saved Avatar V1 for ${guestName}`} className="h-full w-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-1 p-1 text-slate-300">
                  <UserRound className="h-8 w-8" aria-hidden />
                  <span className="text-center text-[10px]">{guestStatus === "loading" ? "Preparing avatar…" : "Avatar unavailable"}</span>
                </div>
              )}
            </div>
            <p className="mt-1 max-w-full truncate font-oswald text-sm font-semibold sm:text-base">{guestName}</p>
            <p className="text-[10px] text-slate-300 sm:text-xs">{guestStatus === "ready" ? "Your saved outfit" : "Guest musician"}</p>
          </motion.div>
        </div>
        {phase === "reaction" && playerLine && (
          <div className="rounded-lg border border-violet-300/25 bg-violet-200/10 p-2 text-xs text-violet-100">
            <span className="mr-2 font-bold uppercase tracking-wider">You said</span>
            <span>“{playerLine}”</span>
          </div>
        )}
        <motion.div
          key={`${phase}:${dialogue}`}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: .2 }}
          aria-live={phase === "reaction" ? "polite" : "off"}
          className="relative rounded-xl border border-white/15 bg-white/10 px-3 py-3 shadow-inner backdrop-blur-sm"
        >
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-200">{presenter.name}</p>
          <p className="text-sm font-medium leading-relaxed sm:text-base">“{dialogue}”</p>
        </motion.div>
      </div>
      {print ? (
        <div aria-hidden className="relative mt-3 flex items-center gap-2 border-t border-white/10 pt-2">
          <Newspaper className="h-3.5 w-3.5 text-slate-300/70" />
          {[64, 42, 78, 36].map((width, i) => (
            <span key={i} className="h-0.5 rounded-full bg-slate-200/30" style={{ width: `${width}%`, maxWidth: "3.5rem" }} />
          ))}
        </div>
      ) : (
        <div aria-hidden className="relative mt-3 flex h-4 items-end justify-between gap-0.5 border-t border-white/10 pt-2">
          {Array.from({ length: audio ? 30 : 18 }, (_, i) => (
            <span key={i} className="flex-1 rounded-sm bg-cyan-300/40"
              style={{ height: `${20 + ((i * 17 + presenter.id.length * 7) % 75)}%` }} />
          ))}
        </div>
      )}
    </div>
  );
};
