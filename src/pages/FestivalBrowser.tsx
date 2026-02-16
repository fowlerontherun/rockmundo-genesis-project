import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useFestivals, Festival, FestivalParticipant } from "@/hooks/useFestivals";
import { useFestivalHistory } from "@/hooks/useFestivalHistory";
import { useAuth } from "@/hooks/use-auth-context";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { useSetlists } from "@/hooks/useSetlists";
import { FestivalSlotOffers } from "@/components/festivals/FestivalSlotOffers";
import { FestivalHistoryCard } from "@/components/festivals/history/FestivalHistoryCard";
import { FestivalHistoryStats } from "@/components/festivals/history/FestivalHistoryStats";
import { FestivalMapView } from "@/components/festivals/discovery/FestivalMapView";
import { 
  Calendar, MapPin, Users, Music, Star, Clock, 
  DollarSign, Trophy, CheckCircle, XCircle, Loader2, Mail, History, Map,
  Ticket, ChevronRight, Flame, Eye
} from "lucide-react";
import { format, formatDistanceToNow, isPast, isFuture } from "date-fns";

const SLOT_TYPES = [
  { id: "opening", label: "Opening Act", fame: 0, payout: 500 },
  { id: "support", label: "Support Act", fame: 500, payout: 1500 },
  { id: "main", label: "Main Stage", fame: 2000, payout: 5000 },
  { id: "headline", label: "Headline", fame: 5000, payout: 15000 },
];

