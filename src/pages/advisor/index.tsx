import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  generateAdvisorInsights,
  type AdvisorInsights,
  type AdvisorSuggestion,
} from "@/lib/services/advisor";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Bot,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
  Coins,
  Users,
  Clock,
} from "lucide-react";

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

const getTrendBadgeClasses = (trend: "up" | "down" | "neutral" | undefined): string => {
  switch (trend) {
    case "up":
      return "bg-emerald-500/15 text-emerald-600 border-emerald-500/40";
    case "down":
      return "bg-rose-500/15 text-rose-600 border-rose-500/40";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const formatCurrency = (value: number): string => {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

const AdvisorPage = () => {
  const { user } = useAuth();
  const { profile } = useGameData();
  const [messages, setMessages] = useState<AdvisorChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<AdvisorInsights | null>(null);

  const greeting = useMemo(() => {
    if (!profile) return "";
    const currentProfile = profile as any;
    const stageName =
      currentProfile.stage_name ??
      currentProfile.display_name ??
      currentProfile.username ??
      currentProfile.name ??
      "there";
    return `Hey ${stageName}! I'm tracking your career pulse. Ready for a data-powered game plan?`;
  }, [profile]);

  useEffect(() => {
    if (!greeting) return;
    setMessages((previous) => {
      if (previous.some((message) => message.id === "advisor-greeting")) {
        return previous;
      }

      return [
        ...previous,
        {
          id: "advisor-greeting",
          role: "advisor",
          kind: "general",
          content: greeting,
          timestamp: new Date(),
        },
      ];
    });
  }, [greeting]);

  const loadInsights = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

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
      setError(
        insightError instanceof Error
          ? insightError.message
          : "Unable to load advisor insights right now.",
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      void loadInsights();
    }
  }, [user, loadInsights]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    setMessages((previous) => [
      ...previous,
      {
        id: `user-${Date.now()}`,
        role: "user",
        kind: "general",
        content: trimmed,
        timestamp: new Date(),
      },
      {
        id: `advisor-ack-${Date.now()}`,
        role: "advisor",
        kind: "general",
        content:
          "Appreciate the note! Refresh insights after your next move and I'll decode the new trends.",
        timestamp: new Date(),
      },
    ]);

    setInputValue("");
  };

  const summary = insights?.summary;

  const statCards = useMemo(
    () => [
      {
        label: "7-day streams",
        value: summary?.totalStreams7Days ?? 0,
        icon: TrendingUp,
        helper: summary?.updatedAt ? "Updated" : "Awaiting data",
      },
      {
        label: "7-day revenue",
        value: summary?.totalRevenue7Days ?? 0,
        icon: Coins,
        helper: summary?.updatedAt ? "Live metrics" : "Sync required",
        formatter: formatCurrency,
      },
      {
        label: "Listener reach",
        value: summary?.listenerReach7Days ?? 0,
        icon: Users,
        helper: summary?.updatedAt ? "Unique listeners" : "Growth pending",
      },
    ], [summary]);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-background via-background to-muted/30">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 py-6">
        <div className="rounded-3xl border border-primary/10 bg-background/80 p-8 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <Bot className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Advisor</h1>
                <p className="text-sm text-muted-foreground">
                  A tactical coach that turns your analytics into next best moves.
                </p>
              </div>
            </div>
            {summary?.updatedAt && (
              <div className="flex items-center gap-2 rounded-full border border-muted-foreground/20 bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Last sync: {new Date(summary.updatedAt).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            const formatter = stat.formatter ?? ((value: number) => value.toLocaleString());
            return (
              <Card key={stat.label} className="border-muted-foreground/20 bg-background/70 backdrop-blur">
                <CardContent className="flex flex-col gap-3 p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
                    <span className="rounded-full bg-primary/10 p-2 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="text-3xl font-semibold tracking-tight">{formatter(stat.value)}</div>
                  <span className="text-xs text-muted-foreground">{stat.helper}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {summary?.topMomentumTrack && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-1 h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-primary">Momentum watch</p>
                  <h2 className="text-xl font-semibold">{summary.topMomentumTrack.title}</h2>
                  <p className="text-sm text-primary/80">
                    Week-over-week lift of {Math.round((summary.topMomentumTrack.growthRate ?? 0) * 100)}% with {summary.topMomentumTrack.currentStreams.toLocaleString()} plays in the last 7 days.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/streaming-platforms">View analytics</Link>
                </Button>
                <Button asChild variant="secondary" size="sm">
                  <Link to="/social">Launch promo</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-muted-foreground/20 bg-background/80 backdrop-blur">
          <CardHeader className="border-b border-muted-foreground/10 pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-2xl font-semibold">Advisor chat</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Ask questions, refresh analytics, and follow tailored playbooks.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={loadInsights} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Refresh insights
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/streaming-platforms">Streaming dashboard</Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/pr">Campaign planner</Link>
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex h-[560px] flex-col gap-4 p-0">
            <ScrollArea className="flex-1 px-6 pt-6 pr-2">
              <div className="space-y-4">
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
                        "max-w-xl rounded-2xl border px-4 py-3 shadow-sm",
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
                      <div className="mt-2 text-xs text-muted-foreground">
                        {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>

                      {message.role === "advisor" && message.suggestions && message.suggestions.length > 0 && (
                        <div className="mt-4 space-y-4">
                          {message.suggestions.map((suggestion) => (
                            <div
                              key={suggestion.id}
                              className="rounded-xl border border-muted-foreground/15 bg-muted/20 p-4"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold">{suggestion.title}</h3>
                                <Badge variant="outline" className="uppercase text-[10px] tracking-wide">
                                  {suggestion.category}
                                </Badge>
                              </div>
                              <p className="mt-2 text-sm text-muted-foreground">{suggestion.message}</p>
                              {suggestion.metrics.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {suggestion.metrics.map((metric) => (
                                    <Badge
                                      key={`${suggestion.id}-${metric.label}`}
                                      variant="outline"
                                      className={cn("border", getTrendBadgeClasses(metric.trend))}
                                    >
                                      <span className="font-medium">{metric.value}</span>
                                      <span className="ml-2 text-xs uppercase tracking-wide text-muted-foreground/80">
                                        {metric.label}
                                      </span>
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              <div className="mt-4 flex flex-wrap gap-2">
                                {suggestion.actions.map((action) => (
                                  <Button key={action.href} variant="outline" size="sm" asChild>
                                    <Link to={action.href}>{action.label}</Link>
                                  </Button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-primary">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Crunching the latest signals…</span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {error && (
              <div className="mx-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 border-t border-muted-foreground/10 px-6 pb-6 pt-4">
              <Textarea
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Ask the advisor what to focus on next…"
                className="min-h-[90px] resize-none"
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Pro tip: update your analytics, then hit refresh for fresh marching orders.
                </p>
                <Button type="submit" size="sm" disabled={!inputValue.trim()}>
                  <Send className="mr-2 h-4 w-4" />
                  Ask advisor
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdvisorPage;
