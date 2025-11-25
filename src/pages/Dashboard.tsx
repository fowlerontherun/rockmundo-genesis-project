import { useState, useEffect, useMemo, type ReactNode } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  Users,
  TrendingUp,
  Guitar,
  DollarSign,
  Star,
  AlertCircle,
  Sparkles,
  MessageSquare,
  Bell,
  Calendar,
} from "lucide-react";
import { useGameData } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";
import RealtimeChatPanel from "@/components/chat/RealtimeChatPanel";
import { CurrentLocationWidget } from "@/components/city/CurrentLocationWidget";
import type { Database } from "@/lib/supabase-types";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlayerPresenceStats } from "@/hooks/usePlayerPresenceStats";
import { GameDateWidget } from "@/components/calendar/GameDateWidget";
import { DaySchedule } from "@/components/schedule/DaySchedule";
import { useRecentSkillImprovements } from "@/hooks/useRecentSkillImprovements";
import { TrendingUp as TrendingUpIcon } from "lucide-react";
import { deriveCityChannel } from "@/utils/chat";

type ChatScope = "general" | "city";

interface ActivityEntry {
  id: string;
  activity_type: string;
  message: string;
  created_at: string;
  earnings: number;
  metadata?: Record<string, unknown> | null;
}

interface DashboardNotification {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  iconClasses: string;
  timestamp?: string;
}

const formatNotificationDate = (isoString: string | null | undefined) => {
  if (!isoString) return undefined;
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

const formatSkillName = (slug: string) =>
  slug
    .split(/[_-]/)
    .filter(segment => segment.length > 0)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const Dashboard = () => {
  const [currentTab, setCurrentTab] = useState<ChatScope>("general");
  const { profile, skills, loading: gameDataLoading } = useGameData();
  const { onlinePlayers, totalPlayers } = usePlayerPresenceStats();

  const [activityFeed, setActivityFeed] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [currentCity, setCurrentCity] = useState<{
    id: string;
    name: string;
    country: string;
    music_scene: number;
  } | null>(null);
  const [cityLoading, setCityLoading] = useState(false);

  useEffect(() => {
    const fetchActivity = async () => {
      if (!profile?.user_id) return;
      setActivityLoading(true);

      const { data } = await supabase
        .from("activity_feed")
        .select("*")
        .eq("user_id", profile.user_id)
        .order("created_at", { ascending: false })
        .limit(10);

      setActivityFeed((data || []) as ActivityEntry[]);
      setActivityLoading(false);
    };

    fetchActivity();
  }, [profile?.user_id]);

  useEffect(() => {
    const fetchCity = async () => {
      if (!profile?.current_city_id) return;
      setCityLoading(true);

      const { data } = await supabase
        .from("cities")
        .select("id, name, country, music_scene")
        .eq("id", profile.current_city_id)
        .single();

      setCurrentCity(data);
      setCityLoading(false);
    };

    fetchCity();
  }, [profile?.current_city_id]);

  const { data: recentImprovements = [] } = useRecentSkillImprovements(profile?.user_id, 24);
  const dashboardNotifications: DashboardNotification[] = [];

  if (gameDataLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Profile Not Found</AlertTitle>
          <AlertDescription>Unable to load your profile data.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
      

      {/* Top Stats Row - Most Important */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs md:text-sm font-medium flex items-center gap-2">
              <Star className="h-3 w-3 md:h-4 md:w-4 text-primary" />
              Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">Lvl {profile.level || 1}</div>
            <Progress value={(profile.experience || 0) % 100} className="mt-2 h-1.5" />
            <p className="text-xs text-muted-foreground mt-1">
              {profile.experience || 0} XP
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs md:text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-3 w-3 md:h-4 md:w-4" />
              Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">${profile.cash || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Cash</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs md:text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-3 w-3 md:h-4 md:w-4" />
              Fame
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{profile.fame || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Points</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs md:text-sm font-medium flex items-center gap-2">
              <Users className="h-3 w-3 md:h-4 md:w-4" />
              Online
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{onlinePlayers}</div>
            <p className="text-xs text-muted-foreground mt-1">of {totalPlayers}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left Column - Schedule & Skills */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          {/* Today's Schedule */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <Calendar className="h-4 w-4 md:h-5 md:w-5" />
                Today's Schedule
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">Your planned activities</CardDescription>
            </CardHeader>
            <CardContent className="p-0 md:p-6 md:pt-0">
              <DaySchedule date={new Date()} userId={profile.user_id} />
            </CardContent>
          </Card>

          {/* Recent Skill Improvements */}
          {recentImprovements.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base md:text-lg flex items-center gap-2">
                  <TrendingUpIcon className="h-4 w-4 md:h-5 md:w-5" />
                  Skills Improved (24hrs)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentImprovements.slice(0, 5).map(improvement => (
                    <div
                      key={improvement.id}
                      className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-accent/50"
                    >
                      <div>
                        <p className="text-xs md:text-sm font-medium">
                          {formatSkillName(improvement.skill_name)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {improvement.previous_value} → {improvement.new_value}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        +{improvement.improvement_amount}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <Activity className="h-4 w-4 md:h-5 md:w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : activityFeed.length === 0 ? (
                <p className="text-xs md:text-sm text-muted-foreground">
                  No recent activity. Get started!
                </p>
              ) : (
                <div className="space-y-2">
                  {activityFeed.slice(0, 5).map(activity => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-2 p-2 md:p-3 rounded-lg bg-accent/50"
                    >
                      <Activity className="h-3 w-3 md:h-4 md:w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs md:text-sm">{activity.message}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNowStrict(new Date(activity.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      {activity.earnings > 0 && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          +${activity.earnings}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Location, Notifications, Chat */}
        <div className="space-y-4 md:space-y-6">
          {/* Location & Date */}
          <div className="space-y-3 md:space-y-4">
            <CurrentLocationWidget city={currentCity} loading={cityLoading} />
            <GameDateWidget />
          </div>

          {/* Notifications */}
          {dashboardNotifications.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base md:text-lg flex items-center gap-2">
                  <Bell className="h-4 w-4 md:h-5 md:w-5" />
                  Notifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dashboardNotifications.slice(0, 5).map(notif => (
                    <div
                      key={notif.id}
                      className="flex items-start gap-2 p-2 md:p-3 rounded-lg bg-accent/50"
                    >
                      <div className={notif.iconClasses + " shrink-0"}>{notif.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs md:text-sm font-medium">{notif.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {notif.description}
                        </p>
                        {notif.timestamp && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {notif.timestamp}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chat */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <MessageSquare className="h-4 w-4 md:h-5 md:w-5" />
                Chat
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs value={currentTab} onValueChange={v => setCurrentTab(v as ChatScope)}>
                <TabsList className="w-full rounded-none border-b">
                  <TabsTrigger value="general" className="flex-1 text-xs md:text-sm">
                    General
                  </TabsTrigger>
                  <TabsTrigger value="city" className="flex-1 text-xs md:text-sm">
                    Local
                  </TabsTrigger>
                </TabsList>
              <div className="p-3 md:p-4">
                <TabsContent value="general" className="m-0">
                  <RealtimeChatPanel channelKey="general" />
                </TabsContent>
                <TabsContent value="city" className="m-0">
                  <RealtimeChatPanel channelKey={deriveCityChannel(currentCity?.id)} />
                </TabsContent>
              </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
