import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Award,
  Camera,
  Mic,
  Music,
  PartyPopper,
  Masks,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AwardShow } from "@/hooks/useAwards";

interface AwardCeremonyExperienceProps {
  show: AwardShow;
  bandId?: string;
  hasNomination: boolean;
  onAttendRedCarpet: (outfitChoice: string) => void;
  onBookPerformance: (slotLabel: string, stage: string) => void;
  isAttending?: boolean;
  isBooking?: boolean;
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
};


type AfterPartyOutcomeType = "event" | "action" | "negative";

type AfterPartyOutcome = {
  type: AfterPartyOutcomeType;
  title: string;
  description: string;
  impact: string;
};

const CEREMONY_PHASES: { id: CeremonyPhase; label: string; icon: React.ElementType }[] = [
  { id: "red_carpet", label: "Red Carpet", icon: Camera },
  { id: "opening", label: "Opening", icon: Sparkles },
  { id: "awards", label: "Awards Show", icon: Trophy },
  { id: "finale", label: "Finale", icon: PartyPopper },
  { id: "after_party", label: "After Party", icon: Masks },
];

const OUTFIT_OPTIONS = [
  { id: "casual", label: "Casual Rockstar", fame: 15, description: "Leather jacket and jeans" },
  { id: "standard", label: "Smart Formal", fame: 25, description: "Classic suit or dress" },
  { id: "designer", label: "Designer Outfit", fame: 50, description: "Head-to-toe designer wear" },
  { id: "custom", label: "Custom Couture", fame: 75, description: "One-of-a-kind statement piece" },
  { id: "outrageous", label: "Outrageous Statement", fame: 100, description: "Meat dress level bold" },
];

const PERFORMANCE_SLOTS = [
  { id: "interlude_1", label: "Interlude 1", stage: "main", prestige: 1 },
  { id: "interlude_2", label: "Interlude 2", stage: "main", prestige: 2 },
  { id: "interlude_3", label: "Interlude 3", stage: "main", prestige: 3 },
  { id: "interlude_4", label: "Interlude 4", stage: "main", prestige: 4 },
  { id: "grand_closer", label: "Grand Closer", stage: "main", prestige: 5 },
];

const defaultHost = "Avery Stone";

const buildRunOfShow = (show: AwardShow): RunOfShowSegment[] => {
  const categories = ((show.categories as any[]) || []).slice(0, 5);
  const host = show.host_name || defaultHost;
  const scripted = Array.isArray(show.run_of_show) ? (show.run_of_show as RunOfShowSegment[]) : [];
  if (scripted.length > 0) return scripted;

  const interludeBands = [
    "Neon Parade",
    "Glass Anthem",
    "Night Echo",
    "Silver Circuit",
  ];

  const segments: RunOfShowSegment[] = [
    {
      type: "host_intro",
      title: "Host Welcome",
      commentary:
        show.host_intro ||
        `${host} walks to center stage and welcomes the world to ${show.show_name}, promising surprise moments and emotional speeches.`,
    },
  ];

  categories.forEach((cat: any, index: number) => {
    segments.push({
      type: "award",
      title: cat.name || `Award Category ${index + 1}`,
      presenter: `Presenter ${index + 1}`,
      commentary: `${host} introduces ${cat.name || "the next category"} and teases the presenter before opening the envelope live.`,
    });

    if (index < 4) {
      segments.push({
        type: "performance",
        title: `Interlude Performance ${index + 1}`,
        performer: interludeBands[index],
        songs: [`Interlude Song ${index + 1}`],
        commentary: `${interludeBands[index]} performs a single song while the stage rotates for the next award setup.`,
      });
    }
  });

  segments.push({
    type: "performance",
    title: "Grand Closing Performance",
    performer: "Headliner Collective",
    songs: ["Finale Song I", "Finale Song II", "Finale Song III"],
    commentary: `${host} closes the show with a three-song finale and thanks performers, presenters, and voters around the world.`,
  });

  return segments;
};



const AFTER_PARTY_OUTCOMES: AfterPartyOutcome[] = [
  {
    type: "event",
    title: "Secret Festival Invite",
    description: "A promoter from the VIP balcony slips you a private festival wristband.",
    impact: "Unlocks a random special event opportunity.",
  },
  {
    type: "action",
    title: "Collaborative Spark",
    description: "You jam backstage with another artist and create instant chemistry.",
    impact: "Unlocks a random high-value action or collaboration option.",
  },
  {
    type: "negative",
    title: "Afterparty Scandal",
    description: "A messy clip trends overnight and tabloids run wild.",
    impact: "Triggers a negative random consequence (reputation, energy, or stress hit).",
  },
];

const rollAfterPartyOutcome = (random: () => number = Math.random): AfterPartyOutcome => {
  const index = Math.floor(random() * AFTER_PARTY_OUTCOMES.length);
  return AFTER_PARTY_OUTCOMES[index] ?? AFTER_PARTY_OUTCOMES[0];
};

