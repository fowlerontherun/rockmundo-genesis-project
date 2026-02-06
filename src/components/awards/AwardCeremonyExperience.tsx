import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { 
  Trophy, Star, Sparkles, Camera, Music, 
  PartyPopper, Crown, Users, Mic, Award 
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AwardShow } from "@/hooks/useAwards";

interface AwardCeremonyExperienceProps {
  show: AwardShow;
  bandName?: string;
  bandId?: string;
  hasNomination: boolean;
  onAttendRedCarpet: (outfitChoice: string) => void;
  onBookPerformance: (slotLabel: string, stage: string) => void;
  isAttending?: boolean;
  isBooking?: boolean;
}

type CeremonyPhase = "red_carpet" | "opening" | "categories" | "performance" | "finale";

const CEREMONY_PHASES: { id: CeremonyPhase; label: string; icon: React.ElementType }[] = [
  { id: "red_carpet", label: "Red Carpet", icon: Camera },
  { id: "opening", label: "Opening", icon: Sparkles },
  { id: "categories", label: "Awards", icon: Trophy },
  { id: "performance", label: "Performance", icon: Music },
  { id: "finale", label: "Finale", icon: PartyPopper },
];

const OUTFIT_OPTIONS = [
  { id: "casual", label: "Casual Rockstar", fame: 15, description: "Leather jacket and jeans" },
  { id: "standard", label: "Smart Formal", fame: 25, description: "Classic suit or dress" },
  { id: "designer", label: "Designer Outfit", fame: 50, description: "Head-to-toe designer wear" },
  { id: "custom", label: "Custom Couture", fame: 75, description: "One-of-a-kind statement piece" },
  { id: "outrageous", label: "Outrageous Statement", fame: 100, description: "Meat dress level bold" },
];

const PERFORMANCE_SLOTS = [
  { id: "opener", label: "Opening Act", stage: "main", prestige: 1 },
  { id: "mid_show", label: "Mid-Show Performance", stage: "main", prestige: 2 },
  { id: "tribute", label: "Tribute Performance", stage: "main", prestige: 3 },
  { id: "closer", label: "Closing Act", stage: "main", prestige: 4 },
];

