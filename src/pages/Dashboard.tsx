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
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, addDays, startOfWeek, format as formatDate } from "date-fns";
import { 
  User, 
  Trophy, 
  Users, 
  Calendar,
  Bot,
  Heart,
  Zap,
  Coins,
  MapPin,
  Clock,
  ChevronLeft,
  ChevronRight,
  CalendarDays
} from "lucide-react";
import { ChatChannelSelector } from "@/components/dashboard/ChatChannelSelector";
import { RecentActivitySection } from "@/components/dashboard/RecentActivitySection";
import { DaySchedule } from "@/components/schedule/DaySchedule";

// Advisor imports
import { Link } from "react-router-dom";
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
  const { user } = useAuth();
  const { profile, skills, attributes } = useGameData();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  
  // Advisor state
  const [messages, setMessages] = useState<AdvisorChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [advisorError, setAdvisorError] = useState<string | null>(null);
  const [insights, setInsights] = useState<AdvisorInsights | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data: friendships } = useQuery({
    queryKey: ["friendships", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("friendships")
        .select("*, profiles!friendships_user_id_1_fkey(*), profiles!friendships_user_id_2_fkey(*)")
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
        .eq("status", "accepted");
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: achievements } = useQuery({
    queryKey: ["player-achievements", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("player_achievements")
        .select("*, achievements(*)")
        .eq("player_id", user.id);
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Filter skills with XP > 0
  const trainedSkills = skills?.filter(skill => skill.value > 0) || [];

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const calculateSkillProgress = (value: number, level: number) => {
    const currentLevelXp = Math.pow(level, 2) * 100;
    const nextLevelXp = Math.pow(level + 1, 2) * 100;
    const progressInLevel = value - currentLevelXp;
    const xpNeededForLevel = nextLevelXp - currentLevelXp;
    return (progressInLevel / xpNeededForLevel) * 100;
  };

  // Advisor functions
  const greeting = profile
    ? `Hey ${(profile as any).stage_name || (profile as any).display_name || (profile as any).username || "there"}! I'm tracking your career pulse. Ready for a data-powered game plan?`
    : "";

  const loadInsights = async () => {
    if (!user) return;

    setLoading(true);
    setAdvisorError(null);

    try {
      const result = await generateAdvisorInsights(user.id);
      setInsights(result);

      setMessages((previous) => {
        const retainedMessages = previous.filter((message) => message.kind !== "insights");
        const advisoryCopy =
          result.suggestions.length > 0
            ? "Here's what I'm seeing in your numbers right now."
            : "No red alerts in the data—stay consistent and check back after your next update.";

        return [
          ...retainedMessages,
          {
            id: `advisor-insights-${Date.now()}`,
            role: "advisor",
            kind: "insights",
            content: advisoryCopy,
            suggestions: result.suggestions,
            timestamp: new Date(),
          },
        ];
      });
    } catch (insightError) {
      console.error(insightError);
      setAdvisorError(
        insightError instanceof Error
          ? insightError.message
          : "Unable to load advisor insights right now.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAdvisorSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inputValue.trim() || isStreaming) return;
    
    const userMessage: AdvisorChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      kind: "general",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsStreaming(true);

    const session = await supabase.auth.getSession();
    if (!session.data.session?.access_token) {
      toast({
        title: "Authentication required",
        description: "Please log in to chat with the advisor.",
        variant: "destructive",
      });
      setIsStreaming(false);
      return;
    }

    let assistantContent = "";
    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "advisor") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          );
        }
        return [
          ...prev,
          {
            id: `advisor-${Date.now()}`,
            role: "advisor",
            kind: "general",
            content: assistantContent,
            timestamp: new Date(),
          },
        ];
      });
    };

    const conversationHistory = messages
      .filter((m) => m.kind === "general")
      .map((m) => ({
        role: m.role === "advisor" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      }));

    await streamAdvisorChat({
      messages: [...conversationHistory, { role: "user", content: userMessage.content }],
      insights,
      summary: insights?.summary,
      apiKey: session.data.session.access_token,
      onDelta: updateAssistant,
      onDone: () => setIsStreaming(false),
      onError: (err) => {
        toast({
          title: "Advisor unavailable",
          description: err,
          variant: "destructive",
        });
        setIsStreaming(false);
      },
    });
  };

  return (
    <div className="container mx-auto p-3 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {(profile as any)?.display_name || (profile as any)?.username || "Player"}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">v2.0.2</Badge>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="skills">
            <Zap className="h-4 w-4 mr-2" />
            Skills
          </TabsTrigger>
          <TabsTrigger value="friends">
            <Users className="h-4 w-4 mr-2" />
            Friends
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <Calendar className="h-4 w-4 mr-2" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="advisor">
            <Bot className="h-4 w-4 mr-2" />
            Advisor
          </TabsTrigger>
          <TabsTrigger value="achievements">
            <Trophy className="h-4 w-4 mr-2" />
            Achievements
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={(profile as any)?.avatar_url} />
                    <AvatarFallback>
                      {getInitials((profile as any)?.display_name || (profile as any)?.username || "Player")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">
                      {(profile as any)?.display_name || (profile as any)?.username}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      @{(profile as any)?.username}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Age</p>
                    <p className="text-sm font-medium">{(profile as any)?.age || "Not set"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Gender</p>
                    <p className="text-sm font-medium capitalize">{(profile as any)?.gender || "unspecified"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fame</p>
                    <p className="text-sm font-medium">{(profile as any)?.fame || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fans</p>
                    <p className="text-sm font-medium">{(profile as any)?.fans || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cash</p>
                    <p className="text-sm font-medium">${(profile as any)?.cash || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Hours</p>
                    <p className="text-sm font-medium">{(profile as any)?.total_hours_played || 0}h</p>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{(profile as any)?.current_city || "No location"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Joined {(profile as any)?.created_at && formatDistanceToNow(new Date((profile as any).created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {(profile as any)?.last_active && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Last active {formatDistanceToNow(new Date((profile as any).last_active), { addSuffix: true })}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium">Health</span>
                    </div>
                    <span className="text-sm font-semibold">{(profile as any)?.health || 100}%</span>
                  </div>
                  <Progress value={(profile as any)?.health || 100} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium">Energy</span>
                    </div>
                    <span className="text-sm font-semibold">{(profile as any)?.energy || 100}%</span>
                  </div>
                  <Progress value={(profile as any)?.energy || 100} className="h-2" />
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 mb-2">
                    <Coins className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">Cash Balance</span>
                  </div>
                  <p className="text-2xl font-bold">${(profile as any)?.cash || 0}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <RecentActivitySection userId={user?.id} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Skills & Attributes Tab */}
        <TabsContent value="skills" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Skills</CardTitle>
            </CardHeader>
            <CardContent>
              {trainedSkills.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  You haven't trained any skills yet. Start training to see your progress!
                </p>
              ) : (
                <div className="space-y-4">
                  {trainedSkills.map((skill) => {
                    const progress = calculateSkillProgress(skill.value, skill.level);
                    return (
                      <div key={skill.skill_slug} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium capitalize">
                            {skill.skill_slug.replace(/_/g, " ")}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">Level {skill.level}</Badge>
                            <span className="text-xs text-muted-foreground">{skill.value} XP</span>
                          </div>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attributes</CardTitle>
            </CardHeader>
            <CardContent>
              {attributes && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium">Creative Insight</p>
                    <p className="text-2xl font-bold">{attributes.creative_insight || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Musical Ability</p>
                    <p className="text-2xl font-bold">{attributes.musical_ability || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Technical Mastery</p>
                    <p className="text-2xl font-bold">{attributes.technical_mastery || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Stage Presence</p>
                    <p className="text-2xl font-bold">{attributes.stage_presence || 0}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Friends Tab with Chat */}
        <TabsContent value="friends" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Friends List
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!friendships || friendships.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No friends yet. Start connecting with other players!
                  </p>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {friendships.map((friendship: any) => {
                        const friend =
                          friendship.user_id_1 === user?.id
                            ? friendship.profiles
                            : friendship.profiles;
                        return (
                          <div
                            key={friendship.id}
                            className="flex items-center gap-3 p-2 rounded-lg border hover:bg-accent/50 transition-colors"
                          >
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={friend?.avatar_url} />
                              <AvatarFallback>
                                {getInitials(friend?.display_name || friend?.username || "?")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {friend?.display_name || friend?.username}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                @{friend?.username}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Chat Channels</CardTitle>
              </CardHeader>
              <CardContent>
                <ChatChannelSelector isVip={(profile as any)?.is_vip || false} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle>Schedule</CardTitle>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => window.location.href = '/booking/songwriting'}>
                    Songwriting
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => window.location.href = '/booking/performance'}>
                    Performance
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => window.location.href = '/booking/education'}>
                    Education
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => window.location.href = '/booking/work'}>
                    Life
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'day' ? -1 : -7))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentDate(new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'day' ? 1 : 7))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={viewMode === 'day' ? 'default' : 'outline'}
                    onClick={() => setViewMode('day')}
                  >
                    <Calendar className="h-4 w-4 mr-1" />
                    Day
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === 'week' ? 'default' : 'outline'}
                    onClick={() => setViewMode('week')}
                  >
                    <CalendarDays className="h-4 w-4 mr-1" />
                    Week
                  </Button>
                </div>
              </div>

              {viewMode === 'day' ? (
                <DaySchedule date={currentDate} userId={user?.id} />
              ) : (
                <Tabs defaultValue={formatDate(weekDays[0], 'yyyy-MM-dd')} className="w-full">
                  <TabsList className="w-full grid grid-cols-7 h-auto">
                    {weekDays.map(day => (
                      <TabsTrigger 
                        key={day.toISOString()} 
                        value={formatDate(day, 'yyyy-MM-dd')}
                        className="flex flex-col py-2"
                      >
                        <span className="text-xs">{formatDate(day, 'EEE')}</span>
                        <span className="text-lg font-bold">{formatDate(day, 'd')}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {weekDays.map(day => (
                    <TabsContent key={day.toISOString()} value={formatDate(day, 'yyyy-MM-dd')}>
                      <DaySchedule date={day} userId={user?.id} />
                    </TabsContent>
                  ))}
                </Tabs>
              )}
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
                    <CardTitle>Advisor</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Your tactical coach for data-driven decisions
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={loadInsights} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Refresh insights
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="h-[400px] border rounded-lg p-4">
                <div className="space-y-4">
                  {messages.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{greeting}</p>
                    </div>
                  )}
                  
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex w-full",
                        message.role === "user" ? "justify-end" : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-xl rounded-2xl border px-4 py-3",
                          message.role === "advisor"
                            ? "border-primary/20 bg-background"
                            : "border-primary bg-primary text-primary-foreground",
                        )}
                      >
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {message.role === "advisor" ? (
                            <>
                              <Bot className="h-4 w-4" />
                              <span>Advisor</span>
                            </>
                          ) : (
                            <span>You</span>
                          )}
                        </div>
                        <p className="mt-2 text-sm leading-relaxed">{message.content}</p>
                        
                        {message.suggestions && message.suggestions.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {message.suggestions.map((suggestion) => (
                              <div
                                key={suggestion.id}
                                className="rounded-lg border bg-muted/20 p-3"
                              >
                                <h3 className="text-sm font-semibold">{suggestion.title}</h3>
                                <p className="text-xs text-muted-foreground mt-1">{suggestion.message}</p>
                                {suggestion.actions.length > 0 && (
                                  <div className="mt-2 flex gap-2">
                                    {suggestion.actions.map((action) => (
                                      <Button key={action.href} variant="outline" size="sm" asChild>
                                        <Link to={action.href}>{action.label}</Link>
                                      </Button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {loading && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Analyzing...</span>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {advisorError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {advisorError}
                </div>
              )}

              <form onSubmit={handleAdvisorSubmit} className="space-y-2">
                <Textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask the advisor what to focus on next..."
                  className="min-h-[80px] resize-none"
                />
                <Button type="submit" size="sm" disabled={!inputValue.trim() || isStreaming} className="w-full">
                  {isStreaming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Thinking...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Message
                    </>
                  )}
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
                Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!achievements || achievements.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No achievements unlocked yet. Keep playing to earn achievements!
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {achievements.map((achievement: any) => (
                    <div
                      key={achievement.id}
                      className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-3xl">{achievement.achievements?.icon || "🏆"}</div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-sm">{achievement.achievements?.name}</h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            {achievement.achievements?.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Unlocked {formatDistanceToNow(new Date(achievement.unlocked_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;