export function AwardCeremonyExperience({
  show,
  bandId,
  hasNomination,
  onAttendRedCarpet,
  onBookPerformance,
  isAttending,
  isBooking,
  currentGameYear,
}: AwardCeremonyExperienceProps) {
  const [currentPhase, setCurrentPhase] = useState<CeremonyPhase>("red_carpet");
  const [selectedOutfit, setSelectedOutfit] = useState<string | null>(null);
  const [showPerformanceDialog, setShowPerformanceDialog] = useState(false);
  const [redCarpetComplete, setRedCarpetComplete] = useState(false);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [afterPartyOutcome, setAfterPartyOutcome] = useState<AfterPartyOutcome | null>(null);
  const hasRolledAfterPartyRef = useRef(false);

  const lifetimeAwardActive = typeof currentGameYear === "number" ? currentGameYear % 4 === 0 : false;

  const runOfShow = useMemo(() => buildRunOfShow(show), [show]);
  const activeSegment = runOfShow[segmentIndex];
  const currentPhaseIndex = CEREMONY_PHASES.findIndex((phase) => phase.id === currentPhase);

  useEffect(() => {
    if (currentPhase !== "after_party" || hasRolledAfterPartyRef.current) return;
    const outcome = rollAfterPartyOutcome();
    setAfterPartyOutcome(outcome);
    hasRolledAfterPartyRef.current = true;
  }, [currentPhase]);

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-amber-500/5 to-yellow-500/5 border-amber-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            {CEREMONY_PHASES.map((phase, idx) => {
              const Icon = phase.icon;
              const isActive = phase.id === currentPhase;
              const isComplete = idx < currentPhaseIndex;
              return (
                <div key={phase.id} className="flex items-center">
                  <button
                    onClick={() => setCurrentPhase(phase.id)}
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
          <p className="text-sm text-center text-muted-foreground">
            {CEREMONY_PHASES[currentPhaseIndex]?.label} — Hosted by {show.host_name || defaultHost}
          </p>
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
                  onClick={() => {
                    setSelectedOutfit(outfit.id);
                    onAttendRedCarpet(outfit.id);
                    setRedCarpetComplete(true);
                    setTimeout(() => setCurrentPhase("opening"), 1000);
                  }}
                  disabled={isAttending}
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
            <Button onClick={() => setCurrentPhase("awards")}>Start Live Show</Button>
          </CardContent>
        </Card>
      )}

      {currentPhase === "awards" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" />Live Awards Timeline</CardTitle>
            <CardDescription>
              Winners are hidden until each segment plays out live.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={((segmentIndex + 1) / Math.max(runOfShow.length, 1)) * 100} />
            {activeSegment && (
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{activeSegment.title}</p>
                  <Badge variant="outline">{activeSegment.type.replace("_", " ")}</Badge>
                </div>
                {activeSegment.presenter && <p className="text-sm">Presenter: {activeSegment.presenter}</p>}
                {activeSegment.performer && <p className="text-sm">Performer: {activeSegment.performer}</p>}
                {activeSegment.songs && (
                  <p className="text-sm text-muted-foreground">Songs: {activeSegment.songs.join(" • ")}</p>
                )}
                <p className="text-sm text-muted-foreground">{activeSegment.commentary}</p>
              </div>
            )}

            {hasNomination && activeSegment?.type === "award" && (
              <Badge className="bg-amber-500">Your band is in contention for this moment.</Badge>
            )}

            <div className="flex gap-2">
              {bandId && (
                <Button variant="outline" onClick={() => setShowPerformanceDialog(true)}>
                  <Music className="h-4 w-4 mr-1" />Book Performance Slot
                </Button>
              )}
              <Button
                onClick={() => {
                  if (segmentIndex >= runOfShow.length - 1) {
                    setCurrentPhase("finale");
                    return;
                  }
                  setSegmentIndex((current) => current + 1);
                }}
              >
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
            <h3 className="text-2xl font-bold">Show Complete</h3>
            <p className="text-muted-foreground">Final results are now revealed after the live envelope moments.</p>
            <Button onClick={() => setCurrentPhase("after_party")}>Go to After Party</Button>
          </CardContent>
        </Card>
      )}


      {currentPhase === "after_party" && (
        <Card className="border-primary/25 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Masks className="h-4 w-4" /> Awards After Party
            </CardTitle>
            <CardDescription>
              Anything can happen here: unlocks, opportunities, or trouble.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lifetimeAwardActive && (
              <Badge className="bg-amber-500">Lifetime Achievement Year Bonus Active</Badge>
            )}
            {afterPartyOutcome ? (
              <div className="rounded-lg border bg-background p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{afterPartyOutcome.title}</p>
                  <Badge variant={afterPartyOutcome.type === "negative" ? "destructive" : "secondary"}>
                    {afterPartyOutcome.type}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{afterPartyOutcome.description}</p>
                <p className="text-sm">{afterPartyOutcome.impact}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Rolling your after party outcome...</p>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={showPerformanceDialog} onOpenChange={setShowPerformanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book Awards Performance</DialogTitle>
            <DialogDescription>Reserve one interlude or the 3-song grand closer set.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {PERFORMANCE_SLOTS.map((slot) => (
              <button
                key={slot.id}
                onClick={() => {
                  onBookPerformance(slot.label, slot.stage);
                  setShowPerformanceDialog(false);
                }}
                disabled={isBooking}
                className="w-full p-4 rounded-lg border text-left transition-all hover:border-primary/50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-amber-500" />
                    <div>
                      <p className="font-medium">{slot.label}</p>
                      <p className="text-sm text-muted-foreground">{slot.stage} stage</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: slot.prestige }, (_, i) => (
                      <Star key={i} className="h-3 w-3 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
