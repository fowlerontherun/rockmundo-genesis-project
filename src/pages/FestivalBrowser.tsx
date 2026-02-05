import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
  DollarSign, Trophy, CheckCircle, XCircle, Loader2, Mail, History, Map
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
        return <Badge variant="secondary">Pending</Badge>;
      case "confirmed":
      case "invited":
        return <Badge className="bg-green-500">Confirmed</Badge>;
      case "performed":
        return <Badge className="bg-blue-500">Performed</Badge>;
      case "withdrawn":
        return <Badge variant="destructive">Withdrawn</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Festivals</h1>
          <p className="text-muted-foreground">
            Apply to perform at festivals and grow your fanbase
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Festivals</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{festivals.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Applications</CardTitle>
            <Music className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{participations.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmed Slots</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {participations.filter((p) => p.status === "confirmed" || p.status === "invited").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performances</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {participations.filter((p) => p.status === "performed").length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full max-w-2xl grid-cols-5">
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="map" className="flex items-center gap-1">
            <Map className="h-4 w-4" />
            <span className="hidden sm:inline">Map</span>
          </TabsTrigger>
          <TabsTrigger value="my-festivals">My Festivals</TabsTrigger>
          <TabsTrigger value="offers" className="flex items-center gap-1">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Offers</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
          </TabsTrigger>
        </TabsList>

        {/* Browse Tab */}
        <TabsContent value="browse" className="mt-6">
          {festivalsLoading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Loading festivals...</p>
              </CardContent>
            </Card>
          ) : festivals.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No upcoming festivals at the moment</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {festivals.map((festival) => {
                const participation = getParticipationStatus(festival.id);
                const isUpcoming = isFuture(new Date(festival.start_date));

                return (
                  <Card key={festival.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{festival.title}</CardTitle>
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {festival.location}
                          </CardDescription>
                        </div>
                        {participation && getStatusBadge(participation.status)}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {festival.description}
                      </p>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {format(new Date(festival.start_date), "MMM d")} -{" "}
                            {format(new Date(festival.end_date), "MMM d")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {festival.current_participants}/{festival.max_participants}
                          </span>
                        </div>
                      </div>

                      {isUpcoming && (
                        <p className="text-xs text-muted-foreground">
                          Starts {formatDistanceToNow(new Date(festival.start_date), { addSuffix: true })}
                        </p>
                      )}

                      <div className="flex gap-2">
                        {!participation && band && (
                          <Button
                            className="flex-1"
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
                            className="flex-1"
                            onClick={() => withdrawFromFestival.mutate(participation.id)}
                            disabled={isWithdrawing}
                          >
                            Withdraw
                          </Button>
                        )}
                        {participation && (participation.status === "confirmed" || participation.status === "invited") && (
                          <Button
                            className="flex-1"
                            onClick={() => performAtFestival.mutate(participation.id)}
                            disabled={isPerforming || isUpcoming}
                          >
                            {isUpcoming ? "Waiting..." : "Perform"}
                          </Button>
                        )}
                        {!band && (
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => navigate("/band")}
                          >
                            Join a Band First
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Map Tab */}
        <TabsContent value="map" className="mt-6">
          <FestivalMapView 
            festivals={festivals} 
            onApply={(festival) => {
              setSelectedFestival(festival);
              setShowApplyDialog(true);
            }}
          />
        </TabsContent>

        {/* My Festivals Tab */}
        <TabsContent value="my-festivals" className="mt-6">
          {participationsLoading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              </CardContent>
            </Card>
          ) : participations.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>You haven't applied to any festivals yet</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setActiveTab("browse")}
                >
                  Browse Festivals
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {participations.map((participation: any) => (
                <Card key={participation.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="font-semibold">
                          {participation.festivals?.title || "Festival"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Slot: {participation.slot_type}
                        </p>
                        {participation.payout_amount > 0 && (
                          <p className="text-sm flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            ${participation.payout_amount.toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(participation.status)}
                        {participation.status === "pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => withdrawFromFestival.mutate(participation.id)}
                            disabled={isWithdrawing}
                          >
                            Withdraw
                          </Button>
                        )}
                        {(participation.status === "confirmed" || participation.status === "invited") && (
                          <Button
                            size="sm"
                            onClick={() => performAtFestival.mutate(participation.id)}
                            disabled={isPerforming}
                          >
                            Perform Now
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Offers Tab */}
        <TabsContent value="offers" className="mt-6">
          {band ? (
            <FestivalSlotOffers bandId={band.id} />
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Join a band to receive festival offers</p>
                <Button
                  variant="outline"
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
        <TabsContent value="history" className="mt-6">
          {historyLoading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              </CardContent>
            </Card>
          ) : performances.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No performance history yet</p>
                <p className="text-sm mt-2">Perform at festivals to build your track record!</p>
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