export function AwardCeremonyExperience({
  show,
  bandName,
  bandId,
  hasNomination,
  onAttendRedCarpet,
  onBookPerformance,
  isAttending,
  isBooking,
}: AwardCeremonyExperienceProps) {
  const [currentPhase, setCurrentPhase] = useState<CeremonyPhase>("red_carpet");
  const [selectedOutfit, setSelectedOutfit] = useState<string | null>(null);
  const [showPerformanceDialog, setShowPerformanceDialog] = useState(false);
  const [redCarpetComplete, setRedCarpetComplete] = useState(false);

  const handleOutfitSelect = (outfitId: string) => {
    setSelectedOutfit(outfitId);
    onAttendRedCarpet(outfitId);
    setRedCarpetComplete(true);
    // Auto advance after a moment
    setTimeout(() => setCurrentPhase("opening"), 1500);
  };

  const currentPhaseIndex = CEREMONY_PHASES.findIndex(p => p.id === currentPhase);

  return (
    <div className="space-y-4">
      {/* Ceremony Progress */}
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
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer",
                      isActive && "bg-amber-500 text-white scale-110 shadow-lg",
                      isComplete && "bg-amber-500/30 text-amber-400",
                      !isActive && !isComplete && "bg-muted text-muted-foreground hover:bg-muted/80"
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
            {CEREMONY_PHASES[currentPhaseIndex]?.label} — {show.show_name}
          </p>
        </CardContent>
      </Card>

      {/* Red Carpet Phase */}
      {currentPhase === "red_carpet" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-amber-500" />
              Red Carpet Arrival
            </CardTitle>
            <CardDescription>
              Choose your outfit for the red carpet. Bolder choices earn more fame but carry higher risk.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {redCarpetComplete ? (
              <div className="text-center py-6">
                <Sparkles className="h-12 w-12 mx-auto mb-3 text-amber-500 animate-pulse" />
                <p className="font-semibold text-lg">You're making an entrance!</p>
                <p className="text-sm text-muted-foreground">Cameras are flashing, fans are cheering...</p>
              </div>
            ) : (
              OUTFIT_OPTIONS.map((outfit) => (
                <button
                  key={outfit.id}
                  onClick={() => handleOutfitSelect(outfit.id)}
                  disabled={isAttending}
                  className={cn(
                    "w-full p-4 rounded-lg border text-left transition-all hover:border-amber-500/50 hover:bg-amber-500/5",
                    selectedOutfit === outfit.id && "border-amber-500 bg-amber-500/10"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{outfit.label}</p>
                      <p className="text-sm text-muted-foreground">{outfit.description}</p>
                    </div>
                    <Badge variant="secondary" className="text-amber-500">
                      +{outfit.fame} fame
                    </Badge>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Opening Phase */}
      {currentPhase === "opening" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Opening Ceremony
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center py-6 space-y-4">
            <Award className="h-16 w-16 mx-auto text-amber-500" />
            <p className="text-lg font-medium">Welcome to the {show.show_name}!</p>
            <p className="text-muted-foreground">
              The lights dim, the host takes the stage. {show.prestige_level >= 4 ? 
                "This is one of the most prestigious nights in music." : 
                "The anticipation is electric."}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {(show.broadcast_partners || []).map((partner, i) => (
                <Badge key={i} variant="outline">{partner}</Badge>
              ))}
            </div>
            <Button onClick={() => setCurrentPhase("categories")} className="mt-4">
              Watch the Awards
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Categories Phase */}
      {currentPhase === "categories" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Award Categories
            </CardTitle>
            <CardDescription>
              {hasNomination ? "You're nominated! Watch as the categories are announced." : "Watch the categories unfold."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {((show.categories as any[]) || []).map((cat: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Trophy className="h-4 w-4 text-amber-500" />
                  </div>
                  <span className="font-medium">{cat.name}</span>
                </div>
                {hasNomination && (
                  <Badge variant="secondary" className="text-amber-500">Nominated!</Badge>
                )}
              </div>
            ))}
            <div className="flex gap-2 mt-4">
              {bandId && (
                <Button variant="outline" onClick={() => setShowPerformanceDialog(true)} className="flex-1">
                  <Music className="h-4 w-4 mr-2" />
                  Book Performance
                </Button>
              )}
              <Button onClick={() => setCurrentPhase("finale")} className="flex-1">
                Skip to Finale
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Phase */}
      {currentPhase === "performance" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5 text-amber-500" />
              Live Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center py-6 space-y-4">
            <Mic className="h-16 w-16 mx-auto text-amber-500 animate-pulse" />
            <p className="text-lg font-medium">Your moment on the biggest stage!</p>
            <p className="text-muted-foreground">
              Performing at {show.show_name} boosts your fame significantly.
            </p>
            <Button onClick={() => setCurrentPhase("finale")}>
              Continue to Finale
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Finale Phase */}
      {currentPhase === "finale" && (
        <Card className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border-amber-500/30">
          <CardContent className="text-center py-8 space-y-4">
            <PartyPopper className="h-16 w-16 mx-auto text-amber-500" />
            <h3 className="text-2xl font-bold">Ceremony Complete!</h3>
            <p className="text-muted-foreground">
              The {show.show_name} has concluded. Check the results!
            </p>
            <div className="flex justify-center gap-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Attendance Fame</p>
                <p className="text-xl font-bold text-amber-500">+{show.attendance_fame_boost}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Winner Prize</p>
                <p className="text-xl font-bold text-green-500">${show.winner_prize_money.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Booking Dialog */}
      <Dialog open={showPerformanceDialog} onOpenChange={setShowPerformanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book a Performance Slot</DialogTitle>
            <DialogDescription>
              Perform live at {show.show_name} for fame and exposure
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {PERFORMANCE_SLOTS.map((slot) => (
              <button
                key={slot.id}
                onClick={() => {
                  onBookPerformance(slot.label, slot.stage);
                  setShowPerformanceDialog(false);
                  setCurrentPhase("performance");
                }}
                disabled={isBooking}
                className="w-full p-4 rounded-lg border text-left transition-all hover:border-primary/50 hover:bg-primary/5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{slot.label}</p>
                    <p className="text-sm text-muted-foreground">{slot.stage} stage</p>
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
