import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { useTranslation } from "@/hooks/useTranslation";
import { useVipStatus } from "@/hooks/useVipStatus";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, addDays, startOfWeek, format as formatDate } from "date-fns";
import { User, Trophy, Users, Calendar, Heart, Zap, Coins, MapPin, Clock, ChevronLeft, ChevronRight, CalendarDays, Star, Flame } from "lucide-react";
import { PageLayout } from "@/components/ui/PageLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChatChannelSelector } from "@/components/dashboard/ChatChannelSelector";
import { RecentActivitySection } from "@/components/dashboard/RecentActivitySection";
import { DaySchedule } from "@/components/schedule/DaySchedule";
import { SkillsAttributesTab } from "@/components/dashboard/SkillsAttributesTab";
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

import { Link } from "react-router-dom";
const Dashboard = () => {
  const {
    user
  } = useAuth();
  const {
    profile,
    skillProgress,
    attributes,
    currentCity
  } = useGameData();
  const { t } = useTranslation();
  const { data: vipStatus } = useVipStatus();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [activeTab, setActiveTab] = useState("profile");
  const [surveyDismissed, setSurveyDismissed] = useState(false);
  const { shouldShowSurvey, questions: surveyQuestions, submitSurvey, isSubmitting: isSurveySubmitting } = usePlayerSurvey();

  const weekStart = startOfWeek(currentDate, {
    weekStartsOn: 1
  });
  const weekDays = Array.from({
    length: 7
  }, (_, i) => addDays(weekStart, i));
  const {
    data: friendships
  } = useQuery({
    queryKey: ["dashboard-friendships", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      
      // Fetch friendships using profile IDs (requestor_id, addressee_id)
      const { data: friendshipsData } = await supabase
        .from("friendships")
        .select("id, requestor_id, addressee_id, status")
        .or(`requestor_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
        .eq("status", "accepted")
        .limit(10);
      
      if (!friendshipsData || friendshipsData.length === 0) return [];
      
      // Get all other profile IDs
      const otherProfileIds = friendshipsData.map(f => 
        f.requestor_id === profile.id ? f.addressee_id : f.requestor_id
      );
      
      // Fetch those profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, fame, level")
        .in("id", otherProfileIds);
      
      // Map profiles to friendships
      const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? []);
      
      return friendshipsData.map(f => ({
        ...f,
        friendProfile: profileMap.get(
          f.requestor_id === profile.id ? f.addressee_id : f.requestor_id
        ) ?? null
      }));
    },
    enabled: !!profile?.id
  });
  const {
    data: achievements
  } = useQuery({
    queryKey: ["player-achievements", user?.id],
    queryFn: async (): Promise<any[]> => {
      if (!user?.id) return [];
      const client: any = supabase;
      const result = await client.from("player_achievements").select("*, achievements(*)").eq("user_id", user.id);
      return result.data || [];
    },
    enabled: !!user?.id
  });

  // Filter skills with XP > 0
  const trainedSkills = skillProgress?.filter(skill => (skill.current_xp || 0) > 0) || [];
  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };
  const calculateSkillProgress = (currentXp: number, level: number) => {
    const currentLevelXp = Math.pow(level, 2) * 100;
    const nextLevelXp = Math.pow(level + 1, 2) * 100;
    const progressInLevel = currentXp - currentLevelXp;
    const xpNeededForLevel = nextLevelXp - currentLevelXp;
    return progressInLevel / xpNeededForLevel * 100;
  };

  return <PageLayout>
      <PlayerSurveyModal
        open={shouldShowSurvey && !surveyDismissed && surveyQuestions.length > 0}
        onClose={() => setSurveyDismissed(true)}
        questions={surveyQuestions}
        onSubmit={submitSurvey}
        isSubmitting={isSurveySubmitting}
      />
      <PageHeader
        title={t('dashboard.title')}
        subtitle={`${t('dashboard.welcome')}, ${(profile as any)?.display_name || (profile as any)?.username || "Player"}`}
      />

      <DebtWarningBanner />
      <GigLocationWarning />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-max sm:grid sm:w-full sm:grid-cols-7 gap-1">
            <TabsTrigger value="profile" className="flex-shrink-0">
              <User className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('common.profile')}</span>
            </TabsTrigger>
            <TabsTrigger value="fame" className="flex-shrink-0">
              <Star className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('dashboard.fame')}</span>
            </TabsTrigger>
            <TabsTrigger value="behavior" className="flex-shrink-0">
              <Flame className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Lifestyle</span>
            </TabsTrigger>
            <TabsTrigger value="skills" className="flex-shrink-0">
              <Zap className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('nav.skills')}</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex-shrink-0">
              <Users className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex-shrink-0">
              <Calendar className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('nav.schedule')}</span>
            </TabsTrigger>
            <TabsTrigger value="achievements" className="flex-shrink-0">
              <Trophy className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('awards.achievements')}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Profile Tab - Reorganized for clarity */}
        <TabsContent value="profile" className="space-y-4">

          {/* ── Section 1: Hero Card ── */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <Avatar className="h-20 w-20 border-2 border-primary/30 flex-shrink-0">
                  <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || profile?.username || "Character"} />
                  <AvatarFallback className="text-2xl">
                    <User className="h-10 w-10" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-foreground truncate">
                    {profile?.display_name || profile?.username || "Unknown"}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
                    {profile?.age && <span>Age {profile.age}</span>}
                    {profile?.gender && <span className="capitalize">{profile.gender}</span>}
                    {currentCity && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {currentCity.name}, {currentCity.country}
                      </span>
                    )}
                  </div>
                  {/* Vitals row */}
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <div className="flex items-center gap-1.5">
                      <Heart className="h-3.5 w-3.5 text-destructive" />
                      <Progress value={profile?.health || 100} className="h-1.5 w-16" />
                      <span className="text-xs text-muted-foreground">{profile?.health || 100}%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-warning" />
                      <Progress value={profile?.energy || 100} className="h-1.5 w-16" />
                      <span className="text-xs text-muted-foreground">{profile?.energy || 100}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Section 2: Location Banner ── */}
          {currentCity && (
            <LocationHeader 
              cityName={currentCity.name}
              country={currentCity.country}
              cityId={currentCity.id}
              musicScene={currentCity.music_scene}
              timezone={currentCity.timezone}
            />
          )}

          {/* ── Section 3: Key Stats Grid ── */}
          <DashboardOverviewTabs profile={profile} currentCity={currentCity} />

          {/* ── Section 4: VIP Status ── */}
          <VipStatusCard />

          {/* ── Section 5: Character Identity & Reputation ── */}
          <div className="grid gap-4 md:grid-cols-2">
            <CharacterIdentityCard />
            <ReputationCard />
          </div>

          {/* ── Section 6: Recent Activity ── */}
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
            </CardHeader>
            <CardContent>
              <RecentActivitySection userId={user?.id} />
            </CardContent>
          </Card>

        </TabsContent>

        {/* Fame & Fans Tab */}
        <TabsContent value="fame" className="space-y-4">
          <CharacterFameOverview />
        </TabsContent>

        {/* Behavior/Lifestyle Tab */}
        <TabsContent value="behavior" className="space-y-4">
          <BehaviorSettingsTab />
        </TabsContent>

        {/* Skills & Attributes Tab */}
        <TabsContent value="skills" className="space-y-4">
          <SkillsAttributesTab profile={profile} />
        </TabsContent>

        {/* Chat Tab */}
        <TabsContent value="chat" className="space-y-4">
          <ChatChannelSelector isVip={vipStatus?.isVip || false} />
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle>{t('nav.schedule')}</CardTitle>
                <div className="flex gap-2 flex-wrap">
                  <Link to="/booking/songwriting">
                    <Button size="sm" variant="outline" className="text-xs sm:text-sm">
                      <span className="hidden sm:inline">{t('nav.songwriting')}</span>
                      <span className="sm:hidden">{t('dashboard.write', 'Write')}</span>
                    </Button>
                  </Link>
                  <Link to="/booking/performance">
                    <Button size="sm" variant="outline">
                      {t('nav.perform')}
                    </Button>
                  </Link>
                  <Link to="/booking/education">
                    <Button size="sm" variant="outline">
                      {t('nav.education')}
                    </Button>
                  </Link>
                  <Link to="/booking/work">
                    <Button size="sm" variant="outline">
                      {t('dashboard.life', 'Life')}
                    </Button>
                  </Link>
                </div>
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

        {/* Achievements Tab */}
        <TabsContent value="achievements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                {t('awards.achievements')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!achievements || achievements.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">
                  {t('dashboard.noAchievements', 'No achievements unlocked yet. Keep playing to earn achievements!')}
                </p> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageLayout>;
};
export default Dashboard;
