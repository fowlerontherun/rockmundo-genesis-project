import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Trophy, MapPin, Radio, Globe, Star, Lock, CheckCircle2, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { BAND_FAME_THRESHOLDS, getBandFameTitle } from "@/utils/bandFame";

type Reach = "hyperlocal" | "local" | "regional" | "national" | "international" | "legendary";

interface TierDef {
  key: keyof typeof BAND_FAME_THRESHOLDS;
  label: string;
  fame: number;
  reach: Reach;
}

const TIERS: TierDef[] = (Object.entries(BAND_FAME_THRESHOLDS) as [keyof typeof BAND_FAME_THRESHOLDS, number][])
  .map(([key, fame]): TierDef => ({
    key,
    fame,
    label: getBandFameTitle(fame),
    reach: (fame < 300 ? "hyperlocal" :
      fame < 2000 ? "local" :
      fame < 12000 ? "regional" :
      fame < 100000 ? "national" :
      fame < 500000 ? "international" : "legendary") as Reach,
  }))
  .sort((a, b) => a.fame - b.fame);

interface Unlock {
  label: string;
  to?: string;
}

const REACH_INFO: Record<Reach, { title: string; icon: any; color: string; blurb: string; unlocks: Unlock[] }> = {
  hyperlocal: {
    title: "Hyper-local scene",
    icon: Sparkles,
    color: "text-zinc-400",
    blurb: "Bedroom, garage and open-mic stages. You're playing for friends, scene kids and a handful of regulars.",
    unlocks: [
      { label: "Open-mic venues and busking spots in your home city", to: "/open-mic" },
      { label: "Community FM + college radio stations (no fame required)", to: "/media/radio" },
      { label: "Neighborhood gazettes, DIY zines", to: "/media/newspapers" },
      { label: "Basement-tape podcasts", to: "/media/podcasts" },
      { label: "Local sound blogs will cover your first releases", to: "/media/websites" },
    ],
  },
  local: {
    title: "Local reach",
    icon: MapPin,
    color: "text-emerald-400",
    blurb: "You're the band people in your city actually know. Small clubs book you, the local press answers.",
    unlocks: [
      { label: "Small club bookings (100–500 capacity)", to: "/gig-booking" },
      { label: "Local newspaper features and weekly print circulation", to: "/media/newspapers" },
      { label: "City-wide DikCok discoverability", to: "/dikcok" },
      { label: "Twaater growth and hashtag traction", to: "/twaater" },
      { label: "First sponsorship offers from neighborhood brands", to: "/sponsorships" },
    ],
  },
  regional: {
    title: "Regional reach",
    icon: Radio,
    color: "text-sky-400",
    blurb: "Word has spread across nearby cities and your home country. Mid-size venues and the bridge media tier open up.",
    unlocks: [
      { label: "Metro Music magazine + On Record podcast (bridge media tier @ ~400 fame)", to: "/media/magazines" },
      { label: "Theaters and mid-cap venues (500–2,500 capacity)", to: "/gig-booking" },
      { label: "Regional radio rotation and chart entries", to: "/music/charts" },
      { label: "Cross-city tour routing without losing money on transit", to: "/tour-manager" },
      { label: "Festival side-stage slot offers", to: "/festivals" },
    ],
  },
  national: {
    title: "National reach",
    icon: Trophy,
    color: "text-amber-400",
    blurb: "You're a household name in your country. Major venues, national press and award nominations enter play.",
    unlocks: [
      { label: "National radio stations and TV interview shows", to: "/media/tv-shows" },
      { label: "Arena bookings (5k–20k capacity) and headline tour slots", to: "/tour-manager" },
      { label: "Major label scouting and full distribution deals", to: "/labels" },
      { label: "Award show nominations and red-carpet invites", to: "/awards" },
      { label: "National sponsorship campaigns", to: "/sponsorships" },
      { label: "Modelling offers and photo shoots", to: "/modeling" },
    ],
  },
  international: {
    title: "International reach",
    icon: Globe,
    color: "text-violet-400",
    blurb: "Neighboring countries warm up via 20% fame spillover. You're touring the world and charting abroad.",
    unlocks: [
      { label: "Stadium tours and multi-country routing", to: "/tour-manager" },
      { label: "Global streaming chart entries", to: "/country-charts" },
      { label: "Territory sales without prior visits", to: "/streaming/dashboard" },
      { label: "International press coverage and Eurovision-style events", to: "/major-events" },
      { label: "Global merchandise demand", to: "/merchandise" },
    ],
  },
  legendary: {
    title: "Legendary status",
    icon: Star,
    color: "text-fuchsia-400",
    blurb: "Hall-of-fame territory. You shape the world more than it shapes you.",
    unlocks: [
      { label: "Hall of Immortals eligibility", to: "/hall-of-immortals" },
      { label: "Permanent legacy bonuses for your children's careers", to: "/family/timeline" },
      { label: "Lifetime achievement awards and tributes", to: "/awards" },
      { label: "Maximum sponsorship + dividend ceilings", to: "/sponsorships" },
    ],
  },
};

const REACH_ORDER: Reach[] = ["hyperlocal", "local", "regional", "national", "international", "legendary"];

