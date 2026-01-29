import { useState, useEffect } from "react";
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
import { User, Trophy, Users, Calendar, Bot, Heart, Zap, Coins, MapPin, Clock, ChevronLeft, ChevronRight, CalendarDays, Star, Flame } from "lucide-react";
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

// Advisor imports
import { Link, useNavigate as useRouterNavigate } from "react-router-dom";
import { generateAdvisorInsights, type AdvisorInsights, type AdvisorSuggestion } from "@/lib/services/advisor";
import { streamAdvisorChat } from "@/lib/api/advisor-chat";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw, Send } from "lucide-react";
type ChatRole = "advisor" | "user";
type ChatKind = "general" | "insights";
interface AdvisorChatMessage {
  id: string;
  role: ChatRole;
  kind: ChatKind;
  content: string;
  suggestions?: AdvisorSuggestion[];
  timestamp: Date;
}
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
  const {
    toast
  } = useToast();
  const { t } = useTranslation();
  const { data: vipStatus } = useVipStatus();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [activeTab, setActiveTab] = useState("profile");

  // Advisor state
  const [messages, setMessages] = useState<AdvisorChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [advisorError, setAdvisorError] = useState<string | null>(null);
  const [insights, setInsights] = useState<AdvisorInsights | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [insightsLoaded, setInsightsLoaded] = useState(false);
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
      const result = await client.from("player_achievements").select("*, achievements(*)").eq("player_id", user.id);
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

  // Advisor functions
  const greeting = profile ? `Hey ${(profile as any).stage_name || (profile as any).display_name || (profile as any).username || "there"}! I'm tracking your career pulse. Ready for a data-powered game plan?` : "";
  const loadInsights = async () => {
    if (!user) return;
    setLoading(true);
    setAdvisorError(null);
    try {
      const result = await generateAdvisorInsights(user.id);
      setInsights(result);
      setInsightsLoaded(true);
      setMessages(previous => {
        const retainedMessages = previous.filter(message => message.kind !== "insights");
        const advisoryCopy = result.suggestions.length > 0 ? "Here's what I'm seeing in your numbers right now." : "No red alerts in the data—stay consistent and check back after your next update.";
        return [...retainedMessages, {
          id: `advisor-insights-${Date.now()}`,
          role: "advisor",
          kind: "insights",
          content: advisoryCopy,
          suggestions: result.suggestions,
          timestamp: new Date()
        }];
      });
    } catch (insightError) {
      console.error(insightError);
      setAdvisorError(insightError instanceof Error ? insightError.message : "Unable to load advisor insights right now.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-load insights when advisor tab is first visited
  useEffect(() => {
    if (activeTab === "advisor" && !insightsLoaded && user && !loading) {
      loadInsights();
    }
  }, [activeTab, insightsLoaded, user, loading]);
  const handleAdvisorSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inputValue.trim() || isStreaming) return;
    const userMessage: AdvisorChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      kind: "general",
      content: inputValue.trim(),
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsStreaming(true);
    const session = await supabase.auth.getSession();
    if (!session.data.session?.access_token) {
      toast({
        title: "Authentication required",
        description: "Please log in to chat with the advisor.",
        variant: "destructive"
      });
      setIsStreaming(false);
      return;
    }
    let assistantContent = "";
    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "advisor") {
          return prev.map((m, i) => i === prev.length - 1 ? {
            ...m,
            content: assistantContent
          } : m);
        }
        return [...prev, {
          id: `advisor-${Date.now()}`,
          role: "advisor",
          kind: "general",
          content: assistantContent,
          timestamp: new Date()
        }];
      });
    };
    const conversationHistory = messages.filter(m => m.kind === "general").map(m => ({
      role: m.role === "advisor" ? "assistant" as const : "user" as const,
      content: m.content
    }));
    await streamAdvisorChat({
      messages: [...conversationHistory, {
        role: "user",
        content: userMessage.content
      }],
      insights,
      summary: insights?.summary,
      apiKey: session.data.session.access_token,
      onDelta: updateAssistant,
      onDone: () => setIsStreaming(false),
      onError: err => {
        toast({
          title: "Advisor unavailable",
          description: err,
          variant: "destructive"
        });
        setIsStreaming(false);
      }
    });
  };
  return <div className="container mx-auto p-3 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('dashboard.welcome')}, {(profile as any)?.display_name || (profile as any)?.username || "Player"}
          </p>
        </div>
        
      </div>

      <DebtWarningBanner />
      <GigLocationWarning />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-max sm:grid sm:w-full sm:grid-cols-8 gap-1">
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
            <TabsTrigger value="friends" className="flex-shrink-0">
              <Users className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('social.friends', 'Friends')}</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex-shrink-0">
              <Calendar className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('nav.schedule')}</span>
            </TabsTrigger>
            <TabsTrigger value="advisor" className="flex-shrink-0">
              <Bot className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('nav.advisor')}</span>
            </TabsTrigger>
            <TabsTrigger value="achievements" className="flex-shrink-0">
              <Trophy className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('awards.achievements')}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Profile Tab - Now with sub-tabs */}
        <TabsContent value="profile" className="space-y-4">
          {/* Location Header - Shows country flag, city name, and local flavor */}
          {currentCity && (
            <LocationHeader 
              cityName={currentCity.name}
              country={currentCity.country}
              musicScene={currentCity.music_scene}
              timezone={currentCity.timezone}
            />
          )}

          {/* VIP Status Card */}
          <VipStatusCard />

          {/* Character Identity & Reputation Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            <CharacterIdentityCard />
            <ReputationCard />
          </div>

          {/* Overview Tabs */}
          <DashboardOverviewTabs profile={profile} currentCity={currentCity} />

          {/* Recent Activity */}
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

        {/* Friends Tab with Chat */}
        <TabsContent value="friends" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('dashboard.friendsList', 'Friends List')}
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/relationships">{t('common.viewAll', 'View All')}</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {!friendships || friendships.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">
                    {t('dashboard.noFriendsYet', 'No friends yet. Start connecting with other players!')}
                  </p> : <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {friendships.map((friendship: any) => {
                        const friend = friendship.friendProfile;
                        if (!friend) return null;
                        
                        return (
                          <Link 
                            to="/relationships" 
                            key={friendship.id} 
                            className="flex items-center gap-3 p-2 rounded-lg border hover:bg-accent/50 transition-colors"
                          >
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={friend.avatar_url} />
                              <AvatarFallback>
                                {getInitials(friend.display_name || friend.username || "?")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {friend.display_name || friend.username}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Level {friend.level || 1} • Fame {friend.fame?.toLocaleString() || 0}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </ScrollArea>}
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>{t('dashboard.chatChannels', 'Chat Channels')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ChatChannelSelector isVip={vipStatus?.isVip || false} />
              </CardContent>
            </Card>
          </div>
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

        {/* Advisor Tab */}
        <TabsContent value="advisor" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                    <Bot className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle>{t('nav.advisor')}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {t('dashboard.advisorDescription', 'Your tactical coach for data-driven decisions')}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={loadInsights} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  {t('dashboard.refreshInsights', 'Refresh insights')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="h-[400px] border rounded-lg p-4">
                <div className="space-y-4">
                  {messages.length === 0 && <div className="text-center py-8 text-muted-foreground">
                      <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{greeting}</p>
                    </div>}
                  
                  {messages.map(message => <div key={message.id} className={cn("flex w-full", message.role === "user" ? "justify-end" : "justify-start")}>
                      <div className={cn("max-w-xl rounded-2xl border px-4 py-3", message.role === "advisor" ? "border-primary/20 bg-background" : "border-primary bg-primary text-primary-foreground")}>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {message.role === "advisor" ? <>
                              <Bot className="h-4 w-4" />
                              <span>{t('nav.advisor')}</span>
                            </> : <span>{t('dashboard.you', 'You')}</span>}
                        </div>
                        <p className="mt-2 text-sm leading-relaxed">{message.content}</p>
                        
                        {message.suggestions && message.suggestions.length > 0 && <div className="mt-4 space-y-2">
                            {message.suggestions.map(suggestion => <div key={suggestion.id} className="rounded-lg border bg-muted/20 p-3">
                                <h3 className="text-sm font-semibold">{suggestion.title}</h3>
                                <p className="text-xs text-muted-foreground mt-1">{suggestion.message}</p>
                                {suggestion.actions.length > 0 && <div className="mt-2 flex gap-2">
                                    {suggestion.actions.map(action => <Button key={action.href} variant="outline" size="sm" asChild>
                                        <Link to={action.href}>{action.label}</Link>
                                      </Button>)}
                                  </div>}
                              </div>)}
                          </div>}
                      </div>
                    </div>)}
                  
                  {loading && <div className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{t('dashboard.analyzing', 'Analyzing...')}</span>
                      </div>
                    </div>}
                </div>
              </ScrollArea>

              {advisorError && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {advisorError}
                </div>}

              <form onSubmit={handleAdvisorSubmit} className="space-y-2">
                <Textarea value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder="Ask the advisor what to focus on next..." className="min-h-[80px] resize-none" />
                <Button type="submit" size="sm" disabled={!inputValue.trim() || isStreaming} className="w-full">
                  {isStreaming ? <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Thinking...
                    </> : <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Message
                    </>}
                </Button>
              </form>
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
    </div>;
};
export default Dashboard;