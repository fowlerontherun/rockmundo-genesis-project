// Social Drama & Media Feed — News-style feed with filtering
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { SocialDramaEvent, GeneratedMediaArticle, SocialDramaCategory } from "@/types/social-drama-generator";
import {
  Newspaper, TrendingUp, Heart, HeartCrack, Swords, Music, Flame,
  Globe, Eye, AlertTriangle, Sparkles, Zap, Crown, Users,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const CATEGORY_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  public_breakup: { icon: <HeartCrack className="h-3.5 w-3.5" />, label: "Breakup", color: "text-social-love" },
  affair_exposed: { icon: <Eye className="h-3.5 w-3.5" />, label: "Scandal", color: "text-social-drama" },
  diss_track: { icon: <Music className="h-3.5 w-3.5" />, label: "Diss Track", color: "text-social-chemistry" },
  onstage_fight: { icon: <Swords className="h-3.5 w-3.5" />, label: "Fight", color: "text-social-tension" },
  surprise_wedding: { icon: <Heart className="h-3.5 w-3.5" />, label: "Wedding", color: "text-social-warm" },
  custody_dispute: { icon: <Users className="h-3.5 w-3.5" />, label: "Custody", color: "text-muted-foreground" },
  rehab_announcement: { icon: <Sparkles className="h-3.5 w-3.5" />, label: "Rehab", color: "text-social-trust" },
  feud_escalation: { icon: <Flame className="h-3.5 w-3.5" />, label: "Feud", color: "text-social-jealousy" },
  public_apology: { icon: <Heart className="h-3.5 w-3.5" />, label: "Apology", color: "text-success" },
  leaked_dms: { icon: <AlertTriangle className="h-3.5 w-3.5" />, label: "Leaked", color: "text-social-drama" },
  award_snub_rant: { icon: <Crown className="h-3.5 w-3.5" />, label: "Rant", color: "text-social-jealousy" },
  contract_dispute: { icon: <Swords className="h-3.5 w-3.5" />, label: "Legal", color: "text-muted-foreground" },
};

const FILTER_TABS = [
  { id: "all", label: "All" },
  { id: "romance", label: "Romance", categories: ["public_breakup", "surprise_wedding", "affair_exposed"] },
  { id: "scandal", label: "Scandal", categories: ["affair_exposed", "leaked_dms", "onstage_fight"] },
  { id: "rivalry", label: "Rivalry", categories: ["diss_track", "feud_escalation", "onstage_fight"] },
  { id: "family", label: "Family", categories: ["custody_dispute", "surprise_wedding"] },
];

interface DramaFeedProps {
  events: SocialDramaEvent[];
  articles: GeneratedMediaArticle[];
  className?: string;
}

