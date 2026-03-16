import { useState, useMemo, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Users, Swords, Music, Sparkles, Search,
  Flame, Theater, Baby, Activity, TrendingUp,
  Shield, Zap, Star, Crown, AlertCircle,
  UserPlus, MessageSquare, Gift, Handshake,
} from "lucide-react";
import { PageLayout } from "@/components/ui/PageLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScoreGauge } from "@/components/social/ScoreGauge";
import { InteractionModal, type InteractionOption, type InteractionResult } from "@/components/social/InteractionModal";
import { useCharacterRelationships, useLogInteraction } from "@/hooks/useCharacterRelationships";
import { useSocialDramaEvents } from "@/hooks/useSocialDramaGenerator";
import { useEmotionalState, useEmotionalModifiers } from "@/hooks/useEmotionalEngine";
import { useOptionalGameData } from "@/hooks/useGameData";
import { useAuth } from "@/hooks/use-auth-context";
import { useFriendships } from "@/features/relationships/hooks/useFriendships";
import { FriendshipList } from "@/features/relationships/components/FriendshipList";
import { FriendSearchDialog } from "@/features/relationships/components/FriendSearchDialog";
import { DirectMessagePanel } from "@/features/relationships/components/DirectMessagePanel";
import { resolveRelationshipPairKey } from "@/features/relationships/api";
import { INTERACTION_PRESETS } from "@/types/character-relationships";
import type { CharacterRelationship } from "@/types/character-relationships";
import type { DecoratedFriendship } from "@/features/relationships/types";
import { formatDistanceToNow } from "date-fns";
import { FamilyDashboard } from "@/components/family/FamilyDashboard";

// ── Filter categories ─────────────────────────────────────────
const FILTER_CATEGORIES = [
  { key: "all", label: "All", icon: Users },
  { key: "friend", label: "Friends", icon: Heart },
  { key: "rival", label: "Rivals", icon: Swords },
  { key: "partner", label: "Romance", icon: Flame },
  { key: "bandmate", label: "Bandmates", icon: Music },
  { key: "mentor", label: "Mentors", icon: Star },
  { key: "ex_partner", label: "Exes", icon: Theater },
];

// ── Quick Action → Interaction Preset mapping ─────────────────
const QUICK_ACTION_MAP: Record<string, { presetKey: string; label: string; icon: React.ReactNode; description: string }> = {
  Chat: { presetKey: "casual_chat", label: "Casual Chat", icon: <MessageSquare className="h-4 w-4 text-social-friendship" />, description: "Have a friendly conversation" },
  Gift: { presetKey: "gift", label: "Send a Gift", icon: <Gift className="h-4 w-4 text-social-love" />, description: "Give a thoughtful gift to strengthen your bond" },
  Collaborate: { presetKey: "collaboration", label: "Propose Collaboration", icon: <Handshake className="h-4 w-4 text-social-chemistry" />, description: "Work together on music" },
  Challenge: { presetKey: "competition", label: "Friendly Challenge", icon: <Swords className="h-4 w-4 text-social-rivalry" />, description: "Challenge them to a musical duel" },
  Flirt: { presetKey: "flirt", label: "Flirt", icon: <Heart className="h-4 w-4 text-social-love" />, description: "Show romantic interest" },
  Confront: { presetKey: "argument", label: "Confront", icon: <Zap className="h-4 w-4 text-social-tension" />, description: "Address an issue head-on" },
};

// ── Visual helpers ─────────────────────────────────────────────
function deriveStatus(rel: CharacterRelationship): string {
  const types = rel.relationship_types ?? [];
  if (types.includes("partner")) return "romantic";
  if (types.includes("rival") || types.includes("nemesis")) return "negative";
  if (types.includes("ex_partner") || rel.jealousy_score > 60) return "tense";
  return "positive";
}