export default function FestivalBrowser() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: primaryBandRecord } = usePrimaryBand();
  const band = primaryBandRecord?.bands;
  
  const { 
    festivals, 
    festivalsLoading, 
    participations, 
    participationsLoading,
    applyToFestival,
    withdrawFromFestival,
    performAtFestival,
    isApplying,
    isWithdrawing,
    isPerforming
  } = useFestivals(user?.id, band?.id);
  
  const { data: setlists } = useSetlists(band?.id);
  const { performances, stats, isLoading: historyLoading } = useFestivalHistory(band?.id);

  const [activeTab, setActiveTab] = useState<"browse" | "map" | "my-festivals" | "offers" | "history">("browse");
  const [selectedFestival, setSelectedFestival] = useState<Festival | null>(null);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [selectedSetlist, setSelectedSetlist] = useState("");

  const getParticipationStatus = (festivalId: string) => {
    return participations.find((p) => p.event_id === festivalId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="text-xs">Pending</Badge>;
      case "confirmed":
      case "invited":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs">✓ Confirmed</Badge>;
      case "performed":
        return <Badge className="bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs">Performed</Badge>;
      case "withdrawn":
        return <Badge variant="destructive" className="text-xs">Withdrawn</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="text-xs">Rejected</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const handleApply = async () => {
    if (!selectedFestival || !band || !selectedSlot) return;

    await applyToFestival.mutateAsync({
      festival_id: selectedFestival.id,
      band_id: band.id,
      performance_slot: selectedSlot,
      stage: "main",
      setlist_songs: selectedSetlist ? [selectedSetlist] : [],
    });

    setShowApplyDialog(false);
    setSelectedFestival(null);
    setSelectedSlot("");
    setSelectedSetlist("");
  };

  const availableSlots = SLOT_TYPES.filter(
    (slot) => (band?.fame || 0) >= slot.fame
  );

  const confirmedCount = participations.filter((p) => p.status === "confirmed" || p.status === "invited").length;
  const performedCount = participations.filter((p) => p.status === "performed").length;

  return (
    <div className="container mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Music className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Festivals</h1>
          <p className="text-sm text-muted-foreground">Perform, explore & grow your fanbase</p>
        </div>
      </div>

      {/* Compact Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Upcoming", value: festivals.length, icon: Calendar, color: "text-primary" },
          { label: "Applications", value: participations.length, icon: Music, color: "text-amber-400" },
          { label: "Confirmed", value: confirmedCount, icon: CheckCircle, color: "text-emerald-400" },
          { label: "Performed", value: performedCount, icon: Trophy, color: "text-sky-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-card/50 border-border/50">
            <CardContent className="p-3 flex items-center gap-3">
              <Icon className={`h-4 w-4 ${color} shrink-0`} />
              <div>
                <p className="text-lg font-bold leading-none">{value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="w-full max-w-xl grid grid-cols-5 h-9">
          <TabsTrigger value="browse" className="text-xs gap-1">
            <Eye className="h-3 w-3 hidden sm:block" /> Browse
          </TabsTrigger>
          <TabsTrigger value="map" className="text-xs gap-1">
            <Map className="h-3 w-3" />
            <span className="hidden sm:inline">Map</span>
          </TabsTrigger>
          <TabsTrigger value="my-festivals" className="text-xs">My Fests</TabsTrigger>
          <TabsTrigger value="offers" className="text-xs gap-1">
            <Mail className="h-3 w-3" />
            <span className="hidden sm:inline">Offers</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs gap-1">
            <History className="h-3 w-3" />
            <span className="hidden sm:inline">History</span>
          </TabsTrigger>
        </TabsList>

        {/* Browse Tab */}
        <TabsContent value="browse" className="mt-4">
          {festivalsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : festivals.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No upcoming festivals</p>
                <p className="text-sm mt-1">Check back later for new events</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {festivals.map((festival) => {
                const participation = getParticipationStatus(festival.id);
                const isUpcoming = isFuture(new Date(festival.start_date));
                const daysAway = isUpcoming
                  ? Math.ceil((new Date(festival.start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : 0;

                return (
                  <Card 
                    key={festival.id} 
                    className="group hover:border-primary/40 transition-all duration-200 cursor-pointer overflow-hidden"
                    onClick={() => navigate(`/festivals/${festival.id}`)}
                  >
                    {/* Poster header or gradient */}
                    {(festival as any).poster_url ? (
                      <div className="h-32 overflow-hidden">
                        <img 
                          src={(festival as any).poster_url} 
                          alt={festival.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div className="h-20 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent flex items-end px-4 pb-2">
                        <Music className="h-6 w-6 text-primary/40" />
                      </div>
                    )}

                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                            {festival.title}
                          </h3>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{festival.location}</span>
                          </p>
                        </div>
                        {participation && getStatusBadge(participation.status)}
                      </div>

                      {festival.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {festival.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(festival.start_date), "MMM d")} – {format(new Date(festival.end_date), "MMM d")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {festival.current_participants}/{festival.max_participants}
                        </span>
                      </div>

                      {isUpcoming && daysAway <= 14 && (
                        <div className="flex items-center gap-1.5">
                          <Flame className="h-3 w-3 text-amber-400" />
                          <span className="text-[11px] text-amber-400 font-medium">
                            {daysAway === 0 ? "Starts today!" : daysAway === 1 ? "Starts tomorrow" : `${daysAway} days away`}
                          </span>
                        </div>
                      )}

                      <Separator className="opacity-50" />

                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        {!participation && band && (
                          <Button
                            size="sm"
                            className="flex-1 h-8 text-xs"
                            onClick={() => {
                              setSelectedFestival(festival);
                              setShowApplyDialog(true);
                            }}
                            disabled={!isUpcoming || festival.current_participants >= festival.max_participants}
                          >
                            Apply to Perform
                          </Button>
                        )}
                        {participation && participation.status === "pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8 text-xs"
                            onClick={() => withdrawFromFestival.mutate(participation.id)}
                            disabled={isWithdrawing}
                          >
                            Withdraw
                          </Button>
                        )}
                        {participation && (participation.status === "confirmed" || participation.status === "invited") && (
                          <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 text-xs flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Scheduled
                          </Badge>
                        )}
                        {!band && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8 text-xs"
                            onClick={() => navigate("/band")}
                          >
                            Join a Band First
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 shrink-0"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Map Tab */}
        <TabsContent value="map" className="mt-4">
          <FestivalMapView 
            festivals={festivals} 
            onApply={(festival) => {
              setSelectedFestival(festival);
              setShowApplyDialog(true);
            }}
          />
        </TabsContent>

        {/* My Festivals Tab */}
        <TabsContent value="my-festivals" className="mt-4">
          {participationsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : participations.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center text-muted-foreground">
                <Music className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No festival applications yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setActiveTab("browse")}
                >
                  Browse Festivals
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {participations.map((participation: any) => {
                const festTitle = participation.festivals?.title || "Festival";
                return (
                  <Card 
                    key={participation.id}
                    className="hover:border-primary/40 transition-colors cursor-pointer"
                    onClick={() => {
                      if (participation.event_id) navigate(`/festivals/${participation.event_id}`);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Ticket className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm truncate">{festTitle}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground capitalize">{participation.slot_type}</span>
                              {participation.payout_amount > 0 && (
                                <span className="text-xs text-emerald-400 flex items-center gap-0.5">
                                  <DollarSign className="h-3 w-3" />
                                  {participation.payout_amount.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {getStatusBadge(participation.status)}
                          {participation.status === "pending" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                withdrawFromFestival.mutate(participation.id);
                              }}
                              disabled={isWithdrawing}
                            >
                              Withdraw
                            </Button>
                          )}
                          {(participation.status === "confirmed" || participation.status === "invited") && (
                            <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-1 text-[10px] flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              Scheduled
                            </Badge>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Offers Tab */}
        <TabsContent value="offers" className="mt-4">
          {band ? (
            <FestivalSlotOffers bandId={band.id} />
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center text-muted-foreground">
                <Music className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Join a band to receive festival offers</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => navigate("/band")}
                >
                  Find a Band
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          {historyLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : performances.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center text-muted-foreground">
                <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No performance history yet</p>
                <p className="text-sm mt-1">Perform at festivals to build your track record!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <FestivalHistoryStats stats={stats} />
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Past Performances</h3>
                {performances.map((performance) => (
                  <FestivalHistoryCard key={performance.id} performance={performance} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Apply Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply to {selectedFestival?.title}</DialogTitle>
            <DialogDescription>
              Select your preferred performance slot and setlist
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Performance Slot</Label>
              <Select value={selectedSlot} onValueChange={setSelectedSlot}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a slot" />
                </SelectTrigger>
                <SelectContent>
                  {availableSlots.map((slot) => (
                    <SelectItem key={slot.id} value={slot.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{slot.label}</span>
                        <span className="text-xs text-muted-foreground ml-4">
                          ~${slot.payout.toLocaleString()}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableSlots.length < SLOT_TYPES.length && (
                <p className="text-xs text-muted-foreground">
                  Some slots require more fame to unlock
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Setlist (Optional)</Label>
              <Select value={selectedSetlist} onValueChange={setSelectedSetlist}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a setlist" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No setlist</SelectItem>
                  {setlists?.map((setlist: any) => (
                    <SelectItem key={setlist.id} value={setlist.id}>
                      {setlist.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleApply} 
              disabled={!selectedSlot || isApplying}
            >
              {isApplying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                "Submit Application"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