export default function ProgressionPanel() {
  const { profile } = useActiveProfile();
  const fame = profile?.fame ?? 0;

  const { current, next, prev } = useMemo(() => {
    let curr: TierDef | null = null;
    let nxt: TierDef | null = null;
    let prv: TierDef | null = null;
    for (let i = 0; i < TIERS.length; i++) {
      if (fame >= TIERS[i].fame) {
        curr = TIERS[i];
        prv = i > 0 ? TIERS[i - 1] : null;
        nxt = TIERS[i + 1] ?? null;
      }
    }
    if (!curr) { curr = TIERS[0]; nxt = TIERS[1] ?? null; }
    return { current: curr, next: nxt, prev: prv };
  }, [fame]);

  // Per-country fame for the regional reach context
  const { data: countryFame = [] } = useQuery({
    queryKey: ["country-fame", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("band_country_fans" as any)
        .select("country, fame, has_performed, total_fans")
        .order("fame", { ascending: false })
        .limit(10);
      return (data ?? []) as any[];
    },
  });

  const progressPct = next ? Math.min(100, Math.round(((fame - current.fame) / (next.fame - current.fame)) * 100)) : 100;
  const fameToNext = next ? Math.max(0, next.fame - fame) : 0;
  const currentReach = current.reach;

  return (
    <FMPageScaffold
      title="Progression"
      eyebrow="Career"
      subtitle="How local, regional and national reach unlock — and what fame you need next"
      icon={Trophy}
    >
      <div className="space-y-4">
        {/* Headline status card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardDescription>Current tier</CardDescription>
                <CardTitle className="text-2xl">{current.label}</CardTitle>
                <div className="text-xs text-muted-foreground mt-1">
                  {REACH_INFO[currentReach].title} · {fame.toLocaleString()} fame
                </div>
              </div>
              {next ? (
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Next tier</div>
                  <div className="font-medium">{next.label}</div>
                  <div className="text-xs text-amber-400">{fameToNext.toLocaleString()} fame to go</div>
                </div>
              ) : (
                <Badge variant="secondary">Maxed</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{current.fame.toLocaleString()}</span>
              <span>{progressPct}%</span>
              <span>{next?.fame.toLocaleString() ?? "—"}</span>
            </div>
            <Progress value={progressPct} />
            {prev && <div className="text-xs text-muted-foreground">Previous: {prev.label} ({prev.fame.toLocaleString()})</div>}
          </CardContent>
        </Card>

        {/* Reach bands */}
        <div className="grid gap-3 md:grid-cols-2">
          {REACH_ORDER.map(reach => {
            const info = REACH_INFO[reach];
            const Icon = info.icon;
            const tiersInBand = TIERS.filter(t => t.reach === reach);
            const minFame = tiersInBand[0]?.fame ?? 0;
            const maxFame = tiersInBand[tiersInBand.length - 1]?.fame ?? 0;
            const unlocked = fame >= minFame;
            const active = currentReach === reach;
            return (
              <Card key={reach} className={active ? "border-primary" : unlocked ? "" : "opacity-70"}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${info.color}`} />
                      <CardTitle className="text-base">{info.title}</CardTitle>
                    </div>
                    {active ? <Badge>Active</Badge>
                      : unlocked ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      : <Lock className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <CardDescription className="text-xs">
                    {minFame.toLocaleString()}{maxFame !== minFame ? `–${maxFame.toLocaleString()}` : "+"} fame · {tiersInBand.length} tier{tiersInBand.length === 1 ? "" : "s"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">{info.blurb}</p>
                  <div>
                    <div className="text-xs font-medium mb-1">What this unlocks</div>
                    <ul className="space-y-1 text-xs">
                      {info.unlocks.map(u => (
                        <li key={u.label} className="flex gap-2 items-start">
                          <span className="text-primary mt-0.5">•</span>
                          {u.to ? (
                            <Link
                              to={u.to}
                              className="group inline-flex items-start gap-1 text-muted-foreground hover:text-primary transition-colors"
                            >
                              <span className="underline-offset-2 group-hover:underline">{u.label}</span>
                              <ArrowUpRight className="h-3 w-3 mt-0.5 opacity-60 group-hover:opacity-100 flex-shrink-0" />
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">{u.label}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tiersInBand.map(t => (
                      <Badge key={t.key} variant={fame >= t.fame ? "secondary" : "outline"} className="text-[10px]">
                        {t.label} · {t.fame.toLocaleString()}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Regional fame snapshot */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Regional fame breakdown</CardTitle>
            <CardDescription>
              Each country tracks fame independently. Performing in a country lifts the 100-fame cap; neighbors get a 20% spillover automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {countryFame.length === 0 ? (
              <p className="text-xs text-muted-foreground">No country-level fame yet — play your first gig to register a country.</p>
            ) : (
              <div className="space-y-2">
                {countryFame.map((c: any) => (
                  <div key={c.country} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.country}</span>
                      {c.has_performed ? <Badge variant="secondary" className="text-[10px]">Visited</Badge>
                        : <Badge variant="outline" className="text-[10px]">Spillover only · cap 100</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {Number(c.fame).toLocaleString()} fame · {Number(c.total_fans).toLocaleString()} fans
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </FMPageScaffold>
  );
}
