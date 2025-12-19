import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
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

type TabValue = "offers" | "appearances" | "film" | "consultant";

export default function PublicRelations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabValue>("offers");

  // Fetch user's band
  const { data: userBand, isLoading: bandLoading } = useQuery({
    queryKey: ["user-band-pr", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("bands")
        .select("id, name, fame, total_fans, band_balance")
        .eq("leader_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch PR stats
  const { data: prStats } = useQuery({
    queryKey: ["pr-stats", userBand?.id],
    queryFn: async () => {
      if (!userBand?.id) return null;
      
      const [offersResult, appearancesResult] = await Promise.all([
        supabase
          .from("pr_media_offers")
          .select("id, status", { count: "exact" })
          .eq("band_id", userBand.id)
          .eq("status", "pending"),
        supabase
          .from("media_appearances")
          .select("audience_reach")
          .eq("band_id", userBand.id),
      ]);

      const appearances = appearancesResult.data || [];
      const totalReach = appearances.reduce((sum, a) => sum + (a.audience_reach || 0), 0);
      const totalFameGained = 0;
      const totalEarnings = 0;

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

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertDescription>Please sign in to access PR features.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (bandLoading) {
    return (
      <div className="container mx-auto space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!userBand) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertDescription>
            You need to be the leader of an active band to access PR features.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-stage">
      <div className="container mx-auto space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <Megaphone className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-oswald text-2xl sm:text-4xl">Public Relations</h1>
            <p className="text-sm text-muted-foreground">
              Manage media appearances and boost your fame
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <Card className="bg-card/50 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Pending Offers</span>
              </div>
              <p className="mt-1 text-2xl font-bold">{prStats?.pendingOffers || 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground">Fame Gained</span>
              </div>
              <p className="mt-1 text-2xl font-bold">{(prStats?.totalFameGained || 0).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Total Reach</span>
              </div>
              <p className="mt-1 text-2xl font-bold">{(prStats?.totalReach || 0).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-muted-foreground">PR Earnings</span>
              </div>
              <p className="mt-1 text-2xl font-bold">${(prStats?.totalEarnings || 0).toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="offers" className="flex items-center gap-1">
              <Megaphone className="h-4 w-4" />
              <span className="hidden sm:inline">Offers</span>
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
              <span className="hidden sm:inline">PR Agent</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="offers" className="mt-4">
            <PROffersList bandId={userBand.id} bandFame={userBand.fame || 0} />
          </TabsContent>

          <TabsContent value="appearances" className="mt-4">
            <PRAppearanceHistory bandId={userBand.id} />
          </TabsContent>

          <TabsContent value="film" className="mt-4">
            <FilmOffersPanel bandId={userBand.id} bandFame={userBand.fame || 0} userId={user.id} />
          </TabsContent>

          <TabsContent value="consultant" className="mt-4">
            <PRConsultantPanel userId={user.id} bandId={userBand.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
