import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Disc3, Mic2, Users, Sparkles, Loader2, Trophy, MessageCircle, Crown, History, UserPlus, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { supabase } from "@/integrations/supabase/client";
import { normalizeNightClubRecord, type CityNightClub, type NightClubDrink } from "@/utils/worldEnvironment";
import { useNightlifeEvents } from "@/hooks/useNightlifeEvents";
import { useNightclubQuests } from "@/hooks/useNightclubQuests";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useClubReputation, useRecordClubVisit, getTierLabel, getTierColor, getTierPerks } from "@/hooks/useClubReputation";
import { useClubPresence, useEnterClub } from "@/hooks/useClubPresence";
import { DirectMessagePanel } from "@/features/relationships/components/DirectMessagePanel";
import { useOptionalGameData } from "@/hooks/useGameData";
import { toast } from "sonner";
import { NightClubGuestActionCard } from "@/components/nightclub/NightClubGuestActionCard";
import { NightClubDrinkMenu } from "@/components/nightclub/NightClubDrinkMenu";
import { NPCDialoguePanel } from "@/components/nightclub/NPCDialoguePanel";
import { NightlifeStanceSelector } from "@/components/nightclub/NightlifeStanceSelector";
import type { NightlifeStance } from "@/utils/nightlifeRiskLayer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClubEventsSection } from "@/components/nightclub/ClubEventsSection";
import { VipLoungeSection } from "@/components/nightclub/VipLoungeSection";
import { useOwnedNightclubs } from "@/hooks/useNightclubOwnership";
import { DjMixingStudio } from "@/features/nightclub-dj/DjMixingStudio";
import { DjBookingPanel } from "@/features/nightclub-dj/DjBookingPanel";
import { DjClubApplications } from "@/features/nightclub-dj/DjClubApplications";
import { DjFundedOffers } from "@/features/nightclub-dj/DjFundedOffers";
import { DjResidencyInvitations } from "@/features/nightclub-dj/DjResidencyAgreements";

const QUALITY_LABELS: Record<number, string> = {
  1: "Underground",
  2: "Neighborhood",
  3: "Boutique",
  4: "Premier",
  5: "Legendary",
};

const fameFormatter = new Intl.NumberFormat("en-US");
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const getScoreColor = (score: number) => {
  if (score >= 85) return "text-green-400";
  if (score >= 65) return "text-primary";
  if (score >= 40) return "text-yellow-500";
  return "text-destructive";
};

