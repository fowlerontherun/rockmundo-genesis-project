import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useActiveProfile } from "@/hooks/useActiveProfile";
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
import { StreakBanner } from "@/features/relationships/components/StreakBanner";
import { FriendActivityFeed } from "@/features/relationships/components/FriendActivityFeed";
import { BestFriendsLeaderboard } from "@/features/relationships/components/BestFriendsLeaderboard";
import { WeeklyRecapCard } from "@/features/relationships/components/WeeklyRecapCard";
import { CoopSuggestionsCard } from "@/features/relationships/components/CoopSuggestionsCard";
import { useEquipmentStore } from "@/hooks/useEquipmentStore";
import { useQueryClient } from "@tanstack/react-query";
import { usePlayerMentorships, useOfferMentorship, useRespondMentorship, useRunMentorSession } from "@/hooks/usePlayerMentorship";
import { GraduationCap } from "lucide-react";
import {
  communicationChannels,
  collaborationOpportunities,
  friendshipMilestones,
  friendshipTiers,
  playerProfileSections,
  privacyControls,
  relationshipStatuses,
  socialRewards,
  socialSpaces,
  tradingOptions,
} from "@/data/socialSystems";

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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getRelationshipStage(rel: CharacterRelationship) {
  const weightedScore =
    rel.affection_score * 0.35 +
    rel.trust_score * 0.3 +
    rel.loyalty_score * 0.2 +
    rel.attraction_score * 0.15 -
    rel.jealousy_score * 0.2;

  if ((rel.relationship_types ?? []).includes("ex_partner")) {
    return {
      label: "Aftermath",
      summary: "The bond still matters, but history and unresolved tension can still shape new storylines.",
      threshold: 0,
    };
  }

  if (weightedScore >= 65) {
    return {
      label: "Inner Circle",
      summary: "This relationship has enough trust to unlock high-value collabs, secrets, and long-term commitments.",
      threshold: 85,
    };
  }

  if (weightedScore >= 35) {
    return {
      label: "Building Momentum",
      summary: "You know each other well enough for meaningful scenes, but consistency still matters.",
      threshold: 65,
    };
  }

  if (weightedScore >= 10) {
    return {
      label: "Getting Familiar",
      summary: "The connection exists, but it still needs shared memories before it becomes strategically valuable.",
      threshold: 35,
    };
  }

  return {
    label: "Unstable Ground",
    summary: "This connection can still be shaped, but one bad interaction could define the tone of the whole arc.",
    threshold: 10,
  };
}

function getMomentumSummary(rel: CharacterRelationship) {
  const composite = rel.trust_score + rel.loyalty_score + Math.max(rel.affection_score, 0) - rel.jealousy_score;
  if (composite >= 170) return "Surging";
  if (composite >= 120) return "Stable";
  if (composite >= 70) return "Fragile";
  return "Volatile";
}

function getRelationshipArchetype(rel: CharacterRelationship) {
  const types = rel.relationship_types ?? [];
  if (types.includes("partner")) return "Power couple";
  if (types.includes("rival") || types.includes("nemesis")) return "Headline rivalry";
  if (types.includes("bandmate")) return "Band chemistry";
  if (types.includes("mentor") || types.includes("protege")) return "Career mentorship";
  if (types.includes("friend") || types.includes("close_friend") || types.includes("best_friend")) return "Trusted ally";
  return "Open social arc";
}

function getRelationshipCompatibility(rel: CharacterRelationship) {
  const value = clamp(
    Math.round(
      rel.trust_score * 0.35 +
      rel.loyalty_score * 0.25 +
      Math.max(rel.affection_score, 0) * 0.2 +
      rel.attraction_score * 0.15 -
      rel.jealousy_score * 0.15,
    ),
    0,
    100,
  );

  if (value >= 80) return { label: "Rare synergy", value };
  if (value >= 60) return { label: "Strong fit", value };
  if (value >= 40) return { label: "Situational", value };
  return { label: "High maintenance", value };
}

