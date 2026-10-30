import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Award,
  Camera,
  AlertCircle,
  Gauge,
  Drama,
  Newspaper,
  PartyPopper,
  Sparkles,
  Trophy,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AwardShow } from "@/hooks/useAwards";

type ConfirmedAwardPerformance = {
  id: string;
  slot_label: string;
  stage: string | null;
  band_name?: string;
};

interface AwardCeremonyExperienceProps {
  show: AwardShow;
  hasNomination: boolean;
  confirmedPerformances?: ConfirmedAwardPerformance[];
  performancesLoadingFailed?: boolean;
  onAttendRedCarpet: (outfitChoice: string) => Promise<unknown>;
  redCarpetAttended?: boolean;
  redCarpetLoading?: boolean;
  isAttending?: boolean;
  currentGameYear?: number;
}

type CeremonyPhase = "red_carpet" | "opening" | "awards" | "finale" | "after_party";

type RunOfShowSegment = {
  type: "host_intro" | "award" | "performance";
  title: string;
  presenter?: string;
  performer?: string;
  songs?: string[];
  commentary: string;
  audio_cue?: string;
  crowd_profile?: "calm" | "warm" | "hype" | "chaotic";
};

const CEREMONY_PHASES: { id: CeremonyPhase; label: string; icon: React.ElementType }[] = [
  { id: "red_carpet", label: "Red Carpet", icon: Camera },
  { id: "opening", label: "Opening", icon: Sparkles },
  { id: "awards", label: "Awards Show", icon: Trophy },
  { id: "finale", label: "Finale", icon: PartyPopper },
  { id: "after_party", label: "After Party", icon: Drama },
];

const OUTFIT_OPTIONS = [
  { id: "standard", label: "Smart Formal", fame: 25, description: "Classic suit or dress" },
  { id: "designer", label: "Designer Outfit", fame: 50, description: "Head-to-toe designer wear" },
  { id: "custom", label: "Custom Couture", fame: 75, description: "One-of-a-kind statement piece" },
];

const defaultHost = "Avery Stone";
const EMPTY_CONFIRMED_PERFORMANCES: ConfirmedAwardPerformance[] = [];

const crowdDelta: Record<NonNullable<RunOfShowSegment["crowd_profile"]>, number> = {
  calm: 4,
  warm: 10,
  hype: 18,
  chaotic: 24,
};

const buildRunOfShow = (
  show: AwardShow,
  confirmedPerformances: ConfirmedAwardPerformance[],
): RunOfShowSegment[] => {
  const categories = ((show.categories as any[]) || []).slice(0, 5);
  const host = show.host_name || defaultHost;
  const scripted = Array.isArray(show.run_of_show) ? (show.run_of_show as RunOfShowSegment[]) : [];
  if (scripted.length > 0) return scripted;

  // No invented performers: only existing, confirmed slots are presented.
  const segments: RunOfShowSegment[] = [
    {
      type: "host_intro",
      title: "Host Welcome",
      commentary:
        show.host_intro ||
        `${host} walks to center stage and welcomes the world to ${show.show_name}, promising surprise moments and emotional speeches.`,
      audio_cue: "host_intro_theme",
      crowd_profile: "warm",
    },
  ];

  categories.forEach((cat: any, index: number) => {
    segments.push({
      type: "award",
      title: cat.name || `Award Category ${index + 1}`,
      presenter: `Presenter ${index + 1}`,
      commentary: `${host} introduces ${cat.name || "the next category"} and teases the presenter before opening the envelope live.`,
      audio_cue: "envelope_suspense_sting",
      crowd_profile: "hype",
    });


  });

  confirmedPerformances.forEach((booking) => {
    segments.push({
      type: "performance",
      title: booking.slot_label || "Confirmed Performance",
      performer: booking.band_name || "Confirmed performer",
      commentary: `A confirmed performance is scheduled for ${booking.stage || "the main stage"}.`,
      audio_cue: "interlude_performance_bed",
      crowd_profile: "hype",
    });
  });

  segments.push({
    type: "host_intro",
    title: "Closing Remarks",
    commentary: `${host} thanks the performers, presenters and voters for joining ${show.show_name}.`,
    audio_cue: "grand_closer_fireworks",
    crowd_profile: "warm",
  });

  return segments;
};

