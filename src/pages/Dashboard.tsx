import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { useTranslation } from "@/hooks/useTranslation";

import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, addDays, startOfWeek, format as formatDate } from "date-fns";
import { User, Trophy, Calendar, Heart, Zap, MapPin, ChevronLeft, ChevronRight, CalendarDays, Star, Flame, BarChart3, Activity as ActivityIcon, ChevronDown, Shield, Sparkles, Bell, Target } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { StandardPageLayout } from "@/components/ui/StandardPageLayout";
import { PageEmptyState, PageErrorState, PageLoadingState } from "@/components/ui/page-state";

import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { RecentActivitySection } from "@/components/dashboard/RecentActivitySection";
import { DaySchedule } from "@/components/schedule/DaySchedule";
import { DebtWarningBanner } from "@/components/prison/DebtWarningBanner";
import { CharacterFameOverview } from "@/components/fame/CharacterFameOverview";
import { LocationHeader } from "@/components/location/LocationHeader";
import { LocationFlavorCard } from "@/components/location/LocationFlavorCard";
import { GigLocationWarning } from "@/components/notifications/GigLocationWarning";
import { DashboardOverviewTabs } from "@/components/dashboard/DashboardOverviewTabs";
import { VipStatusCard } from "@/components/VipStatusCard";
import { BehaviorSettingsTab } from "@/components/dashboard/BehaviorSettingsTab";
import { CharacterIdentityCard } from "@/components/character";
import { ReputationCard } from "@/components/reputation";
import { usePlayerSurvey } from "@/hooks/usePlayerSurvey";
import { PlayerSurveyModal } from "@/components/survey/PlayerSurveyModal";
import { CharacterUnreadWidget } from "@/components/dashboard/CharacterUnreadWidget";
import { TodaysBriefing } from "@/components/dashboard/TodaysBriefing";
import { ManagerRecommendationsPanel } from "@/components/dashboard/ManagerRecommendationsPanel";
import { GettingStartedPanel } from "@/components/dashboard/GettingStartedPanel";
import { WorldNewsList } from "@/components/world/WorldNewsList";

import { Link } from "react-router-dom";
import { generatePlayerGoals, type PlayerGoalInput } from "@/lib/playerGoals";

const StatusMetric = ({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Heart }) => (
  <div className="rounded-lg border bg-card/50 p-3">
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-primary" />
      {label}
    </div>
    <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
  </div>
);

const KeyStatusPanel = ({ profile, currentCity }: { profile: any; currentCity: any }) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-base">
        <ActivityIcon className="h-4 w-4 text-primary" />
        Key Character/Band Status
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {!profile ? (
        <PageLoadingState title="Loading character status" description="Fetching your active character snapshot..." />
      ) : (
        <>
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/30 flex-shrink-0">
              <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || profile?.username || "Character"} />
              <AvatarFallback className="text-xl"><User className="h-8 w-8" /></AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-bold text-foreground">{profile?.display_name || profile?.username || "Unknown"}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {profile?.age && <span>Age {profile.age}</span>}
                {profile?.gender && <span className="capitalize">{profile.gender}</span>}
                {currentCity ? <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{currentCity.name}, {currentCity.country}</span> : null}
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatusMetric label="Health" value={`${profile?.health ?? 100}%`} icon={Heart} />
            <StatusMetric label="Energy" value={`${profile?.energy ?? 100}%`} icon={Zap} />
            <StatusMetric label="Fame" value={profile?.fame ?? 0} icon={Star} />
            <StatusMetric label="Level" value={profile?.level ?? 1} icon={Trophy} />
          </div>
        </>
      )}
    </CardContent>
  </Card>
);


