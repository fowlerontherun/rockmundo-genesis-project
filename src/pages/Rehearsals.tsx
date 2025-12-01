import { useState } from "react";
import { useGameData } from "@/hooks/useGameData";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar, Music2, DollarSign, Plus, Clock, CalendarPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { RehearsalBookingDialog } from "@/components/performance/RehearsalBookingDialog";
import { useToast } from "@/hooks/use-toast";
import { useRehearsalBooking } from "@/hooks/useRehearsalBooking";

interface Rehearsal {
  id: string;
  band_id: string;
  scheduled_start: string;
  scheduled_end: string;
  duration_hours: number;
  total_cost: number;
  status: string;
  chemistry_gain: number | null;
  familiarity_gained: number | null;
  xp_earned: number | null;
  selected_song_id: string | null;
  rehearsal_rooms?: {
    name: string;
    location: string;
    hourly_rate: number;
  } | null;
  songs?: {
    title: string;
  } | null;
  bands?: {
    name: string;
  } | null;
}

const Rehearsals = () => {
  const { profile } = useGameData();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { bookRehearsal, isBooking } = useRehearsalBooking();
  const [activeTab, setActiveTab] = useState<"upcoming" | "completed">("upcoming");
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [selectedBand, setSelectedBand] = useState<any>(null);

  // Fetch all user's bands
  const { data: userBands = [], isLoading: isLoadingBands, error: bandsError } = useQuery({
    queryKey: ["user-bands", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      
      console.log('[Rehearsals] Fetching bands for user:', profile.id);
      
      const { data, error } = await supabase
        .from("band_members")
        .select(`
          band_id,
          bands (
            id,
            name,
            band_balance,
            chemistry_level
          )
        `)
        .eq("user_id", profile.id);
      
      if (error) {
        console.error('[Rehearsals] Error fetching user bands:', error);
        throw error;
      }
      
      const bands = data?.map(d => d.bands).filter(Boolean) || [];
      console.log('[Rehearsals] Found bands:', bands.length);
      return bands;
    },
    enabled: !!profile?.id,
  });
  
  if (bandsError) {
    console.error('[Rehearsals] Bands query error:', bandsError);
  }

  const bandIds = userBands.map((b: any) => b.id);

  // Fetch rehearsal rooms
  const { data: rooms = [] } = useQuery({
    queryKey: ["rehearsal-rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rehearsal_rooms")
        .select("*")
        .order("quality_rating", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch songs for selected band
  const { data: bandSongs = [] } = useQuery({
    queryKey: ["band-songs", selectedBand?.id],
    queryFn: async () => {
      if (!selectedBand?.id) return [];
      
      const { data: members } = await supabase
        .from("band_members")
        .select("user_id")
        .eq("band_id", selectedBand.id);
      
      const userIds = members?.map(m => m.user_id) || [];
      
      const { data, error } = await supabase
        .from("songs")
        .select("*")
        .in("user_id", userIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedBand?.id,
  });

  // Fetch rehearsals for all user's bands
  const { data: rehearsals = [], isLoading } = useQuery({
    queryKey: ["all-rehearsals", bandIds],
    queryFn: async () => {
      if (bandIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("band_rehearsals")
        .select(`
          *,
          rehearsal_rooms:rehearsal_room_id (
            name,
            location,
            hourly_rate
          ),
          songs:selected_song_id (
            title
          ),
          bands:band_id (
            name
          )
        `)
        .in("band_id", bandIds)
        .order("scheduled_start", { ascending: false });
      
      if (error) throw error;
      return (data || []) as Rehearsal[];
    },
    enabled: bandIds.length > 0,
  });

  // Fetch song familiarity for all bands
  const { data: familiarityData = [] } = useQuery({
    queryKey: ["band-song-familiarity", bandIds],
    queryFn: async () => {
      if (bandIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("band_song_familiarity")
        .select(`
          *,
          songs (
            title
          ),
          bands (
            name
          )
        `)
        .in("band_id", bandIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: bandIds.length > 0,
  });

  const now = new Date();
  const upcomingRehearsals = rehearsals.filter(r => 
    new Date(r.scheduled_start) >= now && r.status !== "completed"
  );
  const completedRehearsals = rehearsals.filter(r => 
    new Date(r.scheduled_start) < now || r.status === "completed"
  );

  const displayRehearsals = activeTab === "upcoming" ? upcomingRehearsals : completedRehearsals;

  // Calculate stats
  const totalSpent = completedRehearsals.reduce((sum, r) => sum + r.total_cost, 0);
  const upcomingCost = upcomingRehearsals.reduce((sum, r) => sum + r.total_cost, 0);
  const avgChemistryGain = completedRehearsals.length > 0
    ? completedRehearsals.reduce((sum, r) => sum + (r.chemistry_gain || 0), 0) / completedRehearsals.length
    : 0;

  const handleBookRehearsal = async (
    roomId: string, 
    duration: number, 
    songId: string | null, 
    setlistId: string | null, 
    scheduledStart: Date
  ) => {
    if (!selectedBand) return;

    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    const totalCost = room.hourly_rate * duration;
    const currentBalance = selectedBand.band_balance || 0;

    if (currentBalance < totalCost) {
      toast({
        title: "Insufficient Funds",
        description: `This rehearsal costs $${totalCost.toFixed(2)} but your band only has $${currentBalance.toFixed(2)}.`,
        variant: "destructive",
      });
      return;
    }

    const chemistryGain = Math.floor((room.quality_rating / 10) * duration);
    const xpEarned = Math.floor(50 * duration * (room.equipment_quality / 100));
    const familiarityGained = duration * 60;

    try {
      const rehearsalId = await bookRehearsal({
        bandId: selectedBand.id,
        roomId,
        duration,
        songId,
        setlistId,
        scheduledStart,
        totalCost,
        chemistryGain,
        xpEarned,
        familiarityGained,
        roomName: room.name,
        roomLocation: room.location || '',
      });

      setShowBookingDialog(false);
      return rehearsalId;
    } catch (error) {
      // Error handling done in hook
      return;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      scheduled: "secondary",
      completed: "default",
      cancelled: "destructive",
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold">Band Rehearsals</h1>
          <p className="text-muted-foreground">
            Manage rehearsals for all your bands to improve chemistry and song familiarity
          </p>
        </div>
        
      {/* Prominent action card */}
      {isLoadingBands ? (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 text-center text-muted-foreground">
            Loading your bands...
          </CardContent>
        </Card>
      ) : userBands.length > 0 ? (
        <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="font-semibold text-lg">Ready to rehearse?</h3>
                  <p className="text-sm text-muted-foreground">
                    Book a rehearsal session or plan one for later
                  </p>
                </div>
                <div className="space-y-2">
                  {userBands.map((band: any) => (
                    <div key={band.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between p-3 bg-background rounded-lg border">
                      <span className="font-medium">{band.name}</span>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button 
                          size="sm"
                          onClick={() => {
                            setSelectedBand(band);
                            setShowBookingDialog(true);
                          }}
                          className="w-full sm:w-auto"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Book Rehearsal
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-muted/50 border-muted">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground mb-2">You're not in any bands yet.</p>
              <p className="text-sm text-muted-foreground">Join or create a band to book rehearsals.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingRehearsals.length}</div>
            <p className="text-xs text-muted-foreground">
              ${upcomingCost.toFixed(2)} committed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Music2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedRehearsals.length}</div>
            <p className="text-xs text-muted-foreground">
              Sessions total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSpent.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              All time rehearsals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Chemistry</CardTitle>
            <Music2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{avgChemistryGain.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              Per session
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Song Familiarity Overview */}
      {familiarityData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Song Familiarity Progress</CardTitle>
            <CardDescription>Track how well your bands know their songs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {familiarityData.slice(0, 5).map((fam: any) => (
              <div key={fam.id} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{fam.songs?.title}</span>
                    <span className="text-muted-foreground ml-2">- {fam.bands?.name}</span>
                  </div>
                  <span className="font-semibold">{fam.familiarity_percentage}%</span>
                </div>
                <Progress value={fam.familiarity_percentage} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Rehearsals List */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="upcoming">
            Upcoming ({upcomingRehearsals.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedRehearsals.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                Loading rehearsals...
              </CardContent>
            </Card>
          ) : displayRehearsals.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                {activeTab === "upcoming" 
                  ? "No upcoming rehearsals scheduled."
                  : "No completed rehearsals yet."}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {displayRehearsals.map((rehearsal) => (
                <Card key={rehearsal.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">
                          {rehearsal.bands?.name || "Unknown Band"}
                        </CardTitle>
                        <CardDescription>
                          {rehearsal.rehearsal_rooms?.name || "Unknown Venue"} - {rehearsal.rehearsal_rooms?.location}
                        </CardDescription>
                      </div>
                      {getStatusBadge(rehearsal.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          Date
                        </div>
                        <div className="font-medium">
                          {format(new Date(rehearsal.scheduled_start), "MMM d, yyyy")}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Time
                        </div>
                        <div className="font-medium">
                          {format(new Date(rehearsal.scheduled_start), "h:mm a")} - {format(new Date(rehearsal.scheduled_end), "h:mm a")}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <DollarSign className="h-3 w-3" />
                          Cost
                        </div>
                        <div className="font-medium">${rehearsal.total_cost.toFixed(2)}</div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Music2 className="h-3 w-3" />
                          Song
                        </div>
                        <div className="font-medium truncate">
                          {rehearsal.songs?.title || "General Practice"}
                        </div>
                      </div>
                    </div>

                    {rehearsal.status === "completed" && (
                      <>
                        <Separator />
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="space-y-1">
                            <div className="text-muted-foreground">Chemistry Gain</div>
                            <div className="font-semibold text-green-600">
                              +{rehearsal.chemistry_gain || 0}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-muted-foreground">Familiarity</div>
                            <div className="font-semibold text-blue-600">
                              +{rehearsal.familiarity_gained || 0} min
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-muted-foreground">XP Earned</div>
                            <div className="font-semibold text-purple-600">
                              {rehearsal.xp_earned || 0} XP
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {showBookingDialog && selectedBand && (
        <RehearsalBookingDialog
          rooms={rooms}
          band={selectedBand}
          songs={bandSongs}
          onConfirm={handleBookRehearsal}
          onClose={() => setShowBookingDialog(false)}
        />
      )}
    </div>
  );
};

export default Rehearsals;
