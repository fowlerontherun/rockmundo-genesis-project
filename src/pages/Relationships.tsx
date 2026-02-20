import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Users, Swords, Music, Sparkles, Search,
  Flame, Theater, Baby, Activity, TrendingUp,
  Shield, Zap, Star, Crown,
} from "lucide-react";
import { ScoreGauge } from "@/components/social/ScoreGauge";
import { EmotionalStatePanel } from "@/components/social/EmotionalStatePanel";

// ── Mock data for demonstration ─────────────────────────────────────────
const MOCK_RELATIONSHIPS = [
  { id: "1", name: "Luna Voss", type: ["friend", "bandmate"] as string[], affection: 72, trust: 85, attraction: 40, loyalty: 90, jealousy: 10, avatar: "LV", fame: 4200, status: "positive" },
  { id: "2", name: "Rex Thunder", type: ["rival"] as string[], affection: -30, trust: 15, attraction: 5, loyalty: 8, jealousy: 65, avatar: "RT", fame: 8900, status: "negative" },
  { id: "3", name: "Mia Sterling", type: ["partner", "collaborator"] as string[], affection: 88, trust: 70, attraction: 92, loyalty: 75, jealousy: 35, avatar: "MS", fame: 3100, status: "romantic" },
  { id: "4", name: "DJ Krush", type: ["mentor"] as string[], affection: 55, trust: 90, attraction: 10, loyalty: 80, jealousy: 0, avatar: "DK", fame: 15000, status: "positive" },
  { id: "5", name: "Zara Night", type: ["ex_partner", "rival"] as string[], affection: -15, trust: 20, attraction: 60, loyalty: 5, jealousy: 80, avatar: "ZN", fame: 6700, status: "tense" },
  { id: "6", name: "Tommy Bass", type: ["bandmate", "friend"] as string[], affection: 60, trust: 75, attraction: 5, loyalty: 85, jealousy: 15, avatar: "TB", fame: 2800, status: "positive" },
];

const FILTER_CATEGORIES = [
  { key: "all", label: "All", icon: Users },
  { key: "friend", label: "Friends", icon: Heart },
  { key: "rival", label: "Rivals", icon: Swords },
  { key: "partner", label: "Romance", icon: Flame },
  { key: "bandmate", label: "Bandmates", icon: Music },
  { key: "mentor", label: "Mentors", icon: Star },
  { key: "ex_partner", label: "Exes", icon: Theater },
];

const DRAMA_FEED = [
  { id: "d1", headline: "Luna Voss spotted leaving studio with mystery collaborator", category: "scandal", time: "2h ago", impact: "minor" },
  { id: "d2", headline: "Rex Thunder releases diss track targeting YOUR band!", category: "rivalry", time: "5h ago", impact: "major" },
  { id: "d3", headline: "Surprise engagement! Mia Sterling says yes backstage", category: "romance", time: "1d ago", impact: "viral" },
  { id: "d4", headline: "On-stage confrontation at Metro Arena goes viral", category: "scandal", time: "2d ago", impact: "major" },
  { id: "d5", headline: "Tommy Bass dedicates new song to bandmates", category: "positive", time: "3d ago", impact: "minor" },
];

function getStatusGlow(status: string) {
  switch (status) {
    case "positive": return "border-social-friendship/40 shadow-[0_0_12px_hsl(var(--social-friendship)/0.15)]";
    case "romantic": return "border-social-love/40 shadow-[0_0_12px_hsl(var(--social-love)/0.15)]";
    case "negative": return "border-social-rivalry/40 shadow-[0_0_12px_hsl(var(--social-rivalry)/0.15)]";
    case "tense": return "border-social-tension/40 shadow-[0_0_12px_hsl(var(--social-tension)/0.15)]";
    default: return "border-border";
  }
}

function getTypeColor(type: string) {
  switch (type) {
    case "friend": case "close_friend": return "bg-social-friendship/20 text-social-friendship border-social-friendship/30";
    case "rival": case "nemesis": return "bg-social-rivalry/20 text-social-rivalry border-social-rivalry/30";
    case "partner": return "bg-social-love/20 text-social-love border-social-love/30";
    case "bandmate": return "bg-social-chemistry/20 text-social-chemistry border-social-chemistry/30";
    case "mentor": case "protege": return "bg-social-loyalty/20 text-social-loyalty border-social-loyalty/30";
    case "ex_partner": return "bg-social-tension/20 text-social-tension border-social-tension/30";
    case "collaborator": return "bg-social-trust/20 text-social-trust border-social-trust/30";
    default: return "bg-muted text-muted-foreground";
  }
}