function buildRelationshipLoop(rel: CharacterRelationship) {
  const trustGap = Math.max(0, 80 - rel.trust_score);
  const affectionGap = Math.max(0, 70 - Math.max(rel.affection_score, 0));
  const jealousyRisk = rel.jealousy_score >= 70;
  const types = rel.relationship_types ?? [];

  return [
    {
      title: "Private hangout",
      action: "Spend an in-game evening together to reduce decay and create shared memories.",
      effect: `Best for recovering ${Math.min(20, trustGap)} trust points of missing depth before bigger moves.`,
      badge: "Low risk",
    },
    {
      title: types.includes("bandmate") ? "Rehearsal chemistry scene" : "Creative collaboration",
      action: types.includes("bandmate")
        ? "Schedule a rehearsal, backstage talk, or duo warm-up to convert trust into performance bonuses."
        : "Use a songwriting sprint, jam, or guest feature to turn chemistry into gameplay rewards.",
      effect: `Can convert this relationship into +${Math.max(5, Math.round(rel.trust_score * 0.2))}% collab value.`,
      badge: "Progression",
    },
    {
      title: types.includes("partner") ? "Commitment checkpoint" : "Status-defining moment",
      action: types.includes("partner")
        ? "Plan anniversaries, exclusivity decisions, or home/family milestones to deepen commitment."
        : "Use flirting, public support, or loyalty tests to decide whether this turns serious or stalls out.",
      effect: `Needs roughly ${Math.max(0, affectionGap)} more affection pressure to feel secure.`,
      badge: types.includes("partner") ? "Long-term" : "Branching",
    },
    {
      title: "Manage public fallout",
      action: jealousyRisk
        ? "Keep this off the front page or expect drama spikes, rival reactions, and media complications."
        : "Choose whether to go public for buzz or stay private to preserve stability.",
      effect: jealousyRisk ? "Current jealousy makes leaks and misunderstandings especially dangerous." : "Visibility is currently a strategic choice, not a crisis.",
      badge: jealousyRisk ? "Risk" : "Media",
    },
  ];
}

