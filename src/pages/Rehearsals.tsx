import { useState } from "react";
import { useGameData } from "@/hooks/useGameData";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Music2,
  DollarSign,
  Plus,
  Clock,
  CalendarPlus,
  Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { RehearsalBookingDialog } from "@/components/performance/RehearsalBookingDialog";
import { ActiveRehearsalDialog } from "@/components/rehearsal/ActiveRehearsalDialog";
import { useToast } from "@/hooks/use-toast";
import { useRehearsalBooking } from "@/hooks/useRehearsalBooking";
import { useTranslation } from "@/hooks/useTranslation";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { RehearsalParticipantsSection } from "@/components/social/ParticipantStatusList";
import { BandAvailabilityConflictDialog } from "@/components/band/BandAvailabilityConflictDialog";
import {
  isBandUnavailableError,
  joinBandActivityLate,
  type ConflictInfo,
} from "@/utils/bandActivityScheduling";

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
  const { profileId } = useActiveProfile();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { bookRehearsal, isBooking } = useRehearsalBooking();
  const [activeTab, setActiveTab] = useState<"upcoming" | "completed">(
    "upcoming",
  );
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [selectedBand, setSelectedBand] = useState<any>(null);
  const [activeRehearsalBand, setActiveRehearsalBand] = useState<any>(null);
  const [conflictState, setConflictState] = useState<{
    conflicts: ConflictInfo[];
    label: string;
    retry: (skipProfileIds: string[]) => Promise<void>;
  } | null>(null);

  const {
    data: userBands = [],
    isLoading: isLoadingBands,
    error: bandsError,
  } = useQuery({
    queryKey: ["user-bands", profileId],
    queryFn: async () => {
      if (!profileId) return [];

      console.log("[Rehearsals] Profile ID:", profileId);
      console.log("[Rehearsals] Fetching bands for profile:", profileId);

      const { data, error } = await supabase
        .from("band_members")
        .select(
          "band_id, role, member_status, bands!band_members_band_id_fkey(id, name, band_balance, chemistry_level, status)",
        )
        .eq("profile_id", profileId)
        .eq("is_touring_member", false);

      if (error) {
        console.error("[Rehearsals] Error fetching user bands:", error);
        throw error;
      }

      const bands =
        data
          ?.map((membership: any) =>
            membership.bands
              ? {
                  ...membership.bands,
                  membershipRole: membership.role,
                  memberStatus: membership.member_status,
                }
              : null,
          )
          .filter(Boolean) || [];

      return bands;
    },
    enabled: !!profileId,
  });

  if (bandsError) {
    console.error("[Rehearsals] Bands query error:", bandsError);
  }

  const bandIds = userBands.map((b: any) => b.id);

  const { data: rooms = [] } = useQuery({
    queryKey: ["rehearsal-rooms-with-cities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rehearsal_rooms")
        .select("*, city:cities(id, name)")
        .order("quality_rating", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: cities = [] } = useQuery({
    queryKey: ["cities-for-rehearsal-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: bandSongs = [] } = useQuery({
    queryKey: ["band-songs", selectedBand?.id, profileId],
    queryFn: async () => {
      if (!selectedBand?.id) return [];
      const allSongs: any[] = [];
      const seen = new Set<string>();

      const { data: bandOwnedSongs, error: bandError } = await supabase
        .from("songs")
        .select("*")
        .eq("band_id", selectedBand.id)
        .or("archived.is.null,archived.eq.false");

      if (bandError) {
        console.error("[Rehearsals] Error fetching band songs:", bandError);
      } else {
        for (const song of bandOwnedSongs ?? []) {
          if (!seen.has(song.id)) {
            seen.add(song.id);
            allSongs.push(song);
          }
        }
      }

      if (profileId) {
        const { data: ownSongs, error: ownError } = await supabase
          .from("songs")
          .select("*")
          .eq("profile_id", profileId)
          .is("band_id", null)
          .or("archived.is.null,archived.eq.false");

        if (ownError) {
          console.error("[Rehearsals] Error fetching own songs:", ownError);
        } else {
          for (const song of ownSongs ?? []) {
            if (!seen.has(song.id)) {
              seen.add(song.id);
              allSongs.push(song);
            }
          }
        }
      }

      return allSongs;
    },
    enabled: !!selectedBand?.id,
  });

  const { data: myBookedRehearsalIds = [] } = useQuery({
    queryKey: ["my-rehearsal-schedule", profileId],
    queryFn: async () => {
      if (!profileId) return [] as string[];
      const { data, error } = await (supabase as any)
        .from("player_scheduled_activities")
        .select("linked_rehearsal_id")
        .eq("profile_id", profileId)
        .eq("activity_type", "rehearsal")
        .neq("status", "cancelled")
        .not("linked_rehearsal_id", "is", null);
      if (error) return [] as string[];
      return (data || []).map((row: any) => row.linked_rehearsal_id as string);
    },
    enabled: !!profileId,
  });

  const handleJoinRehearsal = async (rehearsal: Rehearsal) => {
    if (!profileId) return;
    const result = await joinBandActivityLate({
      profileId,
      userId: profile?.user_id ?? null,
      bandId: rehearsal.band_id,
      activityType: "rehearsal",
      title: `Band Rehearsal - ${rehearsal.rehearsal_rooms?.name || "Rehearsal room"}`,
      scheduledStart: new Date(rehearsal.scheduled_start),
      scheduledEnd: new Date(rehearsal.scheduled_end),
      location: rehearsal.rehearsal_rooms?.location || null,
      linkedRehearsalId: rehearsal.id,
      metadata: { rehearsalId: rehearsal.id },
    });

    if (result.joined) {
      toast({ title: "You're in", description: "You've been added to this rehearsal." });
      queryClient.invalidateQueries({ queryKey: ["my-rehearsal-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] });
    } else {
      toast({ title: "Can't join yet", description: result.reason, variant: "destructive" });
    }
  };

  const { data: rehearsals = [], isLoading } = useQuery({
    queryKey: ["all-rehearsals", bandIds],
    queryFn: async () => {
      if (bandIds.length === 0) return [];
      const { data, error } = await supabase
        .from("band_rehearsals")
        .select(`
          *,
          rehearsal_rooms:rehearsal_room_id (name, location, hourly_rate),
          songs:selected_song_id (title),
          bands:band_id (name)
        `)
        .in("band_id", bandIds)
        .order("scheduled_start", { ascending: false });
      if (error) throw error;
      return (data || []) as Rehearsal[];
    },
    enabled: bandIds.length > 0,
  });

  const { data: familiarityData = [] } = useQuery({
    queryKey: ["band-song-familiarity", bandIds],
    queryFn: async () => {
      if (bandIds.length === 0) return [];
      const { data, error } = await supabase
        .from("band_song_familiarity")
        .select(`*, songs (title), bands (name)`)
        .in("band_id", bandIds);
      if (error) throw error;
      return data || [];
    },
    enabled: bandIds.length > 0,
  });

  const now = new Date();
  const upcomingRehearsals = rehearsals.filter(
    (r) => new Date(r.scheduled_start) >= now && r.status !== "completed",
  );
  const completedRehearsals = rehearsals.filter(
    (r) => new Date(r.scheduled_start) < now || r.status === "completed",
  );
  const displayRehearsals = activeTab === "upcoming" ? upcomingRehearsals : completedRehearsals;

  const totalSpent = completedRehearsals.reduce((sum, r) => sum + r.total_cost, 0);
  const upcomingCost = upcomingRehearsals.reduce((sum, r) => sum + r.total_cost, 0);
  const avgChemistryGain = completedRehearsals.length > 0
    ? completedRehearsals.reduce((sum, r) => sum + (r.chemistry_gain || 0), 0) / completedRehearsals.length
    : 0;

  const isBandLeader = (band: any) =>
    ["leader", "founder", "co-leader", "manager"].includes(
      String(band?.membershipRole || "").toLowerCase(),
    );

  const handleBookRehearsal = async (
    roomId: string,
    duration: number,
    songId: string | null,
    setlistId: string | null,
    scheduledStart: Date,
    paymentSource: "band" | "personal" = "band",
    skipProfileIds: string[] = [],
  ) => {
    if (!selectedBand) return;
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;

    const totalCost = room.hourly_rate * duration;
    const currentBalance = selectedBand.band_balance || 0;
    if (paymentSource === "band" && currentBalance < totalCost) {
      toast({
        title: t("rehearsals.insufficientFunds"),
        description: `${t("rehearsals.rehearsalCost")} $${totalCost.toFixed(2)} ${t("rehearsals.bandBalance")} $${currentBalance.toFixed(2)}.`,
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
        roomLocation: room.location || "",
        bandName: selectedBand.name,
        skipProfileIds,
      });
      setShowBookingDialog(false);
      setConflictState(null);
      return rehearsalId;
    } catch (error) {
      if (isBandUnavailableError(error)) {
        setConflictState({
          conflicts: error.conflicts,
          label: `this rehearsal at ${room.name}`,
          retry: async (skipIds) => {
            await handleBookRehearsal(roomId, duration, songId, setlistId, scheduledStart, paymentSource, skipIds);
          },
        });
        return;
      }
      return;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = { scheduled: "secondary", completed: "default", cancelled: "destructive" };
    return <Badge variant={variants[status] || "outline"}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  return (
    <FMPageScaffold
      title={t("rehearsals.title")}
      subtitle={t("rehearsals.subtitle")}
      icon={Music2}
      backTo="/hub/band-live"
    >
      {conflictState && (
        <BandAvailabilityConflictDialog
          open
          onOpenChange={(open) => { if (!open) setConflictState(null); }}
          activityLabel={conflictState.label}
          conflicts={conflictState.conflicts}
          currentProfileId={profileId}
          canOverride={isBandLeader(selectedBand)}
          isSubmitting={isBooking}
          onProceedWithout={(skipIds) => {
            const retry = conflictState.retry;
            setConflictState(null);
            void retry(skipIds);
          }}
        />
      )}

      <div className="flex flex-col gap-4">
        {isLoadingBands ? (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 text-center text-muted-foreground">{t("rehearsals.loadingBands")}</CardContent>
          </Card>
        ) : userBands.length > 0 ? (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="font-semibold text-lg">{t("rehearsals.readyToRehearse")}</h3>
                  <p className="text-sm text-muted-foreground">Book a normal rehearsal or jump into a short optional Active Rehearsal.</p>
                </div>
                <div className="space-y-2">
                  {userBands.map((band: any) => (
                    <div key={band.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between p-3 bg-background rounded-lg border">
                      <span className="font-medium">{band.name}</span>
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setActiveRehearsalBand(band)}
                          className="w-full sm:w-auto"
                        >
                          <Activity className="mr-2 h-4 w-4" />
                          Active Rehearsal
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedBand(band);
                            setShowBookingDialog(true);
                          }}
                          className="w-full sm:w-auto"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          {t("rehearsals.bookRehearsal")}
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
              <p className="text-muted-foreground mb-2">{t("rehearsals.notInBand")}</p>
              <p className="text-sm text-muted-foreground">{t("rehearsals.joinOrCreateBand")}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("rehearsals.upcoming")}</CardTitle><Calendar className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{upcomingRehearsals.length}</div><p className="text-xs text-muted-foreground">${upcomingCost.toFixed(2)} {t("rehearsals.committed")}</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("rehearsals.completed")}</CardTitle><Music2 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{completedRehearsals.length}</div><p className="text-xs text-muted-foreground">{t("rehearsals.sessionsTotal")}</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("rehearsals.totalSpent")}</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">${totalSpent.toFixed(2)}</div><p className="text-xs text-muted-foreground">{t("rehearsals.allTimeRehearsals")}</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("rehearsals.avgChemistry")}</CardTitle><Music2 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">+{avgChemistryGain.toFixed(1)}</div><p className="text-xs text-muted-foreground">{t("rehearsals.perSession")}</p></CardContent></Card>
      </div>

      {familiarityData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("rehearsals.songFamiliarity")}</CardTitle>
            <CardDescription>{t("rehearsals.trackFamiliarity")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {familiarityData.slice(0, 5).map((fam: any) => (
              <div key={fam.id} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div><span className="font-medium">{fam.songs?.title}</span><span className="text-muted-foreground ml-2">- {fam.bands?.name}</span></div>
                  <span className="font-semibold">{fam.familiarity_percentage}%</span>
                </div>
                <Progress value={fam.familiarity_percentage} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="upcoming">{t("rehearsals.upcoming")} ({upcomingRehearsals.length})</TabsTrigger>
          <TabsTrigger value="completed">{t("rehearsals.completed")} ({completedRehearsals.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground">{t("rehearsals.loadingRehearsals")}</CardContent></Card>
          ) : displayRehearsals.length === 0 ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground">{activeTab === "upcoming" ? t("rehearsals.noUpcoming") : t("rehearsals.noCompleted")}</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {displayRehearsals.map((rehearsal) => (
                <Card key={rehearsal.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{rehearsal.bands?.name || "Unknown Band"}</CardTitle>
                        <CardDescription>{rehearsal.rehearsal_rooms?.name || "Unknown Venue"} - {rehearsal.rehearsal_rooms?.location}</CardDescription>
                      </div>
                      {getStatusBadge(rehearsal.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="space-y-1"><div className="flex items-center gap-1 text-muted-foreground"><Calendar className="h-3 w-3" />{t("gigs.date")}</div><div className="font-medium">{format(new Date(rehearsal.scheduled_start), "MMM d, yyyy")}</div></div>
                      <div className="space-y-1"><div className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" />{t("gigs.time")}</div><div className="font-medium">{format(new Date(rehearsal.scheduled_start), "h:mm a")} - {format(new Date(rehearsal.scheduled_end), "h:mm a")}</div></div>
                      <div className="space-y-1"><div className="flex items-center gap-1 text-muted-foreground"><DollarSign className="h-3 w-3" />{t("rehearsals.cost")}</div><div className="font-medium">${rehearsal.total_cost.toFixed(2)}</div></div>
                      <div className="space-y-1"><div className="flex items-center gap-1 text-muted-foreground"><Music2 className="h-3 w-3" />{t("music.songs")}</div><div className="font-medium truncate">{rehearsal.songs?.title || "General Practice"}</div></div>
                    </div>

                    {rehearsal.status === "scheduled" && !myBookedRehearsalIds.includes(rehearsal.id) && (
                      <div className="flex flex-col gap-2 rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">You are not booked into this session — the band went ahead without you.</p>
                        <Button size="sm" variant="outline" onClick={() => handleJoinRehearsal(rehearsal)}><CalendarPlus className="mr-2 h-4 w-4" />Join session</Button>
                      </div>
                    )}

                    <Separator />
                    <RehearsalParticipantsSection
                      rehearsalId={rehearsal.id}
                      completed={rehearsal.status === "completed"}
                      status={rehearsal.status}
                      scheduledStart={rehearsal.scheduled_start}
                      scheduledEnd={rehearsal.scheduled_end}
                      isManager={userBands.some(
                        (band: any) =>
                          band.id === rehearsal.band_id &&
                          band.memberStatus !== "inactive" &&
                          ["leader", "founder", "co-leader", "manager"].includes(String(band.membershipRole || "").toLowerCase()),
                      )}
                    />

                    {rehearsal.status === "completed" && (
                      <>
                        <Separator />
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="space-y-1"><div className="text-muted-foreground">Chemistry Gain</div><div className="font-semibold text-green-600">+{rehearsal.chemistry_gain || 0}</div></div>
                          <div className="space-y-1"><div className="text-muted-foreground">Familiarity</div><div className="font-semibold text-blue-600">+{rehearsal.familiarity_gained || 0} min</div></div>
                          <div className="space-y-1"><div className="text-muted-foreground">XP Earned</div><div className="font-semibold text-purple-600">{rehearsal.xp_earned || 0} XP</div></div>
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
          cities={cities}
          currentCityId={profile?.current_city_id || null}
          band={selectedBand}
          songs={bandSongs}
          onConfirm={handleBookRehearsal}
          onClose={() => setShowBookingDialog(false)}
        />
      )}

      {activeRehearsalBand && (
        <ActiveRehearsalDialog
          open
          onOpenChange={(open) => { if (!open) setActiveRehearsalBand(null); }}
          bandId={activeRehearsalBand.id}
          bandName={activeRehearsalBand.name}
        />
      )}
    </FMPageScaffold>
  );
};

export default Rehearsals;
