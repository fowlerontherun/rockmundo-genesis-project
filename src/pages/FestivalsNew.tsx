import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useGameData } from "@/hooks/useGameData";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { useFestivals } from "@/hooks/useFestivals";
import { 
  Music2, 
  Calendar,
  MapPin,
  Users,
  Ticket,
  Star,
  Award,
  Mic,
  Clock,
  DollarSign,
  Trophy,
  TrendingUp,
  Loader2
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const performanceSlots = [
  { value: "opening", label: "Opening Act (6:00 PM)" },
  { value: "early", label: "Early Evening (7:30 PM)" },
  { value: "prime", label: "Prime Time (9:00 PM)" },
  { value: "headliner", label: "Headliner (10:30 PM)" },
  { value: "closer", label: "Closing Act (12:00 AM)" },
];

const stages = [
  { value: "main", label: "Main Stage" },
  { value: "second", label: "Second Stage" },
  { value: "acoustic", label: "Acoustic Tent" },
  { value: "electronic", label: "Electronic Stage" },
];

type FestivalCardProps = {
  festival: any;
  band?: any;
  isRegistered: boolean;
  capacity: number;
  isFull: boolean;
  isApplying: boolean;
  activeAction: { type: "apply" | "withdraw" | "perform" | null; id: string | null };
  onApply: (festivalId: string, slot: string, stage: string) => Promise<void>;
  fetchFestivalLineup: (festivalId: string) => Promise<any>;
};

function FestivalCard({
  festival,
  band,
  isRegistered,
  capacity,
  isFull,
  isApplying,
  activeAction,
  onApply,
  fetchFestivalLineup,
}: FestivalCardProps) {
  const [selectedSlot, setSelectedSlot] = useState<string>("prime");
  const [selectedStage, setSelectedStage] = useState<string>("main");

  const { data: lineup = [], isLoading: lineupLoading } = useQuery({
    queryKey: ["festival-lineup", festival.id],
    queryFn: () => fetchFestivalLineup(festival.id),
    enabled: Boolean(festival.id),
  });

  const confirmedActs = lineup.filter(
    (participant: any) => ["confirmed", "performed"].includes(participant.status)
  );

  const stageCount = new Set(lineup.map((participant: any) => participant.stage)).size || 1;

  return (
    <Card key={festival.id}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-2xl">{festival.title}</CardTitle>
              {isFull && <Badge variant="destructive">Full</Badge>}
              {isRegistered && <Badge className="bg-success">Registered</Badge>}
            </div>
            <CardDescription>{festival.description}</CardDescription>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {festival.location}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(new Date(festival.start_date), "MMM d, yyyy")} -
                {" "}
                {format(new Date(festival.end_date), "MMM d, yyyy")}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDistanceToNow(new Date(festival.start_date), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Capacity */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Capacity</span>
            <span className="font-semibold">
              {festival.current_participants || 0} / {festival.max_participants || 100}
            </span>
          </div>
          <Progress value={capacity} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-muted">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Expected Crowd
            </div>
            <div className="text-lg font-semibold">{festival.max_participants?.toLocaleString() || 100}</div>
            <p className="text-xs text-muted-foreground">Spots across {stageCount} stage(s)</p>
          </div>
          <div className="p-3 rounded-lg bg-muted">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Payout Potential
            </div>
            <div className="text-lg font-semibold text-success">
              ${festival.rewards?.payment?.toLocaleString() || 5000}
            </div>
            <p className="text-xs text-muted-foreground">Projected artist compensation</p>
          </div>
          <div className="p-3 rounded-lg bg-muted">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Star className="h-4 w-4" />
              Reputation Gain
            </div>
            <div className="text-lg font-semibold text-primary">+{festival.rewards?.fame || 100} fame</div>
            <p className="text-xs text-muted-foreground">Boost to your band profile</p>
          </div>
        </div>

        <Separator />

        {/* Requirements & Rewards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Requirements
            </h3>
            <div className="space-y-1 text-sm">
              {festival.requirements?.min_fame && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Min Fame:</span>
                  <span>{festival.requirements.min_fame}</span>
                </div>
              )}
              {festival.requirements?.min_songs && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Min Songs:</span>
                  <span>{festival.requirements.min_songs}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Award className="h-4 w-4" />
              Rewards
            </h3>
            <div className="space-y-1 text-sm">
              {festival.rewards?.fame && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fame:</span>
                  <span className="text-primary">+{festival.rewards.fame}</span>
                </div>
              )}
              {festival.rewards?.payment && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment:</span>
                  <span className="text-success">${festival.rewards.payment?.toLocaleString()}</span>
                </div>
              )}
              {festival.rewards?.experience && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">XP:</span>
                  <span className="text-amber-500">+{festival.rewards.experience}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Confirmed Acts</h3>
          </div>
          {lineupLoading ? (
            <p className="text-sm text-muted-foreground">Loading lineup...</p>
          ) : confirmedActs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No acts have been confirmed yet.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {confirmedActs.map((participant: any) => (
                <div key={participant.id} className="p-3 rounded-lg border bg-card/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{participant.bands?.name || "Band"}</p>
                      <p className="text-xs text-muted-foreground">
                        {participant.bands?.genre || "Multi-genre"} • {participant.stage || "Stage"}
                      </p>
                    </div>
                    <Badge className="capitalize">{participant.performance_slot || "slot"}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Star className="h-3 w-3" /> Fame {participant.bands?.fame || 0}
                    <Separator orientation="vertical" className="h-4" />
                    <Clock className="h-3 w-3" /> {participant.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {!isRegistered && !isFull && band && (
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Ticket className="h-4 w-4 mr-2" />
                  Apply to Perform
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Apply to {festival.title}</DialogTitle>
                  <DialogDescription>Choose your performance slot and stage</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Performance Slot</Label>
                    <Select value={selectedSlot} onValueChange={setSelectedSlot}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {performanceSlots.map(slot => (
                          <SelectItem key={slot.value} value={slot.value}>
                            {slot.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Stage</Label>
                    <Select value={selectedStage} onValueChange={setSelectedStage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stages.map(stage => (
                          <SelectItem key={stage.value} value={stage.value}>
                            {stage.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Application Fee:</span>
                      <span className="font-semibold">$500</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Performance Payment:</span>
                      <span className="font-semibold text-success">$5,000</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => onApply(festival.id, selectedSlot, selectedStage)}
                    disabled={isApplying || (activeAction.type === "apply" && activeAction.id !== festival.id)}
                    className="w-full"
                  >
                    {isApplying && activeAction.id === festival.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                      </>
                    ) : (
                      "Submit Application"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {!band && (
            <div className="text-sm text-muted-foreground">
              You need to create or join a band to apply for festivals
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Festivals() {
  const { profile } = useGameData();
  const { data: bandData } = usePrimaryBand();
  const band = bandData?.bands;
  const userId = profile?.user_id;
  const { toast } = useToast();

  const { 
    festivals, 
    festivalsLoading,
    participations,
    participationsLoading,
    fetchFestivalLineup,
    applyToFestival,
    withdrawFromFestival,
    updateSetlist,
    performAtFestival,
    isApplying,
    isWithdrawing,
    isPerforming
  } = useFestivals(userId, band?.id);

  const [activeAction, setActiveAction] = useState<{ type: "apply" | "withdraw" | "perform" | null; id: string | null }>({
    type: null,
    id: null,
  });

  const handleApply = async (festivalId: string, performanceSlot: string, stage: string) => {
    if (!band) {
      toast({ title: "Band required", description: "Join or create a band before applying." });
      return;
    }

    setActiveAction({ type: "apply", id: festivalId });

    try {
      await applyToFestival.mutateAsync({
        festival_id: festivalId,
        band_id: band.id,
        performance_slot: performanceSlot,
        stage,
        setlist_songs: [],
        payment_amount: 5000,
      });
    } catch (error: any) {
      toast({
        title: "Application failed",
        description: error?.message ?? "Unable to submit this festival application.",
        variant: "destructive",
      });
    } finally {
      setActiveAction({ type: null, id: null });
    }
  };

  const handleWithdraw = async (participationId: string) => {
    setActiveAction({ type: "withdraw", id: participationId });
    try {
      await withdrawFromFestival.mutateAsync(participationId);
    } catch (error: any) {
      toast({
        title: "Unable to withdraw",
        description: error?.message ?? "Try again or refresh before withdrawing.",
        variant: "destructive",
      });
    } finally {
      setActiveAction({ type: null, id: null });
    }
  };

  const handlePerform = async (participationId: string) => {
    setActiveAction({ type: "perform", id: participationId });
    try {
      await performAtFestival.mutateAsync(participationId);
    } catch (error: any) {
      toast({
        title: "Performance failed",
        description: error?.message ?? "We couldn't start this set. Please try again.",
        variant: "destructive",
      });
    } finally {
      setActiveAction({ type: null, id: null });
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500",
      confirmed: "bg-blue-500",
      performed: "bg-success",
      withdrawn: "bg-destructive",
      cancelled: "bg-slate-500",
    };
    return <Badge className={colors[status] || "bg-slate-500"}>{status}</Badge>;
  };

  const calculateCapacity = (current: number, max: number) => {
    return Math.min((current / max) * 100, 100);
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Music2 className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-4xl font-bold">Festivals</h1>
            <p className="text-muted-foreground">
              Perform at major music festivals and gain exposure
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upcoming">
            <Calendar className="h-4 w-4 mr-2" />
            Upcoming Festivals
          </TabsTrigger>
          <TabsTrigger value="my-performances">
            <Mic className="h-4 w-4 mr-2" />
            My Performances ({participations.filter(p => p.status !== "withdrawn").length})
          </TabsTrigger>
          <TabsTrigger value="history">
            <Trophy className="h-4 w-4 mr-2" />
            Performance History
          </TabsTrigger>
        </TabsList>

        {/* Upcoming Festivals Tab */}
        <TabsContent value="upcoming" className="space-y-4">
          {festivalsLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading festivals...</div>
          ) : festivals.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                No upcoming festivals available.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {festivals.map((festival) => {
                const isRegistered = participations.some(
                  p => p.festival_id === festival.id && p.status !== "withdrawn"
                );
                const capacity = calculateCapacity(
                  festival.current_participants || 0,
                  festival.max_participants || 100
                );
                const isFull = capacity >= 100;

                return (
                  <FestivalCard
                    key={festival.id}
                    festival={festival}
                    band={band}
                    isRegistered={isRegistered}
                    capacity={capacity}
                    isFull={isFull}
                    isApplying={isApplying}
                    activeAction={activeAction}
                    onApply={handleApply}
                    fetchFestivalLineup={fetchFestivalLineup}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* My Performances Tab */}
        <TabsContent value="my-performances" className="space-y-4">
          {participationsLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading performances...</div>
          ) : participations.filter(p => p.status !== "withdrawn").length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Mic className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">You haven't registered for any festivals yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {participations
                .filter(p => p.status !== "withdrawn" && p.status !== "performed")
                .map((participation) => (
                  <Card key={participation.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>{(participation as any).festivals?.title || "Festival"}</CardTitle>
                          <CardDescription>
                            {format(new Date((participation as any).festivals?.start_date || new Date()), "MMM d, yyyy")}
                            {" • "}
                            {performanceSlots.find(s => s.value === participation.performance_slot)?.label || participation.performance_slot}
                            {" • "}
                            {stages.find(s => s.value === participation.stage)?.label || participation.stage}
                          </CardDescription>
                        </div>
                        {getStatusBadge(participation.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Location</div>
                          <div className="font-medium">{(participation as any).festivals?.location || "TBA"}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Payment</div>
                          <div className="font-medium text-success">${participation.payment_amount?.toLocaleString()}</div>
                        </div>
                      </div>

                      <Separator />

                      <div className="flex gap-2">
                        {participation.status === "confirmed" && (
                          <Button
                            onClick={() => handlePerform(participation.id)}
                            disabled={
                              isPerforming ||
                              (activeAction.type === "perform" && activeAction.id === participation.id)
                            }
                          >
                            {isPerforming && activeAction.id === participation.id ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting...
                              </>
                            ) : (
                              <>
                                <Mic className="h-4 w-4 mr-2" />
                                Perform Now
                              </>
                            )}
                          </Button>
                        )}
                        
                        {(participation.status === "pending" || participation.status === "confirmed") && (
                          <Button
                            variant="destructive"
                            onClick={() => handleWithdraw(participation.id)}
                            disabled={
                              isWithdrawing ||
                              (activeAction.type === "withdraw" && activeAction.id === participation.id)
                            }
                          >
                            {isWithdrawing && activeAction.id === participation.id ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Withdrawing...
                              </>
                            ) : (
                              "Withdraw"
                            )}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        {/* Performance History Tab */}
        <TabsContent value="history" className="space-y-4">
          {participations.filter(p => p.status === "performed").length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Trophy className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No performance history yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {participations
                .filter(p => p.status === "performed")
                .map((participation) => (
                  <Card key={participation.id} className="border-success/20">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>{(participation as any).festivals?.title || "Festival"}</CardTitle>
                          <CardDescription>
                            {format(new Date((participation as any).festivals?.start_date || new Date()), "MMM d, yyyy")}
                          </CardDescription>
                        </div>
                        <Badge className="bg-success">Performed</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-muted rounded-lg">
                          <Star className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                          <div className="text-2xl font-bold">{participation.performance_score || 0}</div>
                          <div className="text-sm text-muted-foreground">Performance Score</div>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                          <DollarSign className="h-8 w-8 mx-auto mb-2 text-success" />
                          <div className="text-2xl font-bold">${participation.payment_amount?.toLocaleString()}</div>
                          <div className="text-sm text-muted-foreground">Earned</div>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                          <TrendingUp className="h-8 w-8 mx-auto mb-2 text-primary" />
                          <div className="text-2xl font-bold">+100</div>
                          <div className="text-sm text-muted-foreground">Fame Gained</div>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                          <Users className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                          <div className="text-2xl font-bold">+500</div>
                          <div className="text-sm text-muted-foreground">New Fans</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