function getStatusGlow(status: string) {
  switch (status) {
    case "positive": return "border-social-friendship/40 shadow-[0_0_12px_hsl(var(--social-friendship)/0.15)]";
    case "romantic": return "border-social-love/40 shadow-[0_0_12px_hsl(var(--social-love)/0.15)]";
    case "negative": return "border-social-rivalry/40 shadow-[0_0_12px_hsl(var(--social-rivalry)/0.15)]";
    case "tense": return "border-social-tension/40 shadow-[0_0_12px_hsl(var(--social-tension)/0.15)]";
    default: return "border-border";
  }
}

function getTypeColor(type: string) {
  switch (type) {
    case "friend": case "close_friend": case "best_friend": return "bg-social-friendship/20 text-social-friendship border-social-friendship/30";
    case "rival": case "nemesis": return "bg-social-rivalry/20 text-social-rivalry border-social-rivalry/30";
    case "partner": return "bg-social-love/20 text-social-love border-social-love/30";
    case "bandmate": return "bg-social-chemistry/20 text-social-chemistry border-social-chemistry/30";
    case "mentor": case "protege": return "bg-social-loyalty/20 text-social-loyalty border-social-loyalty/30";
    case "ex_partner": return "bg-social-tension/20 text-social-tension border-social-tension/30";
    case "collaborator": return "bg-social-trust/20 text-social-trust border-social-trust/30";
    case "fan": return "bg-social-attraction/20 text-social-attraction border-social-attraction/30";
    case "business_contact": return "bg-muted text-muted-foreground border-border";
    default: return "bg-muted text-muted-foreground";
  }
}