const resolveHeadline = (crowd: number, suspense: number, hasNomination: boolean) => {
  if (hasNomination && suspense >= 75) return "Press: Your fanbase is calling this the closest race of the night.";
  if (crowd >= 85) return "Press: Critics call this ceremony a career-defining spectacle.";
  if (crowd >= 65) return "Press: Strong crowd energy keeps the show trending worldwide.";
  return "Press: Solid ceremony momentum, but pundits want more surprises.";
};

export function AwardCeremonyExperience({
  show,
  hasNomination,
  onAttendRedCarpet,
  confirmedPerformances = EMPTY_CONFIRMED_PERFORMANCES,
  performancesLoadingFailed = false,
  redCarpetAttended = false,
  redCarpetLoading = false,
  isAttending,
  currentGameYear,
}: AwardCeremonyExperienceProps) {
  const [currentPhase, setCurrentPhase] = useState<CeremonyPhase>(redCarpetAttended ? "opening" : "red_carpet");
  const [selectedOutfit, setSelectedOutfit] = useState<string | null>(null);
  const [redCarpetComplete, setRedCarpetComplete] = useState(redCarpetAttended);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [crowdEnergy, setCrowdEnergy] = useState(44);
  const [suspense, setSuspense] = useState(28);
  const [hostMood, setHostMood] = useState("Confident");

  useEffect(() => {
    if (redCarpetAttended) {
      setRedCarpetComplete(true);
      setCurrentPhase((phase) => phase === "red_carpet" ? "opening" : phase);
    }
  }, [redCarpetAttended]);

  const runOfShow = useMemo(
    () => buildRunOfShow(show, confirmedPerformances),
    [show, confirmedPerformances],
  );
  const activeSegment = runOfShow[segmentIndex];
  const currentPhaseIndex = CEREMONY_PHASES.findIndex((phase) => phase.id === currentPhase);

  const advanceSegment = () => {
    if (!activeSegment) return;

    const profile = activeSegment.crowd_profile || "warm";
    const nextCrowd = Math.min(100, crowdEnergy + crowdDelta[profile]);
    const suspenseDelta = activeSegment.type === "award" ? 18 : activeSegment.type === "host_intro" ? 8 : -6;
    const nextSuspense = Math.max(0, Math.min(100, suspense + suspenseDelta));

    setCrowdEnergy(nextCrowd);
    setSuspense(nextSuspense);
    setHostMood(nextSuspense > 70 ? "Dramatic" : nextCrowd > 80 ? "Electrified" : "Composed");

    if (segmentIndex >= runOfShow.length - 1) {
      setCurrentPhase("finale");
      return;
    }

    setSegmentIndex((current) => current + 1);
  };

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-amber-500/5 to-yellow-500/5 border-amber-500/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            {CEREMONY_PHASES.map((phase, idx) => {
              const Icon = phase.icon;
              const isActive = phase.id === currentPhase;
              const isComplete = idx < currentPhaseIndex;
              return (
                <div key={phase.id} className="flex items-center">
                  <button
                    onClick={() => { if (idx <= currentPhaseIndex) setCurrentPhase(phase.id); }}
                    disabled={idx > currentPhaseIndex}
                    aria-label={phase.label}
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                      isActive && "bg-amber-500 text-white scale-110 shadow-lg",
                      isComplete && "bg-amber-500/30 text-amber-400",
                      !isActive && !isComplete && "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                  {idx < CEREMONY_PHASES.length - 1 && (
                    <div className={cn("w-6 h-0.5 mx-1", isComplete ? "bg-amber-500/50" : "bg-muted")} />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-sm text-muted-foreground text-center">
            {CEREMONY_PHASES[currentPhaseIndex]?.label} — Hosted by {show.host_name || defaultHost}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Gauge className="h-3 w-3" />Crowd Energy</p>
              <Progress value={crowdEnergy} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircle className="h-3 w-3" />Envelope Suspense</p>
              <Progress value={suspense} />
            </div>
          </div>
        </CardContent>
      </Card>

      {currentPhase === "red_carpet" && (
        <Card>
          <CardHeader>
            <CardTitle>Red Carpet Arrival</CardTitle>
            <CardDescription>Choose your style and make your entrance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {redCarpetComplete ? (
              <div className="text-center py-6">
                <Sparkles className="h-12 w-12 mx-auto mb-3 text-amber-500 animate-pulse" />
                <p className="font-semibold text-lg">You&apos;re making an entrance!</p>
              </div>
            ) : (
              OUTFIT_OPTIONS.map((outfit) => (
                <button
                  key={outfit.id}
                  onClick={async () => {
                    setSelectedOutfit(outfit.id);
                    try {
                      await onAttendRedCarpet(outfit.id);
                      setRedCarpetComplete(true);
                      setCurrentPhase("opening");
                    } catch {
                      // The mutation shows the server error. Do not claim arrival.
                    }
                  }}
                  disabled={isAttending || redCarpetLoading}
                  className={cn(
                    "w-full p-4 rounded-lg border text-left transition-all hover:border-amber-500/50",
                    selectedOutfit === outfit.id && "border-amber-500 bg-amber-500/10"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{outfit.label}</p>
                      <p className="text-sm text-muted-foreground">{outfit.description}</p>
                    </div>
                    <Badge variant="secondary" className="text-amber-500">+{outfit.fame} fame</Badge>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {currentPhase === "opening" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Award className="h-4 w-4 text-amber-500" />Opening Ceremony</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-center">
            <p className="text-lg font-medium">Welcome to {show.show_name}</p>
            <p className="text-muted-foreground">
              {(show.host_intro || `${show.host_name || defaultHost} welcomes the audience and introduces the night.`)}
            </p>
            <p className="text-xs text-muted-foreground">Host mood: {hostMood}</p>
            <Button onClick={() => setCurrentPhase("awards")}>Start Live Show</Button>
          </CardContent>
        </Card>
      )}

      {currentPhase === "awards" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" />Live Awards Timeline</CardTitle>
            <CardDescription>
              Ceremony segments are a preview, not an official winner announcement.
              The completed show history displays winners after database settlement.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {performancesLoadingFailed && (
              <p role="alert" className="text-sm text-destructive">
                Confirmed performance bookings could not be verified.
                This preview does not display an invented lineup.
              </p>
            )}
            <Progress value={((segmentIndex + 1) / Math.max(runOfShow.length, 1)) * 100} />
            {activeSegment && (
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{activeSegment.title}</p>
                  <Badge variant="outline">{activeSegment.type.replace("_", " ")}</Badge>
                </div>
                {activeSegment.presenter && <p className="text-sm">Presenter: {activeSegment.presenter}</p>}
                {activeSegment.performer && <p className="text-sm">Performer: {activeSegment.performer}</p>}
                {activeSegment.songs && <p className="text-sm text-muted-foreground">Songs: {activeSegment.songs.join(" • ")}</p>}
                <p className="text-sm text-muted-foreground">{activeSegment.commentary}</p>
                <Separator />
                <div className="grid sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1"><Volume2 className="h-3 w-3" />Audio cue: {activeSegment.audio_cue || "default_crowd_loop"}</p>
                  <p>Host mood now: {hostMood}</p>
                </div>
              </div>
            )}

            {hasNomination && activeSegment?.type === "award" && (
              <Badge className="bg-amber-500">Your nomination is recorded; check official results after the show.</Badge>
            )}

            <div className="flex gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Performance slots are confirmed through invitations. Check your Awards Show Invitations above.
              </p>
              <Button onClick={advanceSegment}>
                {segmentIndex >= runOfShow.length - 1 ? "Go To Finale" : "Next Segment"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentPhase === "finale" && (
        <Card className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border-amber-500/30">
          <CardContent className="text-center py-8 space-y-3">
            <PartyPopper className="h-16 w-16 mx-auto text-amber-500" />
            <h3 className="text-2xl font-bold">Ceremony Preview Complete</h3>
            <p className="text-muted-foreground">This ceremony preview is complete. Official winners appear in Awards History only after results are published.</p>
            <Button onClick={() => setCurrentPhase("after_party")}>Go to After Party</Button>
            <p className="text-sm text-muted-foreground flex justify-center items-center gap-1"><Newspaper className="h-4 w-4" />{resolveHeadline(crowdEnergy, suspense, hasNomination)}</p>
          </CardContent>
        </Card>
      )}

      {currentPhase === "after_party" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Drama className="h-4 w-4 text-amber-500" />After Party</CardTitle>
            <CardDescription>Celebrate the ceremony and relive the night. Published winners and rewards are recorded separately in Awards History.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{resolveHeadline(crowdEnergy, suspense, hasNomination)}</p>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