const GoalsProgressPanel = ({ profile, userId }: { profile: any; userId?: string }) => {
  const profileId = profile?.id;
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard-player-goals", profileId, userId],
    enabled: !!profileId && !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<PlayerGoalInput> => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const nowIso = now.toISOString();
      const client: any = supabase;

      const [songsResult, membershipsResult, activitiesResult] = await Promise.all([
        client.from("songs").select("id, status").eq("profile_id", profileId).limit(500),
        client.from("band_members").select("band_id").eq("profile_id", profileId).eq("member_status", "active"),
        client
          .from("player_scheduled_activities")
          .select("id, activity_type, scheduled_start, status")
          .eq("profile_id", profileId)
          .gte("scheduled_start", nowIso)
          .in("status", ["scheduled", "in_progress"])
          .limit(50),
      ]);

      if (songsResult.error) throw songsResult.error;
      if (membershipsResult.error) throw membershipsResult.error;
      if (activitiesResult.error) throw activitiesResult.error;

      const bandIds = (membershipsResult.data || []).map((membership: any) => membership.band_id).filter(Boolean);
      let releasesQuery = client.from("releases").select("id, release_status, user_id, band_id").limit(200);
      if (bandIds.length > 0 && userId) {
        releasesQuery = releasesQuery.or(`user_id.eq.${userId},band_id.in.(${bandIds.join(",")})`);
      } else if (userId) {
        releasesQuery = releasesQuery.eq("user_id", userId);
      } else if (bandIds.length > 0) {
        releasesQuery = releasesQuery.in("band_id", bandIds);
      }

      const [releasesResult, rehearsalsResult] = await Promise.all([
        releasesQuery,
        bandIds.length > 0
          ? client
              .from("band_rehearsals")
              .select("id, scheduled_start, status")
              .in("band_id", bandIds)
              .gte("scheduled_start", weekAgo)
              .limit(50)
          : { data: [], error: null },
      ]);

      if (releasesResult.error) throw releasesResult.error;
      if (rehearsalsResult.error) throw rehearsalsResult.error;

      const songs = songsResult.data || [];
      const releases = releasesResult.data || [];
      const activities = activitiesResult.data || [];
      const rehearsals = rehearsalsResult.data || [];

      return {
        draftSongs: songs.filter((song: any) => song.status === "draft").length,
        recordedSongs: songs.filter((song: any) => ["recorded", "released"].includes(song.status)).length,
        releasedMusic: releases.filter((release: any) => release.release_status === "released").length + songs.filter((song: any) => song.status === "released").length,
        upcomingRehearsals: rehearsals.filter((rehearsal: any) => new Date(rehearsal.scheduled_start) >= now && rehearsal.status !== "cancelled").length,
        recentRehearsals: rehearsals.filter((rehearsal: any) => new Date(rehearsal.scheduled_start) < now && rehearsal.status === "completed").length,
        upcomingActivities: activities.length,
        health: profile?.health ?? 100,
        energy: profile?.energy ?? 100,
        fans: profile?.fans ?? profile?.fan_count ?? 0,
        fame: profile?.fame ?? 0,
      };
    },
  });

  const goals = data ? generatePlayerGoals(data) : [];

  return (
    <Card>
      <CardHeader className="gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            Goals & Progress
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Short-term goals generated from your current songs, releases, schedule, wellness, and audience.</p>
        </div>
        <Button asChild size="sm" variant="outline"><Link to="/song-manager">Catalog</Link></Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <PageLoadingState title="Loading goals" description="Checking your next best milestones..." />
        ) : error ? (
          <PageErrorState title="Goals could not be loaded" description="Your dashboard is still available while goals refresh." onRetry={() => void refetch()} />
        ) : goals.length === 0 ? (
          <PageEmptyState title="Start your first music goal" description="Write a song or book an activity and your dashboard goals will update around that progress." action={<Button asChild size="sm"><Link to="/booking/songwriting">Start songwriting</Link></Button>} />
        ) : goals.map((goal) => {
          const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
          return (
            <div key={goal.id} className="rounded-lg border bg-card/50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{goal.title}</h3>
                    {goal.completed && <Badge variant="secondary">Ready</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{goal.description}</p>
                </div>
                <Button asChild size="sm" variant={goal.completed ? "outline" : "default"} className="shrink-0"><Link to={goal.href}>{goal.cta}</Link></Button>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{goal.progressLabel}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

const UpcomingSchedulePanel = ({ currentDate, userId }: { currentDate: Date; userId?: string }) => (
  <Card>
    <CardHeader className="gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4 text-primary" />
          Upcoming Schedule
        </CardTitle>
      </div>
      <Button asChild size="sm" variant="outline"><Link to="/schedule">Open full schedule</Link></Button>
    </CardHeader>
    <CardContent>
      {!userId ? <PageLoadingState title="Loading schedule" description="Preparing your upcoming activities..." /> : <DaySchedule date={currentDate} userId={userId} />}
    </CardContent>
  </Card>
);

const NotificationsPanel = ({ userId, profileId }: { userId?: string; profileId?: string }) => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard-command-notifications", userId, profileId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const [inboxResult, notificationsResult] = await Promise.all([
        supabase
          .from("player_inbox")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId!)
          .eq("is_read", false)
          .eq("is_archived", false),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId!)
          .is("read_at", null),
      ]);
      if (inboxResult.error) throw inboxResult.error;
      if (notificationsResult.error) throw notificationsResult.error;
      return { inbox: inboxResult.count ?? 0, notifications: notificationsResult.count ?? 0 };
    },
  });

  return (
    <Card>
      <CardHeader className="gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" />
            Notifications
          </CardTitle>
        </div>
        <Button asChild size="sm" variant="outline"><Link to="/inbox">Open inbox</Link></Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <PageLoadingState title="Loading notifications" description="Checking inbox and alert queues..." />
        ) : error ? (
          <PageErrorState title="Notifications could not be loaded" description="Your inbox is still available from the main navigation." onRetry={() => void refetch()} />
        ) : (data?.inbox ?? 0) + (data?.notifications ?? 0) === 0 ? (
          <PageEmptyState title="No notifications waiting" description="New inbox items, alerts, and character messages will appear here." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <StatusMetric label="Unread inbox" value={data?.inbox ?? 0} icon={Bell} />
            <StatusMetric label="Unread alerts" value={data?.notifications ?? 0} icon={Bell} />
          </div>
        )}
        <CharacterUnreadWidget />
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const {
    user
  } = useAuth();
  const {
    profile,
    currentCity
  } = useGameData();
  const { t } = useTranslation();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [activeTab, setActiveTab] = useState("profile");
  const [surveyDismissed, setSurveyDismissed] = useState(false);
  const { shouldShowSurvey, questions: surveyQuestions, submitSurvey, isSubmitting: isSurveySubmitting } = usePlayerSurvey();

  const weekStart = useMemo(() => startOfWeek(currentDate, {
    weekStartsOn: 1
  }), [currentDate]);
  const weekDays = useMemo(() => Array.from({
    length: 7
  }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const {
    data: achievements,
    isLoading: achievementsLoading,
    error: achievementsError,
    refetch: refetchAchievements,
  } = useQuery({
    queryKey: ["player-achievements", profile?.id],
    queryFn: async (): Promise<any[]> => {
      if (!profile?.id) return [];
      const client: any = supabase;
      const result = await client
        .from("player_achievements")
        .select("id, unlocked_at, achievements(name, description, icon)")
        .eq("profile_id", profile.id)
        .order("unlocked_at", { ascending: false })
        .limit(30);
      if (result.error) throw result.error;
      return result.data || [];
    },
    enabled: !!profile?.id && activeTab === "activity",
    staleTime: 60_000,
  });


  return <StandardPageLayout
      title={t('dashboard.title')}
      subtitle={`${t('dashboard.welcome')}, ${(profile as any)?.display_name || (profile as any)?.username || "Player"}`}
      icon={User}
      bareContent
      secondaryActions={
        <>
          <Link to="/schedule"><Button variant="outline" size="sm">Schedule</Button></Link>
          <Link to="/statistics"><Button variant="outline" size="sm">Statistics</Button></Link>
          <Link to="/inbox"><Button variant="outline" size="sm">Inbox</Button></Link>
        </>
      }
    >
      <PlayerSurveyModal
        open={shouldShowSurvey && !surveyDismissed && surveyQuestions.length > 0}
        onClose={() => setSurveyDismissed(true)}
        questions={surveyQuestions}
        onSubmit={submitSurvey}
        isSubmitting={isSurveySubmitting}
      />

      <DebtWarningBanner />
      <GigLocationWarning />


      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-max sm:grid sm:w-full sm:grid-cols-6 gap-1">
            <TabsTrigger value="profile" className="flex-shrink-0">
              <User className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('common.profile')}</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex-shrink-0">
              <BarChart3 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Stats</span>
            </TabsTrigger>
            <TabsTrigger value="fame" className="flex-shrink-0">
              <Star className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('dashboard.fame')}</span>
            </TabsTrigger>
            <TabsTrigger value="behavior" className="flex-shrink-0">
              <Flame className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Lifestyle</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex-shrink-0">
              <Calendar className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('nav.schedule')}</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex-shrink-0">
              <ActivityIcon className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Activity</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Profile Tab — identity only */}
        <TabsContent value="profile" className="space-y-4">
          <DashboardHero profile={profile} userId={user?.id} />
          <GettingStartedPanel profile={profile} userId={user?.id} />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
            <div className="space-y-4">
              <TodaysBriefing profile={profile} userId={user?.id} />
              <GoalsProgressPanel profile={profile} userId={user?.id} />
              <ManagerRecommendationsPanel profile={profile} userId={user?.id} />
              <UpcomingSchedulePanel currentDate={currentDate} userId={user?.id} />
            </div>
            <div className="space-y-4">
              <NotificationsPanel userId={user?.id} profileId={profile?.id} />
              <WorldNewsList limit={4} showViewAllLink />
              <KeyStatusPanel profile={profile} currentCity={currentCity} />
            </div>
          </div>

          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between group">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Character Identity
                </span>
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <CharacterIdentityCard />
            </CollapsibleContent>
          </Collapsible>

          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between group">
                <span className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Reputation
                </span>
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <ReputationCard />
            </CollapsibleContent>
          </Collapsible>
        </TabsContent>

        {/* Stats Tab — detailed overview, location, VIP */}
        <TabsContent value="stats" className="space-y-4">
          {currentCity && (
            <LocationHeader
              cityName={currentCity.name}
              country={currentCity.country}
              cityId={currentCity.id}
              musicScene={currentCity.music_scene}
              timezone={currentCity.timezone}
            />
          )}
          <DashboardOverviewTabs profile={profile} currentCity={currentCity} />
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between group">
                <span className="flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  VIP Status
                </span>
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <VipStatusCard />
            </CollapsibleContent>
          </Collapsible>
        </TabsContent>



        {/* Fame & Fans Tab */}
        <TabsContent value="fame" className="space-y-4">
          <CharacterFameOverview />
        </TabsContent>

        {/* Behavior/Lifestyle Tab */}
        <TabsContent value="behavior" className="space-y-4">
          <BehaviorSettingsTab />
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle>{t('nav.schedule')}</CardTitle>
                <Button asChild size="sm" variant="outline">
                  <Link to="/schedule">Open full schedule</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'day' ? -1 : -7))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCurrentDate(new Date())}>
                    {t('common.today')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'day' ? 1 : 7))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex gap-2">
                  <Button size="sm" variant={viewMode === 'day' ? 'default' : 'outline'} onClick={() => setViewMode('day')}>
                    <Calendar className="h-4 w-4 mr-1" />
                    {t('dashboard.day', 'Day')}
                  </Button>
                  <Button size="sm" variant={viewMode === 'week' ? 'default' : 'outline'} onClick={() => setViewMode('week')}>
                    <CalendarDays className="h-4 w-4 mr-1" />
                    {t('dashboard.week', 'Week')}
                  </Button>
                </div>
              </div>

              {viewMode === 'day' ? <DaySchedule date={currentDate} userId={user?.id} /> : <Tabs defaultValue={formatDate(weekDays[0], 'yyyy-MM-dd')} className="w-full">
                  <TabsList className="w-full grid grid-cols-7 h-auto">
                    {weekDays.map(day => <TabsTrigger key={day.toISOString()} value={formatDate(day, 'yyyy-MM-dd')} className="flex flex-col py-2">
                        <span className="text-xs">{formatDate(day, 'EEE')}</span>
                        <span className="text-lg font-bold">{formatDate(day, 'd')}</span>
                      </TabsTrigger>)}
                  </TabsList>
                  {weekDays.map(day => <TabsContent key={day.toISOString()} value={formatDate(day, 'yyyy-MM-dd')}>
                      <DaySchedule date={day} userId={user?.id} />
                    </TabsContent>)}
                </Tabs>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab — recent activity + achievements */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
            </CardHeader>
            <CardContent>
              <RecentActivitySection userId={user?.id} />
            </CardContent>
          </Card>

          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between group">
                <span className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  {t('awards.achievements')}
                  {achievements && achievements.length > 0 && (
                    <Badge variant="secondary" className="ml-1">{achievements.length}</Badge>
                  )}
                </span>
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              {achievementsLoading ? (
                <PageLoadingState
                  title="Loading achievements"
                  description="Checking your latest milestones..."
                />
              ) : achievementsError ? (
                <PageErrorState
                  title="Achievements could not be loaded"
                  description="Your milestone list is temporarily unavailable."
                  onRetry={() => void refetchAchievements()}
                />
              ) : !achievements || achievements.length === 0 ? (
                <PageEmptyState
                  title="No achievements unlocked yet"
                  description={t('dashboard.noAchievements', 'Keep playing to earn achievements!')}
                />
              ) : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {achievements.map((achievement: any) => <div key={achievement.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="text-3xl">{achievement.achievements?.icon || "🏆"}</div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-sm">{achievement.achievements?.name}</h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            {achievement.achievements?.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Unlocked {formatDistanceToNow(new Date(achievement.unlocked_at), {
                        addSuffix: true
                      })}
                          </p>
                        </div>
                      </div>
                    </div>)}
                </div>}
            </CollapsibleContent>
          </Collapsible>
        </TabsContent>
      </Tabs>
    </StandardPageLayout>;
};
export default Dashboard;