function getInitials(name: string) {
  return name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function getSeverityStyle(severity: string) {
  switch (severity) {
    case "explosive": return "border-social-love/40 bg-social-love/5";
    case "major": return "border-social-tension/40 bg-social-tension/5";
    case "moderate": return "border-social-chemistry/20 bg-social-chemistry/5";
    default: return "border-border";
  }
}

// Build InteractionOption from a quick action
function buildInteractionOption(actionKey: string, rel: CharacterRelationship): InteractionOption {
  const mapping = QUICK_ACTION_MAP[actionKey];
  const preset = INTERACTION_PRESETS[mapping.presetKey];
  const impacts = Object.entries(preset)
    .filter(([_, v]) => v !== 0)
    .map(([k, v]) => ({
      label: k.replace("_change", "").replace("_", " "),
      change: v as number,
    }));

  // Success probability based on trust and affection
  const baseProb = 50 + (rel.trust_score / 4) + (rel.affection_score / 5);
  const prob = Math.min(95, Math.max(10, Math.round(baseProb)));

  return {
    id: mapping.presetKey,
    label: mapping.label,
    description: mapping.description,
    icon: mapping.icon,
    successProbability: prob,
    emotionalImpact: impacts,
  };
}

// ── Main Page ──────────────────────────────────────────────────
export default function RelationshipsPage() {
  const { profileId: activeProfileId } = useActiveProfile();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;
  const profileUserId = gameData?.profile?.user_id;

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Friends state
  const [selectedFriendship, setSelectedFriendship] = useState<DecoratedFriendship | null>(null);
  const [friendSearchOpen, setFriendSearchOpen] = useState(false);

  // Interaction modal state
  const [interactionTarget, setInteractionTarget] = useState<CharacterRelationship | null>(null);
  const [interactionModalOpen, setInteractionModalOpen] = useState(false);

  // Real data hooks
  const { data: relationships = [], isLoading: relsLoading } = useCharacterRelationships();
  const { data: dramaEvents = [], isLoading: dramaLoading } = useSocialDramaEvents(profileId);
  const { data: emotionalState, isLoading: emotionLoading } = useEmotionalState();
  const { songwritingModifier, performanceModifier, interactionModifier } = useEmotionalModifiers();
  const logInteraction = useLogInteraction();

  // Friends hooks
  const {
    friendships,
    loading: friendsLoading,
    acceptRequest,
    declineRequest,
    removeFriend,
    sendRequest,
  } = useFriendships(profileId);

  // Pending friend request count for badge
  const pendingCount = useMemo(() => {
    return friendships.filter(f => f.friendship.status === "pending" && !f.isRequester).length;
  }, [friendships]);

  // Exclude already-connected profile IDs from friend search
  const excludeProfileIds = useMemo(() => {
    const ids = friendships.map(f => f.otherProfile?.id).filter(Boolean) as string[];
    if (profileId) ids.push(profileId);
    return ids;
  }, [friendships, profileId]);

  // DM channel for selected friend
  const dmChannel = useMemo(() => {
    if (!selectedFriendship?.otherProfile?.id || !profileId) return null;
    return `dm:${resolveRelationshipPairKey(profileId, selectedFriendship.otherProfile.id)}`;
  }, [selectedFriendship, profileId]);

  // Filter relationships
  const filtered = useMemo(() => {
    return relationships.filter((r) => {
      if (filter !== "all" && !(r.relationship_types ?? []).includes(filter as any)) return false;
      if (search && !r.entity_b_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [relationships, filter, search]);

  const selected = useMemo(() => {
    if (!selectedId) return filtered[0] ?? null;
    return relationships.find((r) => r.id === selectedId) ?? null;
  }, [relationships, filtered, selectedId]);

  // Romance tab
  const romanticRelationships = useMemo(() => {
    return relationships.filter(r => {
      const types = r.relationship_types ?? [];
      return types.includes("partner") || types.includes("ex_partner");
    });
  }, [relationships]);

  // Handle Quick Action click → open InteractionModal
  const handleQuickAction = useCallback((rel: CharacterRelationship) => {
    setInteractionTarget(rel);
    setInteractionModalOpen(true);
  }, []);

  // Handle interaction selection from modal
  const handleInteractionSelect = useCallback(async (optionId: string): Promise<InteractionResult> => {
    if (!interactionTarget || !profileId) {
      return { success: false, title: "Error", description: "Missing data", impacts: [] };
    }

    const preset = INTERACTION_PRESETS[optionId];
    if (!preset) {
      return { success: false, title: "Error", description: "Unknown interaction", impacts: [] };
    }

    // Roll for success
    const baseProb = 50 + (interactionTarget.trust_score / 4) + (interactionTarget.affection_score / 5);
    const prob = Math.min(95, Math.max(10, baseProb));
    const roll = Math.random() * 100;
    const success = roll <= prob;

    // Scale changes based on success/failure
    const multiplier = success ? 1 : -0.5;
    const changes = {
      affection_change: Math.round((preset.affection_change ?? 0) * multiplier),
      trust_change: Math.round((preset.trust_change ?? 0) * multiplier),
      attraction_change: Math.round((preset.attraction_change ?? 0) * multiplier),
      loyalty_change: Math.round((preset.loyalty_change ?? 0) * multiplier),
      jealousy_change: preset.jealousy_change ?? 0,
    };

    try {
      await logInteraction.mutateAsync({
        relationship_id: interactionTarget.id,
        interaction_type: optionId,
        description: `${success ? "Successful" : "Failed"} ${optionId.replace(/_/g, " ")} with ${interactionTarget.entity_b_name}`,
        initiated_by: profileId,
        ...changes,
      });
    } catch {
      return { success: false, title: "Error", description: "Failed to log interaction", impacts: [] };
    }

    const impacts = Object.entries(changes)
      .filter(([_, v]) => v !== 0)
      .map(([k, v]) => ({
        label: k.replace("_change", "").replace(/_/g, " "),
        change: v,
      }));

    return {
      success,
      title: success ? "Success!" : "It didn't go well...",
      description: success
        ? `Your ${optionId.replace(/_/g, " ")} with ${interactionTarget.entity_b_name} went great!`
        : `Your ${optionId.replace(/_/g, " ")} with ${interactionTarget.entity_b_name} backfired.`,
      impacts,
    };
  }, [interactionTarget, profileId, logInteraction]);

  // Build interaction options for selected target
  const interactionOptions = useMemo(() => {
    if (!interactionTarget) return [];
    return Object.keys(QUICK_ACTION_MAP).map(key => buildInteractionOption(key, interactionTarget));
  }, [interactionTarget]);

  if (!user) {
    return (
      <div className="container mx-auto py-20 text-center">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
        <p className="text-lg font-medium text-muted-foreground">Log in to view your relationships</p>
      </div>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title="Social & Relationships"
        subtitle="Manage your connections, track chemistry, and navigate the drama of the music world."
        backTo="/hub/world-social"
        backLabel="Back to World & Social"
        icon={Heart}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {friendships.filter(f => f.friendship.status === "accepted").length} friends
            </Badge>
            <Badge variant="outline" className="text-xs">
              {relationships.length} connections
            </Badge>
          </div>
        }
      />

      {/* Main Tabs */}
      <Tabs defaultValue="friends" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="friends" className="gap-2 relative">
            <UserPlus className="h-4 w-4" /> Friends
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-social-love text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="network" className="gap-2"><Users className="h-4 w-4" /> Network</TabsTrigger>
          <TabsTrigger value="drama" className="gap-2"><Theater className="h-4 w-4" /> Drama Feed</TabsTrigger>
          <TabsTrigger value="romance" className="gap-2"><Flame className="h-4 w-4" /> Romance</TabsTrigger>
          <TabsTrigger value="legacy" className="gap-2"><Baby className="h-4 w-4" /> Family</TabsTrigger>
        </TabsList>

        {/* ── FRIENDS TAB ──────────────────────────────────────── */}
        <TabsContent value="friends" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Your Friends</h2>
              <p className="text-sm text-muted-foreground">Manage friendships, accept requests, and chat with other players</p>
            </div>
            <Button onClick={() => setFriendSearchOpen(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Find Players
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr,1.4fr] gap-4">
            {/* Friend List */}
            <FriendshipList
              friendships={friendships}
              loading={friendsLoading}
              onSelect={(f) => setSelectedFriendship(f)}
              selectedFriendshipId={selectedFriendship?.friendship.id ?? null}
              onAccept={acceptRequest}
              onDecline={declineRequest}
              onRemove={removeFriend}
            />

            {/* Friend Detail + DM Panel */}
            {selectedFriendship && selectedFriendship.friendship.status === "accepted" && dmChannel && profileUserId ? (
              <div className="space-y-4">
                {/* Friend Info Card */}
                <Card className="border-social-friendship/30">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-social-friendship/20 text-social-friendship flex items-center justify-center text-lg font-bold">
                        {getInitials(selectedFriendship.otherProfile?.display_name || selectedFriendship.otherProfile?.username || "?")}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold">
                          {selectedFriendship.otherProfile?.display_name || selectedFriendship.otherProfile?.username}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            Level {selectedFriendship.otherProfile?.level ?? 1}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            ⭐ {selectedFriendship.otherProfile?.fame?.toLocaleString() ?? 0} fame
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* DM Panel */}
                <DirectMessagePanel
                  channel={dmChannel}
                  currentUserId={profileUserId}
                  otherDisplayName={selectedFriendship.otherProfile?.display_name || selectedFriendship.otherProfile?.username || "Friend"}
                />
              </div>
            ) : (
              <Card className="flex items-center justify-center h-full min-h-[400px]">
                <CardContent className="text-center text-muted-foreground py-20">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium">Select a friend to start chatting</p>
                  <p className="text-xs mt-1">Accept pending requests or find new players to connect with</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Friend Search Dialog */}
          <FriendSearchDialog
            open={friendSearchOpen}
            onOpenChange={setFriendSearchOpen}
            excludeProfileIds={excludeProfileIds}
            onSelectProfile={sendRequest}
          />
        </TabsContent>

        {/* ── NETWORK TAB ──────────────────────────────────────── */}
        <TabsContent value="network" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {FILTER_CATEGORIES.map((cat) => (
              <Button
                key={cat.key}
                size="sm"
                variant={filter === cat.key ? "default" : "outline"}
                onClick={() => setFilter(cat.key)}
                className="gap-1.5 text-xs"
              >
                <cat.icon className="h-3.5 w-3.5" />
                {cat.label}
              </Button>
            ))}
            <div className="ml-auto relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search connections..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-56 h-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr,1.4fr] gap-4">
            {/* Relationship List */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Connections</CardTitle>
                <CardDescription>{relsLoading ? "Loading..." : `${filtered.length} shown`}</CardDescription>
              </CardHeader>
              <ScrollArea className="h-[520px]">
                <CardContent className="space-y-2 pr-4">
                  {relsLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))
                  ) : filtered.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No connections found</p>
                      <p className="text-xs mt-1">Interact with NPCs and players to build relationships</p>
                    </div>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {filtered.map((rel) => {
                        const status = deriveStatus(rel);
                        return (
                          <motion.div
                            key={rel.id}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                          >
                            <button
                              onClick={() => setSelectedId(rel.id)}
                              className={cn(
                                "w-full text-left p-3 rounded-lg border transition-all duration-200 hover:bg-accent/50",
                                selectedId === rel.id || (!selectedId && selected?.id === rel.id) ? getStatusGlow(status) : "border-border",
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
                                  status === "romantic" ? "bg-social-love/20 text-social-love" :
                                  status === "negative" ? "bg-social-rivalry/20 text-social-rivalry" :
                                  "bg-primary/20 text-primary"
                                )}>
                                  {getInitials(rel.entity_b_name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{rel.entity_b_name}</p>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {(rel.relationship_types ?? []).map((t) => (
                                      <Badge key={t} variant="outline" className={cn("text-[10px] px-1.5 py-0", getTypeColor(t))}>
                                        {t.replace(/_/g, " ")}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground capitalize">{rel.entity_b_type}</p>
                                  {rel.last_interaction_at && (
                                    <p className="text-[10px] text-muted-foreground">
                                      {formatDistanceToNow(new Date(rel.last_interaction_at), { addSuffix: true })}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </button>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  )}
                </CardContent>
              </ScrollArea>
            </Card>

            {/* Detail Panel */}
            {selected ? (() => {
              const status = deriveStatus(selected);
              return (
                <Card className={cn("border transition-all duration-300", getStatusGlow(status))}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold",
                          status === "romantic" ? "bg-social-love/20 text-social-love" :
                          status === "negative" ? "bg-social-rivalry/20 text-social-rivalry" :
                          "bg-primary/20 text-primary"
                        )}>
                          {getInitials(selected.entity_b_name)}
                        </div>
                        <div>
                          <CardTitle className="text-xl">{selected.entity_b_name}</CardTitle>
                          <CardDescription>
                            {selected.entity_b_type} • {(selected.relationship_types ?? []).map(t => t.replace(/_/g, " ")).join(", ")}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        {(selected.relationship_types ?? []).map((t) => (
                          <Badge key={t} className={cn("text-xs", getTypeColor(t))}>
                            {t.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Emotional Metrics */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-social-chemistry" />
                        Emotional Metrics
                      </h3>
                      <div className="grid grid-cols-5 gap-3">
                        <ScoreGauge label="Affection" value={selected.affection_score} max={100} min={-100} color="social-love" variant="bar" size="sm" glowOnHigh />
                        <ScoreGauge label="Trust" value={selected.trust_score} max={100} color="social-trust" variant="bar" size="sm" glowOnHigh />
                        <ScoreGauge label="Attraction" value={selected.attraction_score} max={100} color="social-attraction" variant="bar" size="sm" />
                        <ScoreGauge label="Loyalty" value={selected.loyalty_score} max={100} color="social-loyalty" variant="bar" size="sm" glowOnHigh />
                        <ScoreGauge label="Jealousy" value={selected.jealousy_score} max={100} color="social-tension" variant="bar" size="sm" />
                      </div>
                    </div>

                    {/* Quick Actions — now wired to InteractionModal */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        Quick Actions
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {Object.keys(QUICK_ACTION_MAP).map((action) => (
                          <Button
                            key={action}
                            size="sm"
                            variant="outline"
                            className="text-xs gap-1.5"
                            onClick={() => handleQuickAction(selected)}
                          >
                            {QUICK_ACTION_MAP[action].icon}
                            {action}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Gameplay Modifiers */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg border border-border p-3 text-center">
                        <p className="text-xs text-muted-foreground">Song Quality</p>
                        <p className="text-lg font-bold text-social-chemistry">
                          {(0.7 + selected.trust_score / 200 + selected.loyalty_score / 300).toFixed(2)}x
                        </p>
                      </div>
                      <div className="rounded-lg border border-border p-3 text-center">
                        <p className="text-xs text-muted-foreground">Collab Bonus</p>
                        <p className="text-lg font-bold text-social-trust">
                          +{Math.round(selected.affection_score * 0.3 + selected.trust_score * 0.2)}%
                        </p>
                      </div>
                      <div className="rounded-lg border border-border p-3 text-center">
                        <p className="text-xs text-muted-foreground">Drama Risk</p>
                        <p className="text-lg font-bold text-social-tension">
                          {Math.min(100, Math.round(selected.jealousy_score * 0.8 + (100 - selected.trust_score) * 0.2))}%
                        </p>
                      </div>
                    </div>

                    {/* Visibility & metadata */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">{selected.visibility}</Badge>
                      {selected.last_interaction_at && (
                        <span>Last interaction: {formatDistanceToNow(new Date(selected.last_interaction_at), { addSuffix: true })}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })() : (
              <Card className="flex items-center justify-center h-full">
                <CardContent className="text-center text-muted-foreground py-20">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>{relsLoading ? "Loading connections..." : "Select a connection to view details"}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── DRAMA FEED TAB ──────────────────────────────────── */}
        <TabsContent value="drama" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Theater className="h-5 w-5 text-social-tension" />
                  Drama &amp; Media Feed
                </CardTitle>
                <CardDescription>Latest relationship events and scandals in the music world</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dramaLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))
                ) : dramaEvents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Theater className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No drama events yet</p>
                    <p className="text-xs mt-1">Events will appear here as social drama unfolds in the game world</p>
                  </div>
                ) : (
                  dramaEvents.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn("p-4 rounded-lg border transition-all", getSeverityStyle(item.severity))}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.headline}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-[10px]">{item.drama_category}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                            </span>
                            {item.streaming_multiplier !== 1 && (
                              <Badge variant="secondary" className="text-[10px]">
                                🎵 {item.streaming_multiplier.toFixed(1)}x streams
                              </Badge>
                            )}
                            {item.fame_change !== 0 && (
                              <Badge variant="secondary" className="text-[10px]">
                                ⭐ {item.fame_change > 0 ? "+" : ""}{item.fame_change} fame
                              </Badge>
                            )}
                          </div>
                        </div>
                        {item.went_viral && (
                          <Badge className="bg-social-love/20 text-social-love border-social-love/30 text-[10px] animate-pulse">
                            🔥 VIRAL
                          </Badge>
                        )}
                        {!item.went_viral && item.severity === "major" && (
                          <Badge className="bg-social-tension/20 text-social-tension border-social-tension/30 text-[10px]">
                            ⚡ MAJOR
                          </Badge>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Trending Sidebar */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-social-chemistry" />
                  Trending
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dramaEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No trending topics yet</p>
                ) : (
                  dramaEvents
                    .filter(e => e.twaater_hashtag)
                    .slice(0, 5)
                    .map((e) => (
                      <div key={e.id} className="flex items-center justify-between">
                        <span className="text-sm text-social-chemistry font-medium truncate">{e.twaater_hashtag}</span>
                        <Badge variant="outline" className="text-[10px]">{e.severity}</Badge>
                      </div>
                    ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── ROMANCE TAB ─────────────────────────────────────── */}
        <TabsContent value="romance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-social-love" />
                Romantic Connections
              </CardTitle>
              <CardDescription>Track your romantic progressions and compatibility</CardDescription>
            </CardHeader>
            <CardContent>
              {relsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
                </div>
              ) : romanticRelationships.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Flame className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No romantic connections yet</p>
                  <p className="text-xs mt-1">Build attraction with characters to start a romance</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {romanticRelationships.map((rel) => {
                    const status = deriveStatus(rel);
                    const isActive = (rel.relationship_types ?? []).includes("partner");
                    return (
                      <div key={rel.id} className={cn("rounded-lg border p-4", getStatusGlow(status))}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 rounded-full bg-social-love/20 text-social-love flex items-center justify-center font-bold">
                            {getInitials(rel.entity_b_name)}
                          </div>
                          <div>
                            <p className="font-semibold">{rel.entity_b_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {isActive ? "💕 Active Romance" : "💔 Former Flame"}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <ScoreGauge label="Attraction" value={rel.attraction_score} max={100} color="social-attraction" variant="bar" size="sm" />
                          <ScoreGauge label="Jealousy Risk" value={rel.jealousy_score} max={100} color="social-tension" variant="bar" size="sm" />
                          <ScoreGauge label="Affection" value={Math.max(0, rel.affection_score)} max={100} color="social-love" variant="bar" size="sm" />
                          <ScoreGauge label="Loyalty" value={rel.loyalty_score} max={100} color="social-loyalty" variant="bar" size="sm" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── FAMILY TAB ──────────────────────────────────────── */}
        <TabsContent value="legacy" className="space-y-4">
          <FamilyDashboard />
        </TabsContent>
      </Tabs>

      {/* Emotional State Widget (real data) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-social-chemistry/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-social-chemistry" />
              Your Emotional State
            </CardTitle>
          </CardHeader>
          <CardContent>
            {emotionLoading ? (
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Happiness", value: emotionalState?.happiness ?? 50, color: "social-friendship" },
                  { label: "Loneliness", value: emotionalState?.loneliness ?? 0, color: "social-trust" },
                  { label: "Inspiration", value: emotionalState?.inspiration ?? 50, color: "social-chemistry" },
                  { label: "Jealousy", value: emotionalState?.jealousy ?? 0, color: "social-tension" },
                  { label: "Resentment", value: emotionalState?.resentment ?? 0, color: "social-rivalry" },
                  { label: "Obsession", value: emotionalState?.obsession ?? 0, color: "social-love" },
                ].map((e) => (
                  <ScoreGauge key={e.label} label={e.label} value={e.value} max={100} color={e.color} variant="bar" size="sm" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-social-trust" />
              Gameplay Modifiers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                label: "Songwriting Quality",
                value: `${songwritingModifier >= 1 ? "+" : ""}${((songwritingModifier - 1) * 100).toFixed(0)}%`,
                desc: "Based on your emotional state",
              },
              {
                label: "Performance Energy",
                value: `${performanceModifier >= 1 ? "+" : ""}${((performanceModifier - 1) * 100).toFixed(0)}%`,
                desc: "How your emotions affect live shows",
              },
              {
                label: "Interaction Success",
                value: `${interactionModifier >= 1 ? "+" : ""}${((interactionModifier - 1) * 100).toFixed(0)}%`,
                desc: "Chance boost for social interactions",
              },
              {
                label: "Active Relationships",
                value: String(relationships.length),
                desc: "Total character connections",
              },
            ].map((mod) => (
              <div key={mod.label} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">{mod.label}</p>
                  <p className="text-xs text-muted-foreground">{mod.desc}</p>
                </div>
                <Badge variant="secondary" className="font-mono">{mod.value}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Interaction Modal */}
      <InteractionModal
        open={interactionModalOpen}
        onOpenChange={setInteractionModalOpen}
        title="Interact"
        subtitle={interactionTarget ? `Choose how to interact with ${interactionTarget.entity_b_name}` : undefined}
        targetName={interactionTarget?.entity_b_name ?? ""}
        options={interactionOptions}
        onSelectOption={handleInteractionSelect}
        isProcessing={logInteraction.isPending}
      />
    </PageLayout>
  );
}
