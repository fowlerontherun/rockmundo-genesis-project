import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BookOpen, Eye, EyeOff, Lock, CheckCircle2, MapPin, Music, Building,
  Sparkles, Search, Compass,
} from "lucide-react";
import { useMentorSessions } from "@/hooks/useMentorSessions";
import { formatFocusSkill } from "@/pages/admin/mentors.helpers";
import { getDiscoveryMethodInfo } from "@/utils/mentorDiscovery";

const HINT_STORAGE_KEY = "rm.mentorHintsRevealed";

const loadRevealed = (): Set<string> => {
  try {
    const raw = localStorage.getItem(HINT_STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
};

const saveRevealed = (set: Set<string>) => {
  try {
    localStorage.setItem(HINT_STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
};

const DiscoveryTypeIcon = ({ type }: { type?: string | null }) => {
  if (type === "venue_gig") return <Music className="h-4 w-4" />;
  if (type === "studio_session") return <Building className="h-4 w-4" />;
  if (type === "achievement") return <Sparkles className="h-4 w-4" />;
  return <Compass className="h-4 w-4" />;
};

const describeMethod = (type?: string | null) => {
  switch (type) {
    case "venue_gig":
      return "Perform at the right venue to catch this master's attention.";
    case "studio_session":
      return "Record at their favoured studio to be introduced.";
    case "achievement":
      return "Unlock a specific achievement to be introduced.";
    case "exploration":
      return "Travel the world and follow local leads.";
    case "automatic":
      return "Auto-granted starter mentor.";
    default:
      return "Discovery method unknown — explore to find them.";
  }
};

export const MentorDiscoveryJournal = () => {
  const {
    mentors,
    hasClaimedDiscovery,
    getDiscovery,
    discoverMaster,
    isDiscovering,
    discoveredCount,
    totalMentors,
    isInMentorCity,
  } = useMentorSessions();

  const [revealed, setRevealed] = useState<Set<string>>(loadRevealed);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"locked" | "unlocked" | "all">("locked");

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveRevealed(next);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (mentors ?? []).filter((m) => {
      const claimed = hasClaimedDiscovery(m.id);
      if (tab === "locked" && claimed) return false;
      if (tab === "unlocked" && !claimed) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        (m.specialty ?? "").toLowerCase().includes(q) ||
        (m.city?.name ?? "").toLowerCase().includes(q) ||
        formatFocusSkill(m.focus_skill).toLowerCase().includes(q)
      );
    });
  }, [mentors, search, tab, hasClaimedDiscovery]);

  const progressPct = totalMentors > 0 ? Math.floor((discoveredCount / totalMentors) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Discovery Journal
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Reveal hints for undiscovered masters and mark them as claimed once you meet them in the world.
          </p>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1 self-start">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {discoveredCount} / {totalMentors} claimed
        </Badge>
      </div>

      <Card className="bg-card/50">
        <CardContent className="pt-4 pb-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Journal progress</span>
            <span className="font-semibold">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="locked" className="gap-1">
              <Lock className="h-3 w-3" />
              Locked ({Math.max(0, totalMentors - discoveredCount)})
            </TabsTrigger>
            <TabsTrigger value="unlocked" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Unlocked ({discoveredCount})
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-1">
              <Sparkles className="h-3 w-3" />
              All
            </TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-0" />
        </Tabs>
        <div className="relative sm:max-w-xs w-full">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, city, skill…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((mentor) => {
          const claimed = hasClaimedDiscovery(mentor.id);
          const discovery = getDiscovery(mentor.id);
          const isRevealed = revealed.has(mentor.id) || claimed;
          const inCity = isInMentorCity(mentor.city_id);
          const methodInfo = getDiscoveryMethodInfo(
            discovery?.discovery_method ?? mentor.discovery_type ?? "exploration",
          );

          return (
            <Card
              key={mentor.id}
              className={`flex flex-col ${claimed ? "border-primary/40" : "bg-muted/20"}`}
            >
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">
                    {claimed ? mentor.name : "??? Unknown Master"}
                  </CardTitle>
                  <Badge variant={claimed ? "default" : "outline"} className="text-xs">
                    {claimed ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Claimed
                      </>
                    ) : (
                      <>
                        <Lock className="h-3 w-3 mr-1" />
                        Locked
                      </>
                    )}
                  </Badge>
                </div>
                <CardDescription className="text-xs flex items-center gap-2">
                  <DiscoveryTypeIcon type={mentor.discovery_type} />
                  <span className={methodInfo.color}>{methodInfo.label}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <div className="rounded-md border border-dashed border-border/60 bg-background/40 p-3 min-h-[64px]">
                  {isRevealed ? (
                    <p className="text-sm italic text-foreground/90">
                      {mentor.discovery_hint || describeMethod(mentor.discovery_type)}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Hint hidden. Reveal it to see how to find this master.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {claimed || isRevealed ? mentor.city?.name ?? "Unknown city" : "???"}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                    {claimed || isRevealed ? formatFocusSkill(mentor.focus_skill) : "???"}
                  </div>
                </div>

                {claimed && discovery?.discovered_at && (
                  <p className="text-[11px] text-muted-foreground">
                    Discovered {new Date(discovery.discovered_at).toLocaleDateString()} via {methodInfo.label}.
                  </p>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  {!claimed && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => toggleReveal(mentor.id)}
                    >
                      {revealed.has(mentor.id) ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-1.5" />
                          Hide hint
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-1.5" />
                          Reveal hint
                        </>
                      )}
                    </Button>
                  )}
                  {!claimed && (
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={isDiscovering || !inCity}
                      title={!inCity ? "Visit their city to claim" : undefined}
                      onClick={() =>
                        discoverMaster({ mentorId: mentor.id, method: "exploration" })
                      }
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      {inCity ? "Mark as found" : "Travel to claim"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {tab === "locked"
                ? "No locked masters match your search."
                : tab === "unlocked"
                ? "You haven't claimed any masters yet — reveal a hint to get started."
                : "No masters match your search."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
