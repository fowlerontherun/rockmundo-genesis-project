import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Disc3, Mic2, Users, Sparkles, Loader2, Star, Clock, DollarSign, Zap, Trophy, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { PageLayout } from "@/components/ui/PageLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { normalizeNightClubRecord, type CityNightClub, type NightClubDrink } from "@/utils/worldEnvironment";
import { useNightlifeEvents } from "@/hooks/useNightlifeEvents";
import { useDjPerformance, type DjPerformanceOutcome } from "@/hooks/useDjPerformance";
import { useNightclubQuests } from "@/hooks/useNightclubQuests";
import { useAuth } from "@/hooks/use-auth-context";
import { toast } from "sonner";
import { NightClubGuestActionCard } from "@/components/nightclub/NightClubGuestActionCard";
import { NightClubDrinkMenu } from "@/components/nightclub/NightClubDrinkMenu";
import { NPCDialoguePanel } from "@/components/nightclub/NPCDialoguePanel";

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
  const { user } = useAuth();
  const [club, setClub] = useState<CityNightClub | null>(null);
  const [cityName, setCityName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [buyingDrinkId, setBuyingDrinkId] = useState<string | null>(null);

  const { triggerNightlifeEvent, isProcessing } = useNightlifeEvents();
  const { performDjSetAsync, isPerforming } = useDjPerformance();
  const [djOutcome, setDjOutcome] = useState<DjPerformanceOutcome | null>(null);
  const [showOutcome, setShowOutcome] = useState(false);

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

  const handleDjSlot = async () => {
    if (!club) return;
    try {
      const outcome = await performDjSetAsync(club);
      setDjOutcome(outcome);
      setShowOutcome(true);
    } catch {
      // toast handled by hook
    }
  };

  const handleBuyDrink = async (drink: NightClubDrink) => {
    if (!user?.id || !drink.price) return;
    setBuyingDrinkId(drink.id);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("cash, energy")
        .eq("user_id", user.id)
        .single();
      if (!profile) throw new Error("Profile not found");
      if ((profile.cash ?? 0) < drink.price) {
        toast.error(`Need $${drink.price} for ${drink.name}`);
        return;
      }
      await supabase
        .from("profiles")
        .update({
          cash: Math.max(0, (profile.cash ?? 0) - drink.price),
          energy: Math.min(100, (profile.energy ?? 0) + 5),
        })
        .eq("user_id", user.id);
      toast.success(`🍸 ${drink.name} — ${drink.effect || "+5 energy"}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBuyingDrinkId(null);
    }
  };

  const busy = isProcessing || isPerforming;

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  if (!club) {
    return (
      <PageLayout>
        <PageHeader title="Club Not Found" backTo="/world" backLabel="Back to World" />
        <p className="text-muted-foreground">This nightclub doesn't exist or has been removed.</p>
      </PageLayout>
    );
  }

  const qualityLabel = QUALITY_LABELS[club.qualityLevel] ?? `Tier ${club.qualityLevel}`;

  return (
    <PageLayout>
      <PageHeader
        title={club.name}
        subtitle={`${qualityLabel} nightclub${cityName ? ` in ${cityName}` : ""}`}
        icon={Disc3}
        backTo={club.cityId ? `/cities/${club.cityId}` : "/world"}
        backLabel={cityName ? `Back to ${cityName}` : "Back"}
      />

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
              <Button onClick={handleDjSlot} disabled={busy} className="w-full sm:w-auto">
                {isPerforming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mic2 className="mr-2 h-4 w-4" />}
                Queue for DJ Slot
              </Button>
            </div>
          )}
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
                onPerform={() =>
                  triggerNightlifeEvent({ activityType: "guest_visit", clubName: club.name })
                }
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
              disabled={busy}
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

      {/* DJ Performance Outcome */}
      <Dialog open={showOutcome} onOpenChange={setShowOutcome}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Disc3 className="h-5 w-5 text-primary" /> DJ Set Results
            </DialogTitle>
            <DialogDescription>
              {djOutcome?.clubName && `Your performance at ${djOutcome.clubName}`}
            </DialogDescription>
          </DialogHeader>
          {djOutcome && (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <div className={`text-4xl font-bold ${getScoreColor(djOutcome.performanceScore)}`}>
                  {djOutcome.performanceScore}
                </div>
                <div className="text-sm text-muted-foreground">Performance Score</div>
                <Progress value={djOutcome.performanceScore} className="h-2" />
              </div>
              <div className="rounded-lg bg-card border border-border p-3 text-center">
                <div className="text-lg font-semibold">{djOutcome.outcomeLabel}</div>
                <p className="text-sm text-muted-foreground mt-1">{djOutcome.outcomeDescription}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 rounded-md border border-border p-2">
                  <DollarSign className="h-4 w-4 text-green-400" />
                  <div>
                    <div className="text-sm font-medium">+${djOutcome.cashEarned}</div>
                    <div className="text-[11px] text-muted-foreground">Earnings</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-border p-2">
                  <Star className="h-4 w-4 text-yellow-400" />
                  <div>
                    <div className="text-sm font-medium">+{djOutcome.fameGained}</div>
                    <div className="text-[11px] text-muted-foreground">Fame</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-border p-2">
                  <Users className="h-4 w-4 text-primary" />
                  <div>
                    <div className="text-sm font-medium">+{djOutcome.fansGained}</div>
                    <div className="text-[11px] text-muted-foreground">Fans</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-border p-2">
                  <Zap className="h-4 w-4 text-purple-400" />
                  <div>
                    <div className="text-sm font-medium">+{djOutcome.xpGained}</div>
                    <div className="text-[11px] text-muted-foreground">DJ XP</div>
                  </div>
                </div>
              </div>
              {djOutcome.addictionTriggered && djOutcome.addictionType && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  ⚠️ {djOutcome.addictionType.charAt(0).toUpperCase() + djOutcome.addictionType.slice(1)} addiction{" "}
                  {djOutcome.addictionSeverityGain === 20 ? "triggered" : `worsened (+${djOutcome.addictionSeverityGain})`}!
                </div>
              )}
              <Button className="w-full" onClick={() => setShowOutcome(false)}>Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default NightClubDetail;
