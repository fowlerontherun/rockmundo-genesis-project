import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useUserBand } from "@/hooks/useUserBand";
import { format } from "date-fns";
import { 
  Newspaper, BookOpen, Podcast, Clock, CheckCircle, XCircle, 
  TrendingUp, Users, DollarSign, Calendar
} from "lucide-react";

interface SubmissionBase {
  id: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  fame_boost: number | null;
  fan_boost: number | null;
  compensation: number | null;
  rejection_reason: string | null;
}

interface NewspaperSubmission extends SubmissionBase {
  interview_type: string;
  newspapers: { name: string; country: string | null } | null;
}

interface MagazineSubmission extends SubmissionBase {
  feature_type: string;
  magazines: { name: string; country: string | null } | null;
}

interface PodcastSubmission extends SubmissionBase {
  episode_topic: string;
  podcasts: { podcast_name: string; country: string | null } | null;
}

const statusConfig = {
  pending: { icon: Clock, color: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30", label: "Pending" },
  approved: { icon: CheckCircle, color: "bg-green-500/20 text-green-600 border-green-500/30", label: "Approved" },
  rejected: { icon: XCircle, color: "bg-red-500/20 text-red-600 border-red-500/30", label: "Rejected" },
  scheduled: { icon: Calendar, color: "bg-blue-500/20 text-blue-600 border-blue-500/30", label: "Scheduled" },
  completed: { icon: CheckCircle, color: "bg-purple-500/20 text-purple-600 border-purple-500/30", label: "Completed" },
};

const PRSubmissionsHistory = () => {
  const { data: userBand, isLoading: bandLoading } = useUserBand();
  const [activeTab, setActiveTab] = useState("newspapers");

  const { data: newspaperSubs, isLoading: newsLoading } = useQuery({
    queryKey: ["newspaper-submissions-history", userBand?.id],
    queryFn: async () => {
      if (!userBand?.id) return [];
      const { data, error } = await supabase
        .from("newspaper_submissions")
        .select("*, newspapers(name, country)")
        .eq("band_id", userBand.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data as NewspaperSubmission[];
    },
    enabled: !!userBand?.id,
  });

  const { data: magazineSubs, isLoading: magLoading } = useQuery({
    queryKey: ["magazine-submissions-history", userBand?.id],
    queryFn: async () => {
      if (!userBand?.id) return [];
      const { data, error } = await supabase
        .from("magazine_submissions")
        .select("*, magazines(name, country)")
        .eq("band_id", userBand.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data as MagazineSubmission[];
    },
    enabled: !!userBand?.id,
  });

  const { data: podcastSubs, isLoading: podLoading } = useQuery({
    queryKey: ["podcast-submissions-history", userBand?.id],
    queryFn: async () => {
      if (!userBand?.id) return [];
      const { data, error } = await supabase
        .from("podcast_submissions")
        .select("*, podcasts(podcast_name, country)")
        .eq("band_id", userBand.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data as PodcastSubmission[];
    },
    enabled: !!userBand?.id,
  });

  const renderStatus = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={config.color}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const renderRewards = (sub: SubmissionBase) => {
    if (sub.status !== "approved" && sub.status !== "completed") return null;
    return (
      <div className="flex flex-wrap gap-2 text-xs mt-2">
        {sub.fame_boost && (
          <span className="flex items-center gap-1 text-primary">
            <TrendingUp className="h-3 w-3" />+{sub.fame_boost} fame
          </span>
        )}
        {sub.fan_boost && (
          <span className="flex items-center gap-1 text-blue-500">
            <Users className="h-3 w-3" />+{sub.fan_boost} fans
          </span>
        )}
        {sub.compensation && (
          <span className="flex items-center gap-1 text-green-500">
            <DollarSign className="h-3 w-3" />${sub.compensation}
          </span>
        )}
      </div>
    );
  };

  if (bandLoading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-10 w-64 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!userBand) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            You need to be in a band to view PR submissions history.
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalPending = (newspaperSubs?.filter(s => s.status === "pending").length || 0) +
    (magazineSubs?.filter(s => s.status === "pending").length || 0) +
    (podcastSubs?.filter(s => s.status === "pending").length || 0);

  const totalApproved = (newspaperSubs?.filter(s => s.status === "approved" || s.status === "completed").length || 0) +
    (magazineSubs?.filter(s => s.status === "approved" || s.status === "completed").length || 0) +
    (podcastSubs?.filter(s => s.status === "approved" || s.status === "completed").length || 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">PR Submissions History</h1>
        <p className="text-muted-foreground">
          Track all your media submission requests for {userBand.name}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{(newspaperSubs?.length || 0) + (magazineSubs?.length || 0) + (podcastSubs?.length || 0)}</p>
            <p className="text-sm text-muted-foreground">Total Submissions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-500">{totalPending}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{totalApproved}</p>
            <p className="text-sm text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">
              {((totalApproved / ((newspaperSubs?.length || 0) + (magazineSubs?.length || 0) + (podcastSubs?.length || 0))) * 100 || 0).toFixed(0)}%
            </p>
            <p className="text-sm text-muted-foreground">Success Rate</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="newspapers" className="flex items-center gap-2">
            <Newspaper className="h-4 w-4" />
            Newspapers ({newspaperSubs?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="magazines" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Magazines ({magazineSubs?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="podcasts" className="flex items-center gap-2">
            <Podcast className="h-4 w-4" />
            Podcasts ({podcastSubs?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="newspapers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="h-5 w-5" />
                Newspaper Submissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {newsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !newspaperSubs?.length ? (
                <p className="text-center text-muted-foreground py-8">No newspaper submissions yet</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {newspaperSubs.map((sub) => (
                      <div key={sub.id} className="p-4 rounded-lg border bg-card">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{sub.newspapers?.name || "Unknown"}</p>
                            <p className="text-sm text-muted-foreground capitalize">
                              {sub.interview_type?.replace("_", " ")} • {sub.newspapers?.country}
                            </p>
                          </div>
                          {renderStatus(sub.status)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Submitted {format(new Date(sub.submitted_at), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                        {sub.rejection_reason && (
                          <p className="text-xs text-destructive mt-1">Reason: {sub.rejection_reason}</p>
                        )}
                        {renderRewards(sub)}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="magazines">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Magazine Submissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {magLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !magazineSubs?.length ? (
                <p className="text-center text-muted-foreground py-8">No magazine submissions yet</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {magazineSubs.map((sub) => (
                      <div key={sub.id} className="p-4 rounded-lg border bg-card">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{sub.magazines?.name || "Unknown"}</p>
                            <p className="text-sm text-muted-foreground capitalize">
                              {sub.feature_type?.replace("_", " ")} • {sub.magazines?.country}
                            </p>
                          </div>
                          {renderStatus(sub.status)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Submitted {format(new Date(sub.submitted_at), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                        {sub.rejection_reason && (
                          <p className="text-xs text-destructive mt-1">Reason: {sub.rejection_reason}</p>
                        )}
                        {renderRewards(sub)}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="podcasts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Podcast className="h-5 w-5" />
                Podcast Submissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {podLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !podcastSubs?.length ? (
                <p className="text-center text-muted-foreground py-8">No podcast submissions yet</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {podcastSubs.map((sub) => (
                      <div key={sub.id} className="p-4 rounded-lg border bg-card">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{sub.podcasts?.podcast_name || "Unknown"}</p>
                            <p className="text-sm text-muted-foreground capitalize">
                              {sub.episode_topic?.replace("_", " ")} • {sub.podcasts?.country}
                            </p>
                          </div>
                          {renderStatus(sub.status)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Submitted {format(new Date(sub.submitted_at), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                        {sub.rejection_reason && (
                          <p className="text-xs text-destructive mt-1">Reason: {sub.rejection_reason}</p>
                        )}
                        {renderRewards(sub)}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PRSubmissionsHistory;
