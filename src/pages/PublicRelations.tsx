import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCardGrid } from "@/components/ui/standard-components";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import {
  Megaphone,
  Tv,
  Radio,
  Mic2,
  Newspaper,
  BookOpen,
  Youtube,
  Film,
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Star,
  Briefcase,
} from "lucide-react";
import { PROffersList } from "@/components/pr/PROffersList";
import { PRAppearanceHistory } from "@/components/pr/PRAppearanceHistory";
import { FilmOffersPanel } from "@/components/pr/FilmOffersPanel";
import { PRConsultantPanel } from "@/components/pr/PRConsultantPanel";
import { SelfPromotionPanel } from "@/components/pr/SelfPromotionPanel";

type TabValue = "offers" | "appearances" | "self-promo" | "film" | "consultant";

export default function PublicRelations() {
  const { profileId, userId } = useActiveProfile();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabValue>("offers");

  // Fetch user's band
  const { data: userBand, isLoading: bandLoading } = useQuery({
    queryKey: ["user-band-pr", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from("bands")
        .select("id, name, fame, total_fans, band_balance")
        .eq("leader_id", profileId)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch PR stats
  const { data: prStats } = useQuery({
    queryKey: ["pr-stats", userBand?.id],
    queryFn: async () => {
      if (!userBand?.id) return null;
      
      const [offersResult, appearancesResult, fameEventsResult, earningsResult] = await Promise.all([
        supabase
          .from("pr_media_offers")
          .select("id, status", { count: "exact" })
          .eq("band_id", userBand.id)
          .eq("status", "pending"),
        supabase
          .from("media_appearances")
          .select("audience_reach")
          .eq("band_id", userBand.id),
        supabase
          .from("band_fame_events")
          .select("fame_gained")
          .eq("band_id", userBand.id)
          .eq("event_type", "pr_appearance"),
        supabase
          .from("band_earnings")
          .select("amount")
          .eq("band_id", userBand.id)
          .eq("source", "pr_appearance"),
      ]);

      const appearances = appearancesResult.data || [];
      const totalReach = appearances.reduce((sum, a) => sum + (a.audience_reach || 0), 0);
      const totalFameGained = (fameEventsResult.data || []).reduce((sum, e) => sum + (e.fame_gained || 0), 0);
      const totalEarnings = (earningsResult.data || []).reduce((sum, e) => sum + (e.amount || 0), 0);

      return {
        pendingOffers: offersResult.count || 0,
        totalAppearances: appearances.length,
        totalReach,
        totalFameGained,
        totalEarnings,
      };
    },
    enabled: !!userBand?.id,
    staleTime: 2 * 60 * 1000,
  });

  if (!userId) {
    return (
      <FMPageScaffold title="Public Relations" icon={Megaphone} backTo="/hub/career">
        <Alert>
          <AlertDescription>Please sign in to access PR features.</AlertDescription>
        </Alert>
      </FMPageScaffold>
    );
  }

  if (bandLoading) {
    return (
      <FMPageScaffold title="Public Relations" icon={Megaphone} backTo="/hub/career">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </FMPageScaffold>
    );
  }

  if (!userBand) {
    return (
      <FMPageScaffold title="Public Relations" icon={Megaphone} backTo="/hub/career">
        <Alert>
          <AlertDescription>
            You need to be the leader of an active band to access PR features.
          </AlertDescription>
        </Alert>
      </FMPageScaffold>
    );
  }

  return (
    <FMPageScaffold
      title="Public Relations"
      subtitle="Manage media appearances and boost your fame"
      icon={Megaphone}
      backTo="/hub/career"
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <MetricCardGrid
          items={[
            { label: "Pending Offers", value: prStats?.pendingOffers || 0, icon: Megaphone },
            { label: "Fame Gained", value: (prStats?.totalFameGained || 0).toLocaleString(), icon: TrendingUp, tone: "success" },
            { label: "Total Reach", value: (prStats?.totalReach || 0).toLocaleString(), icon: Users, tone: "info" },
            { label: "PR Earnings", value: `$${(prStats?.totalEarnings || 0).toLocaleString()}`, icon: DollarSign, tone: "warning" },
          ]}
        />

        {/* Band Stats Bar */}
        <Card className="bg-card/50 backdrop-blur">
          <CardContent className="flex flex-wrap items-center gap-4 p-4">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-medium">{userBand.name}</span>
            </div>
            <Badge variant="secondary">
              <TrendingUp className="mr-1 h-3 w-3" />
              Fame: {(userBand.fame || 0).toLocaleString()}
            </Badge>
            <Badge variant="secondary">
              <Users className="mr-1 h-3 w-3" />
              Fans: {(userBand.total_fans || 0).toLocaleString()}
            </Badge>
            <Badge variant="secondary">
              <DollarSign className="mr-1 h-3 w-3" />
              Balance: ${(userBand.band_balance || 0).toLocaleString()}
            </Badge>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="offers" className="flex items-center gap-1">
              <Megaphone className="h-4 w-4" />
              <span className="hidden sm:inline">Offers</span>
            </TabsTrigger>
            <TabsTrigger value="self-promo" className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">DIY</span>
            </TabsTrigger>
            <TabsTrigger value="appearances" className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
            <TabsTrigger value="film" className="flex items-center gap-1">
              <Film className="h-4 w-4" />
              <span className="hidden sm:inline">Film</span>
            </TabsTrigger>
            <TabsTrigger value="consultant" className="flex items-center gap-1">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Agent</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="offers" className="mt-4">
            <PROffersList bandId={userBand.id} bandFame={userBand.fame || 0} />
          </TabsContent>

          <TabsContent value="self-promo" className="mt-4">
            <SelfPromotionPanel bandId={userBand.id} bandFame={userBand.fame || 0} bandBalance={userBand.band_balance || 0} userId={userId} />
          </TabsContent>

          <TabsContent value="appearances" className="mt-4">
            <PRAppearanceHistory bandId={userBand.id} />
          </TabsContent>

          <TabsContent value="film" className="mt-4">
            <FilmOffersPanel bandId={userBand.id} bandFame={userBand.fame || 0} userId={userId} />
          </TabsContent>

          <TabsContent value="consultant" className="mt-4">
            <PRConsultantPanel profileId={profileId || ""} bandId={userBand.id} />
          </TabsContent>
        </Tabs>
      </div>
    </FMPageScaffold>
  );
}