function getRomanceTier(rel: CharacterRelationship) {
  const score = rel.attraction_score * 0.4 + Math.max(rel.affection_score, 0) * 0.3 + rel.trust_score * 0.2 + rel.loyalty_score * 0.1;
  if ((rel.relationship_types ?? []).includes("ex_partner")) {
    return "Former partners";
  }
  if (score >= 78) return "Committed";
  if (score >= 58) return "Serious";
  if (score >= 38) return "Dating";
  return "Flirting";
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
  const queryClient = useQueryClient();
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
  const [giftAmount, setGiftAmount] = useState("");
  const [selectedGearInventoryId, setSelectedGearInventoryId] = useState<string>("");
  const [isSendingMoney, setIsSendingMoney] = useState(false);
  const [isSendingGear, setIsSendingGear] = useState(false);

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
  const { inventory } = useEquipmentStore(profileId ?? undefined);

  // Mentorship hooks
  const { data: mentorships = [] } = usePlayerMentorships();
  const offerMentorship = useOfferMentorship();
  const respondMentorship = useRespondMentorship();
  const runSession = useRunMentorSession();

  const giftableGear = useMemo(() => {
    return inventory.filter((item) => !item.is_equipped);
  }, [inventory]);

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

  const relationshipOverview = useMemo(() => {
    const total = relationships.length || 1;
    const positive = relationships.filter((rel) => deriveStatus(rel) === "positive" || deriveStatus(rel) === "romantic").length;
    const volatile = relationships.filter((rel) => rel.jealousy_score >= 70 || rel.trust_score <= 25).length;
    const collaborators = relationships.filter((rel) => (rel.relationship_types ?? []).some((type) => ["bandmate", "collaborator", "mentor", "protege"].includes(type))).length;

    return {
      positiveRate: Math.round((positive / total) * 100),
      volatile,
      collaborators,
    };
  }, [relationships]);

  // Handle Quick Action click → open InteractionModal
  const handleQuickAction = useCallback((rel: CharacterRelationship) => {
    setInteractionTarget(rel);
    setInteractionModalOpen(true);
  }, []);

  const handleSendMoneyToFriend = useCallback(async () => {
    if (!profileId || !selectedFriendship?.otherProfile?.id) {
      toast.error("Select a friend first");
      return;
    }

    const amount = Number(giftAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setIsSendingMoney(true);
    try {
      const { data: senderProfile, error: senderError } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", profileId)
        .single();

      if (senderError || !senderProfile) throw senderError ?? new Error("Sender profile not found");
      if ((senderProfile.cash ?? 0) < amount) {
        toast.error("You don't have enough cash");
        return;
      }

      const { data: recipientProfile, error: recipientError } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", selectedFriendship.otherProfile.id)
        .single();

      if (recipientError || !recipientProfile) throw recipientError ?? new Error("Friend profile not found");

      const { error: senderUpdateError } = await supabase
        .from("profiles")
        .update({ cash: (senderProfile.cash ?? 0) - amount })
        .eq("id", profileId);

      if (senderUpdateError) throw senderUpdateError;

      const { error: recipientUpdateError } = await supabase
        .from("profiles")
        .update({ cash: (recipientProfile.cash ?? 0) + amount })
        .eq("id", selectedFriendship.otherProfile.id);

      if (recipientUpdateError) throw recipientUpdateError;

      setGiftAmount("");
      await queryClient.invalidateQueries({ queryKey: ["profile", profileId] });
      toast.success(`Sent $${amount.toLocaleString()} to your friend`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send money";
      toast.error("Money transfer failed", { description: message });
    } finally {
      setIsSendingMoney(false);
    }
  }, [giftAmount, profileId, queryClient, selectedFriendship]);

  const handleSendGearToFriend = useCallback(async () => {
    if (!selectedGearInventoryId) {
      toast.error("Choose gear to send");
      return;
    }

    const recipientUserId = selectedFriendship?.otherProfile?.user_id;
    if (!recipientUserId || !profileUserId) {
      toast.error("Missing sender or recipient account");
      return;
    }

    setIsSendingGear(true);
    try {
      const { error } = await supabase
        .from("player_equipment_inventory")
        .update({
          user_id: recipientUserId,
          is_equipped: false,
        })
        .eq("id", selectedGearInventoryId)
        .eq("user_id", profileUserId);

      if (error) throw error;

      const sentItem = giftableGear.find((item) => item.id === selectedGearInventoryId);
      setSelectedGearInventoryId("");
      await queryClient.invalidateQueries({ queryKey: ["player-equipment", profileId] });
      toast.success(`Sent ${sentItem?.equipment?.name ?? "gear"} to your friend`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send gear";
      toast.error("Gear transfer failed", { description: message });
    } finally {
      setIsSendingGear(false);
    }
  }, [giftableGear, profileId, profileUserId, queryClient, selectedFriendship, selectedGearInventoryId]);

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

  if (!activeProfileId) {
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

      <div className="mb-4 space-y-4">
        <StreakBanner />
        <div className="grid gap-4 lg:grid-cols-2">
          <WeeklyRecapCard />
          <CoopSuggestionsCard
            friendProfileIds={friendships
              .filter((f) => f.friendship.status === "accepted" && f.otherProfile?.id)
              .map((f) => f.otherProfile!.id)}
            onSelectFriend={(otherId) => {
              const match = friendships.find((f) => f.otherProfile?.id === otherId);
              if (match) setSelectedFriendship(match);
            }}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <FriendActivityFeed />
          <BestFriendsLeaderboard />
        </div>
      </div>

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
          <TabsTrigger value="systems" className="gap-2"><Sparkles className="h-4 w-4" /> Systems</TabsTrigger>
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

                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base">Support this friend</CardTitle>
                    <CardDescription>Gift cash or send spare gear from your inventory.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="w-full sm:w-56">
                        <p className="text-xs font-medium mb-1">Money gift</p>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          placeholder="Amount in cash"
                          value={giftAmount}
                          onChange={(event) => setGiftAmount(event.target.value)}
                        />
                      </div>
                      <Button onClick={handleSendMoneyToFriend} disabled={isSendingMoney || !giftAmount.trim()}>
                        {isSendingMoney ? "Sending..." : "Send Money"}
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-end gap-2">
                      <div className="w-full sm:w-72">
                        <p className="text-xs font-medium mb-1">Gear gift</p>
                        <Select value={selectedGearInventoryId} onValueChange={setSelectedGearInventoryId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose unequipped gear" />
                          </SelectTrigger>
                          <SelectContent>
                            {giftableGear.length === 0 ? (
                              <SelectItem value="none" disabled>
                                No unequipped gear available
                              </SelectItem>
                            ) : (
                              giftableGear.map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.equipment.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleSendGearToFriend}
                        disabled={isSendingGear || !selectedGearInventoryId || selectedGearInventoryId === "none"}
                      >
                        {isSendingGear ? "Sending..." : "Send Gear"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Mentorship */}
                {(() => {
                  const otherId = selectedFriendship.otherProfile?.id;
                  if (!otherId || !profileId) return null;
                  const existingMentorship = mentorships.find(
                    (m) =>
                      (m.mentor_profile_id === profileId && m.mentee_profile_id === otherId) ||
                      (m.mentee_profile_id === profileId && m.mentor_profile_id === otherId)
                  );
                  const isMentor = existingMentorship?.mentor_profile_id === profileId;

                  return (
                    <Card className="border-social-loyalty/30">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <GraduationCap className="h-4 w-4" /> Mentorship
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {!existingMentorship ? (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => offerMentorship.mutate({ menteeProfileId: otherId, focusSkill: "general" })}
                              disabled={offerMentorship.isPending}
                            >
                              <GraduationCap className="mr-1 h-3 w-3" /> Offer to Mentor
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => offerMentorship.mutate({ menteeProfileId: profileId, focusSkill: "general" })}
                              disabled={offerMentorship.isPending}
                            >
                              Request Mentorship
                            </Button>
                          </div>
                        ) : existingMentorship.status === "pending" ? (
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                              {isMentor ? "Mentorship offer pending acceptance..." : "You've been offered mentorship!"}
                            </p>
                            {!isMentor && (
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => respondMentorship.mutate({ mentorshipId: existingMentorship.id, accept: true })}>
                                  Accept
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => respondMentorship.mutate({ mentorshipId: existingMentorship.id, accept: false })}>
                                  Decline
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : existingMentorship.status === "active" ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span>Focus: <Badge variant="secondary">{existingMentorship.focus_skill}</Badge></span>
                              <span className="text-muted-foreground">{existingMentorship.sessions_completed} sessions</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span>XP granted: <strong>{existingMentorship.xp_granted}</strong></span>
                              <span className="text-xs text-muted-foreground">Role: {isMentor ? "Mentor" : "Mentee"}</span>
                            </div>
                            {isMentor && (
                              <Button
                                size="sm"
                                onClick={() => runSession.mutate({ mentorshipId: existingMentorship.id })}
                                disabled={runSession.isPending}
                              >
                                {runSession.isPending ? "Running..." : "Run Session (+XP)"}
                              </Button>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Mentorship {existingMentorship.status}</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}

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
              const stage = getRelationshipStage(selected);
              const compatibility = getRelationshipCompatibility(selected);
              const gameplayLoop = buildRelationshipLoop(selected);
              const progressValue = clamp(
                Math.round(
                  selected.trust_score * 0.35 +
                  Math.max(selected.affection_score, 0) * 0.3 +
                  selected.loyalty_score * 0.2 +
                  selected.attraction_score * 0.15 -
                  selected.jealousy_score * 0.2,
                ),
                0,
                100,
              );
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
                    <div className="grid gap-3 md:grid-cols-4">
                      {[
                        { label: "Arc", value: getRelationshipArchetype(selected), tone: "text-primary" },
                        { label: "Momentum", value: getMomentumSummary(selected), tone: "text-social-chemistry" },
                        { label: "Compatibility", value: `${compatibility.value}%`, tone: "text-social-love" },
                        { label: "Public Risk", value: `${Math.min(100, Math.round(selected.jealousy_score * 0.7 + (selected.visibility === "public" ? 15 : 0)))}%`, tone: "text-social-tension" },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg border border-border p-3">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
                          <p className={cn("mt-1 text-sm font-semibold", item.tone)}>{item.value}</p>
                        </div>
                      ))}
                    </div>

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

                    <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
                      <div className="rounded-xl border border-border bg-muted/10 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold">Relationship Arc</h3>
                            <p className="text-xs text-muted-foreground mt-1">{stage.summary}</p>
                          </div>
                          <Badge variant="outline">{stage.label}</Badge>
                        </div>
                        <div className="mt-4">
                          <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Progress toward next threshold</span>
                            <span>{progressValue}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-social-friendship via-social-chemistry to-social-love transition-all"
                              style={{ width: `${progressValue}%` }}
                            />
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border border-border/70 p-3">
                            <p className="text-xs font-medium">Next meaningful unlock</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {selected.trust_score < 60
                                ? "Build enough trust to unlock confiding scenes, lower failure rates, and more reliable collabs."
                                : selected.loyalty_score < 70
                                  ? "Stabilize loyalty so this connection survives pressure, touring, and public gossip."
                                  : "You are close to premium outcomes like exclusive duos, public declarations, or legacy decisions."}
                            </p>
                          </div>
                          <div className="rounded-lg border border-border/70 p-3">
                            <p className="text-xs font-medium">What can break it</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {selected.jealousy_score >= 70
                                ? "Jealousy is the danger stat here; public scenes and neglect can quickly cascade into drama."
                                : selected.affection_score < 0
                                  ? "Emotional distance is the weak point; ignoring this relationship will push it into cold territory."
                                  : "The biggest threat is inactivity. Without shared scenes, bonuses decay and the bond loses identity."}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border bg-muted/10 p-4">
                        <h3 className="text-sm font-semibold">Why this relationship matters</h3>
                        <div className="mt-3 space-y-3">
                          {[
                            {
                              label: "Career impact",
                              description: `${selected.trust_score >= 60 ? "Reliable chemistry boosts live and studio consistency." : "Low trust keeps big co-op plays risky."}`,
                            },
                            {
                              label: "Social reputation",
                              description: `${selected.visibility === "public" ? "This bond already affects how the world reads your storyline." : "You can still shape the narrative before going public."}`,
                            },
                            {
                              label: "Long-term branch",
                              description: `${(selected.relationship_types ?? []).includes("partner") ? "This can expand into commitment, marriage, and family gameplay." : "This can still become a romance, rivalry, alliance, or fallout arc."}`,
                            },
                          ].map((item) => (
                            <div key={item.label} className="rounded-lg border border-border/70 p-3">
                              <p className="text-xs font-medium">{item.label}</p>
                              <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                            </div>
                          ))}
                        </div>
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

                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-social-love" />
                        Social Gameplay Loop
                      </h3>
                      <div className="grid gap-3 md:grid-cols-2">
                        {gameplayLoop.map((loop) => (
                          <div key={loop.title} className="rounded-lg border border-border p-4">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium">{loop.title}</p>
                              <Badge variant="outline" className="text-[10px]">{loop.badge}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">{loop.action}</p>
                            <p className="text-xs mt-3 text-foreground/80">{loop.effect}</p>
                          </div>
                        ))}
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
          <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
            <Card className="border-social-love/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-social-love" />
                  Romance Progression Ladder
                </CardTitle>
                <CardDescription>
                  Expand romance into a longer arc with dating, commitment, public image, and family consequences.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {[
                  {
                    title: "Flirting",
                    detail: "Light attraction, chemistry checks, and private scenes that test whether the spark is real.",
                  },
                  {
                    title: "Dating",
                    detail: "Unlocks repeated hangouts, loyalty checks, and early exclusivity tension.",
                  },
                  {
                    title: "Committed",
                    detail: "Shared homes, anniversary upkeep, and stronger consequences when trust is broken.",
                  },
                  {
                    title: "Legacy",
                    detail: "Marriage, children, and public family identity turn romance into a generational system.",
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-lg border border-border p-4">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-2">{item.detail}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-social-chemistry" />
                  Commitment &amp; Family Hooks
                </CardTitle>
                <CardDescription>
                  Relationship depth should feed long-term life simulation, not just one-off romance bonuses.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  "Proposal and exclusivity choices should require trust, loyalty, and time together.",
                  "Marriage should open household perks, family events, and media-story consequences.",
                  "Children and legacy progression should come from stable partnerships and co-parent decisions.",
                  "Breakups should leave emotional residue, rivalries, and public fallout instead of resetting instantly.",
                ].map((item) => (
                  <div key={item} className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

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
                    const compatibility = getRelationshipCompatibility(rel);
                    return (
                      <div key={rel.id} className={cn("rounded-lg border p-4", getStatusGlow(status))}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 rounded-full bg-social-love/20 text-social-love flex items-center justify-center font-bold">
                            {getInitials(rel.entity_b_name)}
                          </div>
                          <div>
                            <p className="font-semibold">{rel.entity_b_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {isActive ? `💕 ${getRomanceTier(rel)}` : "💔 Former Flame"}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <ScoreGauge label="Attraction" value={rel.attraction_score} max={100} color="social-attraction" variant="bar" size="sm" />
                          <ScoreGauge label="Jealousy Risk" value={rel.jealousy_score} max={100} color="social-tension" variant="bar" size="sm" />
                          <ScoreGauge label="Affection" value={Math.max(0, rel.affection_score)} max={100} color="social-love" variant="bar" size="sm" />
                          <ScoreGauge label="Loyalty" value={rel.loyalty_score} max={100} color="social-loyalty" variant="bar" size="sm" />
                        </div>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-lg border border-border/70 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Relationship fit</p>
                            <p className="mt-1 text-sm font-semibold text-social-love">{compatibility.label}</p>
                          </div>
                          <div className="rounded-lg border border-border/70 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Next checkpoint</p>
                            <p className="mt-1 text-sm font-semibold text-social-chemistry">
                              {isActive ? "Anniversary / household arc" : "Dating / exclusivity scene"}
                            </p>
                          </div>
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

        {/* ── SOCIAL SYSTEMS TAB ─────────────────────────────── */}
        <TabsContent value="systems" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-social-friendship/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Network Health</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-social-friendship">{relationshipOverview.positiveRate}%</p>
                <p className="text-xs text-muted-foreground mt-1">of your active connections are positive or romantic.</p>
              </CardContent>
            </Card>
            <Card className="border-social-tension/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Volatile Arcs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-social-tension">{relationshipOverview.volatile}</p>
                <p className="text-xs text-muted-foreground mt-1">connections are at risk of drama spikes or collapse.</p>
              </CardContent>
            </Card>
            <Card className="border-social-chemistry/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Career Links</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-social-chemistry">{relationshipOverview.collaborators}</p>
                <p className="text-xs text-muted-foreground mt-1">connections directly support rehearsals, gigs, mentoring, or collabs.</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-social-trust/20">
            <CardHeader>
              <CardTitle>Social &amp; Relationships Systems Overview</CardTitle>
              <CardDescription>
                A consolidated view of progression, communication, collaboration, and privacy features.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold mb-3">Friendship Tiers</h3>
                <div className="space-y-3">
                  {friendshipTiers.map((tier) => (
                    <div key={tier.level} className="rounded-md border border-border/80 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm">{tier.level}</p>
                        <Badge variant="outline" className="text-[10px]">{tier.range}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">Perks: {tier.perks.join(" • ")}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold mb-3">Relationship Statuses</h3>
                <div className="space-y-2">
                  {relationshipStatuses.map((status) => (
                    <div key={status.name} className="rounded-md border border-border/80 p-3">
                      <p className="text-sm font-medium">{status.icon} {status.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{status.reputation}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold mb-3">Communication Channels</h3>
                <div className="space-y-2">
                  {communicationChannels.map((channel) => (
                    <div key={channel.name} className="rounded-md border border-border/80 p-3">
                      <p className="text-sm font-medium">{channel.icon} {channel.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{channel.features.join(" • ")}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold mb-3">Trading &amp; Sharing</h3>
                <div className="space-y-2">
                  {tradingOptions.map((option) => (
                    <div key={option.title} className="rounded-md border border-border/80 p-3">
                      <p className="text-sm font-medium">{option.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{option.details.join(" • ")}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold mb-3">Collaboration Opportunities</h3>
                <div className="space-y-2">
                  {collaborationOpportunities.map((opportunity) => (
                    <div key={opportunity.name} className="rounded-md border border-border/80 p-3">
                      <p className="text-sm font-medium">{opportunity.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{opportunity.summary}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold mb-3">Profile &amp; Privacy</h3>
                <div className="space-y-2">
                  {playerProfileSections.map((section) => (
                    <div key={section.title} className="rounded-md border border-border/80 p-3">
                      <p className="text-sm font-medium">{section.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{section.description}</p>
                    </div>
                  ))}
                  {privacyControls.map((control) => (
                    <div key={control.name} className="rounded-md border border-border/80 p-3 bg-muted/20">
                      <p className="text-xs font-medium">{control.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{control.options.join(" • ")}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Milestones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {friendshipMilestones.map((milestone) => (
                  <div key={milestone.label} className="rounded-md border border-border p-3">
                    <p className="text-sm font-medium">{milestone.label}</p>
                    <p className="text-xs text-muted-foreground">{milestone.reward}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Social Spaces</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {socialSpaces.map((space) => (
                  <div key={space.name} className="rounded-md border border-border p-3">
                    <p className="text-sm font-medium">{space.name}</p>
                    <p className="text-xs text-muted-foreground">{space.tagline}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Social Rewards</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {socialRewards.map((reward) => (
                  <div key={reward.name} className="rounded-md border border-border p-3">
                    <p className="text-sm font-medium">{reward.name}</p>
                    <p className="text-xs text-muted-foreground">{reward.reward}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
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