export default function RelationshipsPage() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>("1");

  const filtered = MOCK_RELATIONSHIPS.filter((r) => {
    if (filter !== "all" && !r.type.includes(filter)) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selected = MOCK_RELATIONSHIPS.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Heart className="h-8 w-8 text-social-love" />
            Social &amp; Relationships
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your connections, track chemistry, and navigate the drama of the music world.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {MOCK_RELATIONSHIPS.length} connections
          </Badge>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="network" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="network" className="gap-2"><Users className="h-4 w-4" /> Network</TabsTrigger>
          <TabsTrigger value="drama" className="gap-2"><Theater className="h-4 w-4" /> Drama Feed</TabsTrigger>
          <TabsTrigger value="romance" className="gap-2"><Flame className="h-4 w-4" /> Romance</TabsTrigger>
          <TabsTrigger value="legacy" className="gap-2"><Baby className="h-4 w-4" /> Family</TabsTrigger>
        </TabsList>

        {/* ── NETWORK TAB ──────────────────────────────────────── */}
        <TabsContent value="network" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {FILTER_CATEGORIES.map((cat) => (
              <Button
                key={cat.key}
                size="sm"
                variant={filter === cat.key ? "default" : "outline"}
                onClick={() => setFilter(cat.key)}
                className="gap-1.5 text-xs"
              >
                <cat.icon className="h-3.5 w-3.5" />
                {cat.label}
              </Button>
            ))}
            <div className="ml-auto relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search connections..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-56 h-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr,1.4fr] gap-4">
            {/* Relationship List */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Connections</CardTitle>
                <CardDescription>{filtered.length} shown</CardDescription>
              </CardHeader>
              <ScrollArea className="h-[520px]">
                <CardContent className="space-y-2 pr-4">
                  <AnimatePresence mode="popLayout">
                    {filtered.map((rel) => (
                      <motion.div
                        key={rel.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                      >
                        <button
                          onClick={() => setSelectedId(rel.id)}
                          className={cn(
                            "w-full text-left p-3 rounded-lg border transition-all duration-200 hover:bg-accent/50",
                            selectedId === rel.id ? getStatusGlow(rel.status) : "border-border",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
                              rel.status === "romantic" ? "bg-social-love/20 text-social-love" :
                              rel.status === "negative" ? "bg-social-rivalry/20 text-social-rivalry" :
                              "bg-primary/20 text-primary"
                            )}>
                              {rel.avatar}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{rel.name}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {rel.type.map((t) => (
                                  <Badge key={t} variant="outline" className={cn("text-[10px] px-1.5 py-0", getTypeColor(t))}>
                                    {t.replace("_", " ")}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">{rel.fame.toLocaleString()}</p>
                              <p className="text-[10px] text-muted-foreground">fame</p>
                            </div>
                          </div>
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </CardContent>
              </ScrollArea>
            </Card>

            {/* Detail Panel */}
            {selected ? (
              <Card className={cn("border transition-all duration-300", getStatusGlow(selected.status))}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold",
                        selected.status === "romantic" ? "bg-social-love/20 text-social-love" :
                        selected.status === "negative" ? "bg-social-rivalry/20 text-social-rivalry" :
                        "bg-primary/20 text-primary"
                      )}>
                        {selected.avatar}
                      </div>
                      <div>
                        <CardTitle className="text-xl">{selected.name}</CardTitle>
                        <CardDescription>
                          Fame {selected.fame.toLocaleString()} • {selected.type.map(t => t.replace("_", " ")).join(", ")}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {selected.type.map((t) => (
                        <Badge key={t} className={cn("text-xs", getTypeColor(t))}>
                          {t.replace("_", " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Emotional Metrics */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-social-chemistry" />
                      Emotional Metrics
                    </h3>
                    <div className="grid grid-cols-5 gap-3">
                      <ScoreGauge label="Affection" value={selected.affection} max={100} min={-100} color="social-love" variant="bar" size="sm" glowOnHigh />
                      <ScoreGauge label="Trust" value={selected.trust} max={100} color="social-trust" variant="bar" size="sm" glowOnHigh />
                      <ScoreGauge label="Attraction" value={selected.attraction} max={100} color="social-attraction" variant="bar" size="sm" />
                      <ScoreGauge label="Loyalty" value={selected.loyalty} max={100} color="social-loyalty" variant="bar" size="sm" glowOnHigh />
                      <ScoreGauge label="Jealousy" value={selected.jealousy} max={100} color="social-tension" variant="bar" size="sm" />
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      Quick Actions
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {["Chat", "Gift", "Collaborate", "Challenge", "Flirt", "Confront"].map((action) => (
                        <Button key={action} size="sm" variant="outline" className="text-xs">
                          {action}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Gameplay Modifiers */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-border p-3 text-center">
                      <p className="text-xs text-muted-foreground">Song Quality</p>
                      <p className="text-lg font-bold text-social-chemistry">
                        {(0.7 + selected.trust / 200 + selected.loyalty / 300).toFixed(2)}x
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-3 text-center">
                      <p className="text-xs text-muted-foreground">Collab Bonus</p>
                      <p className="text-lg font-bold text-social-trust">
                        +{Math.round(selected.affection * 0.3 + selected.trust * 0.2)}%
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-3 text-center">
                      <p className="text-xs text-muted-foreground">Drama Risk</p>
                      <p className="text-lg font-bold text-social-tension">
                        {Math.min(100, Math.round(selected.jealousy * 0.8 + (100 - selected.trust) * 0.2))}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="flex items-center justify-center h-full">
                <CardContent className="text-center text-muted-foreground py-20">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>Select a connection to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── DRAMA FEED TAB ──────────────────────────────────── */}
        <TabsContent value="drama" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Theater className="h-5 w-5 text-social-tension" />
                  Drama &amp; Media Feed
                </CardTitle>
                <CardDescription>Latest relationship events and scandals in the music world</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {DRAMA_FEED.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "p-4 rounded-lg border transition-all",
                      item.impact === "viral" && "border-social-love/40 bg-social-love/5",
                      item.impact === "major" && "border-social-tension/40 bg-social-tension/5",
                      item.impact === "minor" && "border-border",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.headline}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                          <span className="text-xs text-muted-foreground">{item.time}</span>
                        </div>
                      </div>
                      {item.impact === "viral" && (
                        <Badge className="bg-social-love/20 text-social-love border-social-love/30 text-[10px] animate-pulse">
                          🔥 VIRAL
                        </Badge>
                      )}
                      {item.impact === "major" && (
                        <Badge className="bg-social-tension/20 text-social-tension border-social-tension/30 text-[10px]">
                          ⚡ MAJOR
                        </Badge>
                      )}
                    </div>
                  </motion.div>
                ))}
              </CardContent>
            </Card>

            {/* Trending Sidebar */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-social-chemistry" />
                  Trending
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {["#SurpriseEngagement", "#DissTrackWar", "#BandBreakup", "#StudioDrama", "#SecretAffair"].map((tag, i) => (
                  <div key={tag} className="flex items-center justify-between">
                    <span className="text-sm text-social-chemistry font-medium">{tag}</span>
                    <span className="text-xs text-muted-foreground">{(5 - i) * 12}k posts</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── ROMANCE TAB ─────────────────────────────────────── */}
        <TabsContent value="romance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-social-love" />
                Romantic Connections
              </CardTitle>
              <CardDescription>Track your romantic progressions and compatibility</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MOCK_RELATIONSHIPS.filter(r => r.type.includes("partner") || r.type.includes("ex_partner")).map((rel) => (
                  <div key={rel.id} className={cn("rounded-lg border p-4", getStatusGlow(rel.status))}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-social-love/20 text-social-love flex items-center justify-center font-bold">
                        {rel.avatar}
                      </div>
                      <div>
                        <p className="font-semibold">{rel.name}</p>
                        <p className="text-xs text-muted-foreground">{rel.type.includes("partner") ? "💕 Active Romance" : "💔 Former Flame"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <ScoreGauge label="Attraction" value={rel.attraction} max={100} color="social-attraction" variant="bar" size="sm" />
                      <ScoreGauge label="Jealousy Risk" value={rel.jealousy} max={100} color="social-tension" variant="bar" size="sm" />
                      <ScoreGauge label="Affection" value={Math.max(0, rel.affection)} max={100} color="social-love" variant="bar" size="sm" />
                      <ScoreGauge label="Loyalty" value={rel.loyalty} max={100} color="social-loyalty" variant="bar" size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── FAMILY TAB ──────────────────────────────────────── */}
        <TabsContent value="legacy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Baby className="h-5 w-5 text-social-loyalty" />
                Family &amp; Legacy
              </CardTitle>
              <CardDescription>Your family tree, legacy pressure, and generational fame</CardDescription>
            </CardHeader>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Crown className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No family connections yet</p>
              <p className="text-sm mt-1">Start a romance and build your musical dynasty!</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Emotional State Widget (embedded) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-social-chemistry/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-social-chemistry" />
              Your Emotional State
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Happiness", value: 72, color: "social-friendship" },
                { label: "Loneliness", value: 15, color: "social-trust" },
                { label: "Inspiration", value: 88, color: "social-chemistry" },
                { label: "Jealousy", value: 25, color: "social-tension" },
                { label: "Resentment", value: 8, color: "social-rivalry" },
                { label: "Obsession", value: 30, color: "social-love" },
              ].map((e) => (
                <ScoreGauge key={e.label} label={e.label} value={e.value} max={100} color={e.color} variant="bar" size="sm" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-social-trust" />
              Gameplay Modifiers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Songwriting Quality", value: "+12%", desc: "High inspiration & happiness" },
              { label: "Performance Energy", value: "+8%", desc: "Low loneliness, strong bonds" },
              { label: "Fan Engagement", value: "+15%", desc: "Active social life attracts fans" },
              { label: "Drama Susceptibility", value: "22%", desc: "Moderate jealousy levels" },
            ].map((mod) => (
              <div key={mod.label} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">{mod.label}</p>
                  <p className="text-xs text-muted-foreground">{mod.desc}</p>
                </div>
                <Badge variant="secondary" className="font-mono">{mod.value}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