const NightClubDetail = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const { profileId } = useActiveProfile();
  const gameData = useOptionalGameData();
  const queryClient = useQueryClient();
  // Retain each request key across ambiguous network failures so retries
  // can never charge the same attempted drink twice.
  const pendingDrinkRequests = useRef(new Map<string, string>());
  const profileUserId = gameData?.profile?.user_id ?? null;
  const [club, setClub] = useState<CityNightClub | null>(null);
  const [cityName, setCityName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [buyingDrinkId, setBuyingDrinkId] = useState<string | null>(null);

  const { triggerNightlifeEvent, isProcessing, lastOutcomeDetail, lastAddictionWarning, dismissOutcome } = useNightlifeEvents();
  const [showDjStudio, setShowDjStudio] = useState(false);
  const [liveDjBookingId, setLiveDjBookingId] = useState<string | null>(null);
  const { data: reputation } = useClubReputation(clubId);
  const recordVisit = useRecordClubVisit();

  const {
    quests,
    questsLoading,
    getQuestProgress,
    startQuest,
    advanceDialogue,
    claimRewards,
    isStarting,
    isAdvancing,
    isClaiming,
  } = useNightclubQuests(clubId);

  const [activeQuestId, setActiveQuestId] = useState<string | null>(null);
  const activeQuest = quests.find((q) => q.id === activeQuestId) ?? null;
  const activeProgress = activeQuestId ? getQuestProgress(activeQuestId) : null;

  // Club presence + social
  const { data: clubPresence = [] } = useClubPresence(clubId);
  const enterClub = useEnterClub();
  const clubChatChannel = clubId ? `club:${clubId}` : null;
  const { data: ownedClubs = [] } = useOwnedNightclubs();
  const isOwned = ownedClubs.some((c) => c.club_id === clubId);
  // DJ Performance History
  const { data: djHistory = [] } = useQuery({
    queryKey: ["dj-performances", profileId, clubId],
    queryFn: async () => {
      if (!profileId || !clubId) return [];
      const { data } = await supabase
        .from("player_dj_performances")
        .select("*")
        .eq("profile_id", profileId)
        .eq("club_id", clubId)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!profileId && !!clubId,
  });

  const djStats = {
    recentSets: djHistory.length,
    avgScore: djHistory.length ? Math.round(djHistory.reduce((s, p: any) => s + (p.performance_score ?? 0), 0) / djHistory.length) : 0,
    totalEarnings: djHistory.reduce((s, p: any) => s + (p.cash_earned ?? 0), 0),
    totalFame: djHistory.reduce((s, p: any) => s + (p.fame_gained ?? 0), 0),
  };

  useEffect(() => {
    if (!clubId) return;
    setLoading(true);

    const fetchClub = async () => {
      const { data, error } = await supabase
        .from("city_night_clubs")
        .select("*, cities:city_id(name, country)")
        .eq("id", clubId)
        .single();

      if (error || !data) {
        setLoading(false);
        return;
      }

      const cityInfo = data.cities as any;
      if (cityInfo?.name) setCityName(cityInfo.name);

      const normalized = normalizeNightClubRecord(data as unknown as Record<string, unknown>);
      setClub(normalized);
      setLoading(false);
    };

    fetchClub();
  }, [clubId]);

  const handleBuyDrink = async (drink: NightClubDrink) => {
    if (!profileId || !clubId || buyingDrinkId) return;
    const key = `${profileId}:${clubId}:${drink.id}`;
    const requestId = pendingDrinkRequests.current.get(key) ?? crypto.randomUUID();
    pendingDrinkRequests.current.set(key, requestId);
    setBuyingDrinkId(drink.id);
    try {
      // The server checks ownership, location, live menu price and optional
      // stock, then debits cash, awards energy and journals atomically.
      // This RPC is added by the production-applied nightclub checkout migration.
      const { data, error } = await supabase.rpc("purchase_nightclub_drink" as never, {
        p_profile_id: profileId,
        p_club_id: clubId,
        p_drink_id: drink.id,
        p_request_id: requestId,
      } as never);
      if (error) throw error;
      const result = data as {
        purchase_id?: string;
        drink_name?: string;
        cash_spent?: number;
        energy_gained?: number;
      } | null;
      if (!result || result.purchase_id !== requestId
        || typeof result.cash_spent !== "number"
        || typeof result.energy_gained !== "number") {
        throw new Error("The drink purchase was not confirmed by the server");
      }
      pendingDrinkRequests.current.delete(key);
      toast.success(`🍸 ${result.drink_name ?? drink.name} — $${result.cash_spent} spent, +${result.energy_gained} energy`);
      // Refresh is best-effort after an authoritative committed purchase.
      // A cache/network refresh failure must not show a false payment failure.
      try {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["profile"] }),
          queryClient.invalidateQueries({ queryKey: ["active-profile"] }),
          queryClient.invalidateQueries({ queryKey: ["player-financial-accounts"] }),
        ]);
        await gameData?.refetch();
        // Re-read the live menu so limited-stock drinks are correctly displayed.
        const { data: refreshedClub } = await supabase
          .from("city_night_clubs")
          .select("*")
          .eq("id", clubId)
          .maybeSingle();
        if (refreshedClub) setClub(normalizeNightClubRecord(refreshedClub as unknown as Record<string, unknown>));
      } catch {
        // The purchase receipt already confirms success; UI catches up on refocus.
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Nightclub purchase failed");
      // Keep the request key: a payment may have committed before a lost reply.
      // Retrying will return the same receipt instead of charging twice.
    } finally {
      setBuyingDrinkId(null);
    }
  };

  const handleStanceSelect = (stance: NightlifeStance) => {
    if (!club || !clubId) return;
    triggerNightlifeEvent({
      activityType: "stance_night",
      clubName: club.name,
      stance,
      venueQuality: club.qualityLevel,
    });
    recordVisit.mutate({ clubId });
    enterClub.mutate(clubId);
  };

  const busy = isProcessing;

  if (loading) {
    return (
      <FMPageScaffold title="Loading…" icon={Disc3} backTo="/nightclubs">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </FMPageScaffold>
    );
  }

  if (!club) {
    return (
      <FMPageScaffold title="Club Not Found" icon={Disc3} backTo="/nightclubs" backLabel="Back to Clubs">
        <p className="text-muted-foreground">This nightclub doesn't exist or has been removed.</p>
      </FMPageScaffold>
    );
  }

  const qualityLabel = QUALITY_LABELS[club.qualityLevel] ?? `Tier ${club.qualityLevel}`;

  return (
    <FMPageScaffold
      title={club.name}
      subtitle={`${qualityLabel} nightclub${cityName ? ` in ${cityName}` : ""}`}
      icon={Disc3}
      backTo={club.cityId ? `/cities/${club.cityId}` : "/nightclubs"}
      backLabel={cityName ? `Back to ${cityName}` : "Back to Clubs"}
    >

      {/* Club Info */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {club.description && (
            <p className="text-sm text-muted-foreground">{club.description}</p>
          )}
          <div className="flex flex-wrap gap-3">
            <Badge variant="secondary">{qualityLabel}</Badge>
            <Badge variant={club.liveInteractionsEnabled ? "outline" : "destructive"}>
              {club.liveInteractionsEnabled ? "Live interactions on" : "Live interactions paused"}
            </Badge>
            {club.capacity && <Badge variant="outline">Capacity: {club.capacity.toLocaleString()}</Badge>}
            {club.coverCharge && <Badge variant="outline">Cover: {currencyFormatter.format(club.coverCharge)}</Badge>}
          </div>

          {/* Club Reputation */}
          {reputation && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Crown className={`h-4 w-4 ${getTierColor(reputation.reputation_tier)}`} />
                <span className={`text-sm font-semibold ${getTierColor(reputation.reputation_tier)}`}>
                  {getTierLabel(reputation.reputation_tier)}
                </span>
                <span className="text-xs text-muted-foreground">• {reputation.visit_count} visits • {reputation.dj_sets_played} DJ sets</span>
              </div>
              {getTierPerks(reputation.reputation_tier).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {getTierPerks(reputation.reputation_tier).map((perk) => (
                    <Badge key={perk} variant="outline" className="text-[10px]">{perk}</Badge>
                  ))}
                </div>
              )}
              <Progress value={Math.min(100, reputation.reputation_points / 5)} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground">{reputation.reputation_points} reputation points</p>
            </div>
          )}

          {/* DJ Slot Info */}
          {club.djSlot && (
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Mic2 className="h-4 w-4 text-primary" /> DJ Slot
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>Requires {fameFormatter.format(club.djSlot.fameRequirement)} fame</span>
                {club.djSlot.payout && <span>Pay: {currencyFormatter.format(club.djSlot.payout)}</span>}
                {club.djSlot.setLengthMinutes && <span>{club.djSlot.setLengthMinutes} min set</span>}
                {club.djSlot.schedule && <span>{club.djSlot.schedule}</span>}
              </div>
              {club.djSlot.perks && club.djSlot.perks.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {club.djSlot.perks.map((perk) => (
                    <Badge key={perk} variant="outline" className="text-xs">{perk}</Badge>
                  ))}
                </div>
              )}
              {import.meta.env.VITE_DJ_SCHEDULED_BOOKINGS_ENABLED === "true" ? (
                <Button type="button" className="w-full sm:w-auto"
                  onClick={() => document.getElementById("dj-bookings")?.scrollIntoView({ behavior: "smooth" })}>
                  <Mic2 className="mr-2 h-4 w-4" /> Book DJ Set
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground" role="status">
                  Scheduled DJ gigs are being prepared. The mixing studio is available for reward-free practice.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Two playable decks for practice, with no client-side rewards. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Disc3 className="h-5 w-5 text-primary" /> DJ Mixing Studio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Play your recorded songs and admin-curated club music on two DJ decks. Cue tracks, adjust tempo and crossfade your own live mix.</p>
          <Button variant="outline" type="button" onClick={() => setShowDjStudio((value) => !value)}>
            {showDjStudio ? "Close mixing studio" : "Open mixing studio"}
          </Button>
          {showDjStudio && <DjMixingStudio key={liveDjBookingId ?? "practice"} liveBookingId={liveDjBookingId ?? undefined} />}
        </CardContent>
      </Card>

      {/* DJ contracts and payouts go exclusively through the verified booking service. */}
      {profileId && clubId && (
        <section id="dj-bookings" aria-label="Scheduled DJ bookings">
          <DjBookingPanel profileId={profileId} clubId={clubId}
            onLiveBooking={(bookingId) => {
              setLiveDjBookingId(bookingId);
              if (bookingId) setShowDjStudio(true);
            }} />
        </section>
      )}

      {profileId && clubId && <DjClubApplications profileId={profileId} clubId={clubId} />}
      {profileId && clubId && <DjFundedOffers profileId={profileId} clubId={clubId} />}
      {profileId && clubId && <DjResidencyInvitations profileId={profileId} clubId={clubId} />}

      {/* Club Events */}
      {clubId && <ClubEventsSection clubId={clubId} />}

      {/* VIP Lounge */}
      {clubId && <VipLoungeSection clubId={clubId} />}

      {/* Owned Club Link */}
      {isOwned && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">You own this club</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate("/nightclub-management")}>
                Manage
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* DJ Performance History */}
      {djHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-primary" /> DJ Performance History (last 10)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stats Summary */}
            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-md border border-border p-2 text-center">
                <div className="text-lg font-bold">{djStats.recentSets}</div>
                <div className="text-[10px] text-muted-foreground">Recent sets</div>
              </div>
              <div className="rounded-md border border-border p-2 text-center">
                <div className={`text-lg font-bold ${getScoreColor(djStats.avgScore)}`}>{djStats.avgScore}</div>
                <div className="text-[10px] text-muted-foreground">Recent avg score</div>
              </div>
              <div className="rounded-md border border-border p-2 text-center">
                <div className="text-lg font-bold text-green-400">${djStats.totalEarnings}</div>
                <div className="text-[10px] text-muted-foreground">Recent earnings</div>
              </div>
              <div className="rounded-md border border-border p-2 text-center">
                <div className="text-lg font-bold text-yellow-400">+{djStats.totalFame}</div>
                <div className="text-[10px] text-muted-foreground">Recent fame</div>
              </div>
            </div>

            {/* Recent Performances */}
            <div className="space-y-2">
              {djHistory.slice(0, 5).map((perf: any) => (
                <div key={perf.id} className="flex items-center justify-between rounded-md border border-border/60 p-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`font-bold ${getScoreColor(perf.performance_score ?? 0)}`}>
                      {perf.performance_score}
                    </div>
                    <span className="text-muted-foreground">{perf.outcome_text}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>+${perf.cash_earned}</span>
                    <span>+{perf.fame_gained} fame</span>
                    <span>{new Date(perf.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Nightlife Risk Layer - Stance Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" /> Nightlife Experience
          </CardTitle>
        </CardHeader>
        <CardContent>
          <NightlifeStanceSelector
            clubName={club.name}
            isProcessing={isProcessing}
            outcome={lastOutcomeDetail}
            onDismissOutcome={dismissOutcome}
            addictionWarning={lastAddictionWarning}
            onSelectStance={handleStanceSelect}
          />
        </CardContent>
      </Card>

      {/* Guest Actions */}
      {club.guestActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" /> Guest Experiences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {club.guestActions.map((action) => (
              <NightClubGuestActionCard
                key={action.id}
                action={action}
                clubName={club.name}
                disabled={busy}
                onPerform={() => {
                  triggerNightlifeEvent({ activityType: "guest_visit", clubName: club.name });
                  if (clubId) recordVisit.mutate({ clubId });
                }}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Drink Menu */}
      {club.drinkMenu.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <NightClubDrinkMenu
              drinks={club.drinkMenu}
              onBuyDrink={handleBuyDrink}
              disabled={busy || buyingDrinkId !== null}
              buyingId={buyingDrinkId}
            />
          </CardContent>
        </Card>
      )}

      {/* NPCs */}
      {club.npcProfiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" /> Resident NPCs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {club.npcProfiles.map((npc) => (
              <div key={npc.id} className="rounded-lg border border-border/60 p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{npc.name}</span>
                  {npc.role && <Badge variant="outline" className="text-xs">{npc.role}</Badge>}
                  {npc.personality && <span className="text-xs text-muted-foreground">{npc.personality}</span>}
                </div>
                {npc.dialogueHooks && npc.dialogueHooks.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Topics: {npc.dialogueHooks.slice(0, 3).join(", ")}
                    {npc.dialogueHooks.length > 3 ? "…" : ""}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Who's Here - Club Presence */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" /> Who's Here
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clubPresence.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other players here right now. Be the first to enter!</p>
          ) : (
            <div className="space-y-2">
              {clubPresence.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                      {(entry.profile?.display_name || entry.profile?.username || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{entry.profile?.display_name || entry.profile?.username || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">
                        Level {entry.profile?.level ?? 1} • {(entry.profile?.fame ?? 0).toLocaleString()} fame
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {clubId && (
            <Button
              size="sm"
              variant="outline"
              className="mt-3 w-full"
              onClick={() => enterClub.mutate(clubId)}
              disabled={enterClub.isPending}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {enterClub.isPending ? "Entering..." : "Enter Club"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Club Chat */}
      {clubChatChannel && profileUserId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageCircle className="h-5 w-5 text-primary" /> Club Chat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DirectMessagePanel
              channel={clubChatChannel}
              currentUserId={profileUserId}
              otherDisplayName="Club Chat"
            />
          </CardContent>
        </Card>
      )}

      {/* Quests */}
      {!questsLoading && quests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5 text-primary" /> Quests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {quests.map((quest) => {
              const prog = getQuestProgress(quest.id);
              const isDone = prog?.status === "completed" && prog.rewards_claimed;
              return (
                <div
                  key={quest.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{quest.title}</span>
                      {isDone && <Badge variant="secondary" className="text-xs">✅ Done</Badge>}
                      {prog?.status === "active" && <Badge className="text-xs">In Progress</Badge>}
                      {prog?.status === "completed" && !prog.rewards_claimed && (
                        <Badge variant="default" className="text-xs">Claim Reward</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{quest.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={isDone ? "ghost" : "outline"}
                    disabled={isDone}
                    onClick={() => setActiveQuestId(quest.id)}
                  >
                    {isDone ? "Done" : prog ? "Continue" : "Start"}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Quest Dialogue Panel */}
      {activeQuest && (
        <NPCDialoguePanel
          open={!!activeQuestId}
          onOpenChange={(open) => !open && setActiveQuestId(null)}
          quest={activeQuest}
          progress={activeProgress}
          onStartQuest={() => startQuest(activeQuest.id)}
          onAdvanceDialogue={(progressId, nextNodeId) => advanceDialogue({ progressId, nextNodeId })}
          onClaimRewards={(progressId, rewards) => claimRewards({ progressId, rewards })}
          isStarting={isStarting}
          isAdvancing={isAdvancing}
          isClaiming={isClaiming}
        />
      )}

    </FMPageScaffold>
  );
};

export default NightClubDetail;
