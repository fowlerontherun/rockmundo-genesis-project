import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Music, Users, Gift, Volume2, Star, Zap, Sparkles } from "lucide-react";
import { useFestivalStages, useFestivalStageSlots, FestivalStage, FestivalStageSlot } from "@/hooks/useFestivalStages";
import { useFestivalAttendance } from "@/hooks/useFestivalAttendance";
import { useFestivalTickets } from "@/hooks/useFestivalTickets";
import { useClaimWatchReward } from "@/hooks/useFestivalWatchRewards";
import { FestivalVoiceChat } from "./FestivalVoiceChat";
import { FestivalStageCommentary } from "./FestivalStageCommentary";
import { useAuth } from "@/hooks/use-auth-context";
import { toast } from "sonner";

interface LiveFestivalViewProps {
  festivalId: string;
  onBack: () => void;
}

export const LiveFestivalView = ({ festivalId, onBack }: LiveFestivalViewProps) => {
  const { user } = useAuth();
  const { data: stages = [] } = useFestivalStages(festivalId);
  const { data: allSlots = [] } = useFestivalStageSlots(festivalId);
  const { hasTicket } = useFestivalTickets(festivalId);
  const {
    attendance,
    stageAttendees,
    joinFestival,
    moveToStage,
    leaveFestival,
    isAtFestival,
    currentStageId,
  } = useFestivalAttendance(festivalId);
  const claimReward = useClaimWatchReward();

  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const activeStageId = selectedStageId || currentStageId || stages[0]?.id;

  const currentStage = stages.find((s) => s.id === activeStageId);
  const stageSlots = useMemo(
    () => allSlots.filter((s) => s.stage_id === activeStageId),
    [allSlots, activeStageId]
  );

  // Get current performing slot (simplified: first booked slot)
  const currentSlot = stageSlots.find((s) => s.status === "booked" || s.status === "performing");

  const getAttendeesForStage = (stageId: string) =>
    stageAttendees.find((a) => a.current_stage_id === stageId)?.count || 0;

  const handleJoinFestival = () => {
    if (!activeStageId) return;
    joinFestival.mutate({ festivalId, stageId: activeStageId });
  };

  const handleMoveToStage = (stageId: string) => {
    setSelectedStageId(stageId);
    if (isAtFestival) {
      moveToStage.mutate(stageId);
    }
  };

  const handleClaimReward = (slot: FestivalStageSlot) => {
    if (!slot.band_id && !slot.is_npc_dj) return;
    claimReward.mutate({
      festivalId,
      bandId: slot.band_id || "npc",
      stageSlotId: slot.id,
    });
  };

  if (!hasTicket) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Music className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-lg font-semibold">No Ticket</p>
          <p className="text-sm text-muted-foreground mb-4">
            You need a ticket to enter this festival.
          </p>
          <Button variant="outline" onClick={onBack}>Go Back & Buy Ticket</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold">Live Festival</h2>
            <p className="text-sm text-muted-foreground">
              {stages.length} stages • {stageAttendees.reduce((s, a) => s + a.count, 0)} people here
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isAtFestival ? (
            <Button onClick={handleJoinFestival} className="gap-2">
              <Zap className="h-4 w-4" /> Join Festival
            </Button>
          ) : (
            <Button variant="destructive" size="sm" onClick={() => leaveFestival.mutate()}>
              Leave Festival
            </Button>
          )}
          <Badge variant="default" className="animate-pulse">🔴 LIVE</Badge>
        </div>
      </div>

      {/* Stage selector tabs */}
      <div className="flex gap-2 flex-wrap">
        {stages.map((stage) => (
          <Button
            key={stage.id}
            variant={activeStageId === stage.id ? "default" : "outline"}
            size="sm"
            onClick={() => handleMoveToStage(stage.id)}
            className="gap-2"
          >
            <Music className="h-3 w-3" />
            {stage.stage_name}
            <Badge variant="secondary" className="ml-1 text-xs">
              <Users className="h-3 w-3 mr-1" />
              {getAttendeesForStage(stage.id)}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Stage view */}
        <div className="space-y-4">
          {/* Current performance card */}
          <Card className="border-primary/30 bg-gradient-to-b from-primary/5 to-background">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  {currentStage?.stage_name || "Main Stage"}
                  {currentStage?.genre_focus && (
                    <Badge variant="outline" className="text-xs">{currentStage.genre_focus}</Badge>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {currentSlot ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-bold">
                        {currentSlot.is_npc_dj
                          ? currentSlot.npc_dj_name || "NPC DJ"
                          : currentSlot.band?.name || "TBA"}
                      </p>
                      <Badge className="text-xs capitalize">
                        {currentSlot.slot_type === "dj_session" ? "DJ Set" : currentSlot.slot_type}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      disabled={claimReward.isPending}
                      onClick={() => handleClaimReward(currentSlot)}
                    >
                      <Gift className="h-4 w-4" />
                      Claim Reward
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No performance right now. Check the schedule below!</p>
              )}
            </CardContent>
          </Card>

          {/* Live commentary */}
          <FestivalStageCommentary slot={currentSlot} stageName={currentStage?.stage_name || "Stage"} />

          {/* Stage schedule */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Stage Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {stageSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className={`flex items-center gap-3 p-2 rounded-lg text-sm ${
                        slot.id === currentSlot?.id ? "bg-primary/10 border border-primary/30" : "bg-muted/30"
                      }`}
                    >
                      <Badge variant={slot.slot_type === "headliner" ? "default" : "secondary"} className="text-xs capitalize w-20 justify-center">
                        {slot.slot_type === "dj_session" ? "DJ" : slot.slot_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">Day {slot.day_number}</span>
                      <span className="font-medium flex-1">
                        {slot.is_npc_dj ? slot.npc_dj_name || "NPC DJ" : slot.band?.name || "TBA"}
                      </span>
                      {slot.id === currentSlot?.id && (
                        <Badge variant="default" className="text-xs animate-pulse">NOW</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: voice chat */}
        <div className="space-y-4">
          {activeStageId && (
            <FestivalVoiceChat festivalId={festivalId} stageId={activeStageId} />
          )}
        </div>
      </div>
    </div>
  );
};