function DramaEventCard({ event }: { event: SocialDramaEvent }) {
  const config = CATEGORY_CONFIG[event.drama_category] ?? { icon: <Zap className="h-3.5 w-3.5" />, label: event.drama_category, color: "text-muted-foreground" };
  const severityColors = {
    minor: "border-l-muted-foreground",
    moderate: "border-l-social-jealousy",
    major: "border-l-social-drama",
    explosive: "border-l-social-tension",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "border-l-3 pl-3 py-3 pr-3 rounded-r-lg bg-muted/20 border border-border/30 hover:bg-muted/30 transition-colors",
        severityColors[event.severity] ?? "border-l-border",
        event.went_viral && "ring-1 ring-social-chemistry/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className={cn(config.color)}>{config.icon}</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{config.label}</span>
            {event.went_viral && (
              <Badge className="text-[9px] px-1 py-0 bg-social-chemistry/20 text-social-chemistry border-social-chemistry/30">
                🔥 VIRAL
              </Badge>
            )}
          </div>
          <h4 className="text-sm font-bold leading-tight">{event.headline}</h4>
          <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>

          {/* Impact Badges */}
          <div className="flex flex-wrap gap-1 pt-1">
            {event.fame_change !== 0 && (
              <Badge variant="outline" className="text-[9px] px-1 py-0">
                ⭐ {event.fame_change > 0 ? "+" : ""}{event.fame_change}
              </Badge>
            )}
            {event.fan_loyalty_change !== 0 && (
              <Badge variant="outline" className={cn("text-[9px] px-1 py-0",
                event.fan_loyalty_change < 0 ? "text-social-tension border-social-tension/30" : "text-success border-success/30",
              )}>
                👥 {event.fan_loyalty_change > 0 ? "+" : ""}{event.fan_loyalty_change}
              </Badge>
            )}
            {event.streaming_multiplier !== 1 && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 text-primary border-primary/30">
                📈 {event.streaming_multiplier}x
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <Badge variant="outline" className="text-[9px] px-1 py-0 capitalize">{event.severity}</Badge>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>

      {event.twaater_hashtag && (
        <div className="mt-2 text-[10px] text-social-chemistry">
          #{event.twaater_hashtag}
        </div>
      )}
    </motion.div>
  );
}

function ArticleCard({ article }: { article: GeneratedMediaArticle }) {
  const toneColors = {
    tabloid: "border-l-social-drama",
    gossip: "border-l-social-attraction",
    serious: "border-l-social-trust",
    supportive: "border-l-success",
    neutral: "border-l-muted-foreground",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "border-l-2 pl-3 py-2.5 pr-3 rounded-r-lg bg-card/50 border border-border/30",
        toneColors[article.outlet_tone] ?? "border-l-border",
        article.is_breaking && "ring-1 ring-social-tension/30",
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {article.outlet_name}
          </span>
          {article.is_breaking && (
            <Badge variant="destructive" className="text-[9px] px-1 py-0 animate-pulse">BREAKING</Badge>
          )}
        </div>
        <h4 className="text-sm font-bold leading-tight">{article.headline}</h4>
        {article.subheadline && (
          <p className="text-[11px] text-muted-foreground italic">{article.subheadline}</p>
        )}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1">
          <span>Sentiment: {article.sentiment_score}</span>
          <span>•</span>
          <span>Controversy: {article.controversy_score}</span>
        </div>
      </div>
    </motion.div>
  );
}

export function SocialDramaFeed({ events, articles, className }: DramaFeedProps) {
  const [activeFilter, setActiveFilter] = useState("all");

  const filteredEvents = useMemo(() => {
    if (activeFilter === "all") return events;
    const tab = FILTER_TABS.find(t => t.id === activeFilter);
    if (!tab?.categories) return events;
    return events.filter(e => tab.categories!.includes(e.drama_category));
  }, [events, activeFilter]);

  // Trending topics from recent viral events
  const trendingTopics = useMemo(() => {
    return events
      .filter(e => e.went_viral || e.viral_score > 50)
      .slice(0, 5)
      .map(e => ({
        hashtag: e.twaater_hashtag ?? e.drama_category,
        score: e.viral_score,
      }));
  }, [events]);

  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-[1fr,280px] gap-4", className)}>
      {/* Main Feed */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-primary" />
            Drama & Media Feed
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Filter Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {FILTER_TABS.map((tab) => (
              <Button
                key={tab.id}
                variant={activeFilter === tab.id ? "default" : "ghost"}
                size="sm"
                className="text-xs h-7 px-2.5 flex-shrink-0"
                onClick={() => setActiveFilter(tab.id)}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          <ScrollArea className="h-[500px]">
            <AnimatePresence mode="popLayout">
              <div className="space-y-2">
                {filteredEvents.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    No drama events yet. The calm before the storm...
                  </div>
                ) : (
                  filteredEvents.map((event) => (
                    <DramaEventCard key={event.id} event={event} />
                  ))
                )}
              </div>
            </AnimatePresence>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Trending */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-social-chemistry" />
              Trending
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendingTopics.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Nothing trending</p>
            ) : (
              <div className="space-y-2">
                {trendingTopics.map((topic, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-social-chemistry font-medium">#{topic.hashtag}</span>
                    <span className="text-muted-foreground font-oswald">{topic.score}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Latest Articles */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-primary" />
              Latest Press
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {articles.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No press coverage yet</p>
                ) : (
                  articles.slice(0, 10).map((article) => (
                    <ArticleCard key={article.id} article={article} />
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
