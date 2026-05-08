import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Coins, Gem, Package, Sparkles, Info, Shield, Clock, CalendarClock, Lock, XCircle, BarChart3 } from "lucide-react";
import { BlindBoxPurchaseDialog } from "@/components/store/BlindBoxPurchaseDialog";
import { BlindBoxRevealDialog } from "@/components/store/BlindBoxRevealDialog";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export type BlindBox = {
  id: string;
  slug: string;
  name: string;
  theme_genre: string;
  description: string;
  image_url: string | null;
  price_cash: number;
  price_premium: number;
  currency: "cash" | "premium";
  is_premium: boolean;
  available_from: string | null;
  available_until: string | null;
  skill_slugs: string[];
  tier_odds: Record<string, number>;
  pity_threshold: number;
  active: boolean;
};

export type RevealResult = {
  tier: string;
  xp: number;
  ap: number;
  skill_slug: string;
  instrument: { name: string; type: string; quality: number };
  song: { id: string | null; title: string; quality: number; genre: string };
  new_balance: number;
  currency: "cash" | "premium";
  duplicate?: boolean;
  dupe_count?: number;
  base_xp?: number;
  base_ap?: number;
  materials?: Array<{ name: string; quantity: number; rarity: string }>;
};

const TIER_COLOR: Record<string, string> = {
  common: "text-slate-300",
  rare: "text-blue-300",
  epic: "text-purple-300",
  legendary: "text-amber-300",
};

const TIER_BAR: Record<string, string> = {
  common: "bg-slate-400",
  rare: "bg-blue-400",
  epic: "bg-purple-400",
  legendary: "bg-amber-400",
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

type Availability = {
  status: "live" | "upcoming" | "expired" | "always";
  msUntilStart: number;
  msUntilEnd: number;
  startsAt: Date | null;
  endsAt: Date | null;
  endingSoon: boolean;
};

function getAvailability(box: BlindBox, now: number): Availability {
  const startsAt = box.available_from ? new Date(box.available_from) : null;
  const endsAt = box.available_until ? new Date(box.available_until) : null;
  const msUntilStart = startsAt ? startsAt.getTime() - now : 0;
  const msUntilEnd = endsAt ? endsAt.getTime() - now : Infinity;
  let status: Availability["status"] = "always";
  if (startsAt && msUntilStart > 0) status = "upcoming";
  else if (endsAt && msUntilEnd <= 0) status = "expired";
  else if (startsAt || endsAt) status = "live";
  return {
    status,
    msUntilStart,
    msUntilEnd,
    startsAt,
    endsAt,
    endingSoon: status === "live" && endsAt !== null && msUntilEnd <= 1000 * 60 * 60 * 24,
  };
}

export default function BlindBoxStore() {
  const { profile, profileId } = useActiveProfile();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<BlindBox | null>(null);
  const [reveal, setReveal] = useState<RevealResult | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: boxes = [], isLoading } = useQuery({
    queryKey: ["blind-boxes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blind_boxes" as any)
        .select("*")
        .eq("active", true)
        .order("is_premium", { ascending: true })
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as BlindBox[];
    },
  });

  const { data: pityRows = [] } = useQuery({
    queryKey: ["blind-box-pity", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blind_box_pity" as any)
        .select("box_id, opens_since_epic, total_opens")
        .eq("profile_id", profileId!);
      if (error) throw error;
      return ((data ?? []) as unknown) as Array<{
        box_id: string;
        opens_since_epic: number;
        total_opens: number;
      }>;
    },
  });

  const pityByBox = new Map(pityRows.map((p) => [p.box_id, p]));

  const cash = profile?.cash ?? 0;
  const tokens = (profile as any)?.premium_tokens ?? 0;

  const onPurchased = (result: RevealResult) => {
    setSelected(null);
    setReveal(result);
    qc.invalidateQueries({ queryKey: ["active-profile"] });
    qc.invalidateQueries({ queryKey: ["player-personal-gear"] });
    qc.invalidateQueries({ queryKey: ["songs"] });
    qc.invalidateQueries({ queryKey: ["blind-box-pity", profileId] });
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-4 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" /> Blind Box Store
          </h1>
          <p className="text-sm text-muted-foreground">
            Themed mystery boxes — XP, AP, a unique instrument, and a random song.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-7">
            <Link to="/blind-boxes/inventory">
              <Package className="h-3.5 w-3.5 mr-1" /> Inventory
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-7">
            <Link to="/blind-boxes/analytics">
              <BarChart3 className="h-3.5 w-3.5 mr-1" /> Analytics
            </Link>
          </Button>
          <Badge variant="outline" className="gap-1">
            <Coins className="h-3 w-3" /> ${cash.toLocaleString()}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Gem className="h-3 w-3 text-purple-400" /> {tokens} tokens
          </Badge>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading boxes…</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {boxes.map((box) => {
            const isPrem = box.currency === "premium";
            const price = isPrem ? box.price_premium : box.price_cash;
            const balance = isPrem ? tokens : cash;
            const canAfford = balance >= price;
            const pity = pityByBox.get(box.id);
            const opensSince = pity?.opens_since_epic ?? 0;
            const threshold = box.pity_threshold ?? 20;
            const opensUntil = Math.max(0, threshold - opensSince);
            const pityPct = Math.min(100, (opensSince / threshold) * 100);
            const avail = getAvailability(box, now);
            const isOpenable = avail.status === "live" || avail.status === "always";
            const disabledReason = !profileId
              ? "Select a character first"
              : avail.status === "upcoming"
              ? `Unlocks in ${formatCountdown(avail.msUntilStart)}`
              : avail.status === "expired"
              ? "This box has expired"
              : !canAfford
              ? "Insufficient funds"
              : null;

            return (
              <Card
                key={box.id}
                className={cn(
                  "overflow-hidden transition-opacity",
                  !isOpenable && "opacity-75",
                  avail.status === "expired" && "opacity-60",
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{box.name}</CardTitle>
                    {isPrem && (
                      <Badge variant="secondary" className="gap-1">
                        <Sparkles className="h-3 w-3" /> Premium
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant="outline" className="w-fit text-[10px]">
                      {box.theme_genre}
                    </Badge>
                    {avail.status === "upcoming" && (
                      <Badge variant="outline" className="text-[10px] gap-1 border-blue-400/50 text-blue-300">
                        <CalendarClock className="h-3 w-3" /> Upcoming
                      </Badge>
                    )}
                    {avail.status === "live" && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] gap-1",
                          avail.endingSoon
                            ? "border-amber-400/60 text-amber-300 animate-pulse"
                            : "border-emerald-400/50 text-emerald-300",
                        )}
                      >
                        <Clock className="h-3 w-3" />
                        {avail.endsAt
                          ? `Ends in ${formatCountdown(avail.msUntilEnd)}`
                          : "Live"}
                      </Badge>
                    )}
                    {avail.status === "expired" && (
                      <Badge variant="outline" className="text-[10px] gap-1 border-destructive/50 text-destructive">
                        <XCircle className="h-3 w-3" /> Expired
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">{box.description}</p>

                  {/* Odds popover trigger */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-between h-8"
                      >
                        <span className="flex items-center gap-1 text-xs">
                          <Info className="h-3 w-3" /> View odds
                        </span>
                        <span className="flex gap-1">
                          {Object.entries(box.tier_odds).map(([tier, pct]) => (
                            <span
                              key={tier}
                              className={cn("text-[10px] tabular-nums", TIER_COLOR[tier])}
                            >
                              {pct}%
                            </span>
                          ))}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 space-y-2 p-3" align="start">
                      <div>
                        <p className="text-xs font-semibold">Drop rates</p>
                        <p className="text-[10px] text-muted-foreground">
                          Each opening rolls one tier independently.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        {Object.entries(box.tier_odds).map(([tier, pct]) => (
                          <div key={tier} className="space-y-0.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className={cn("capitalize font-medium", TIER_COLOR[tier])}>
                                {tier}
                              </span>
                              <span className="tabular-nums text-muted-foreground">{pct}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", TIER_BAR[tier])}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-md border bg-muted/40 p-2 text-[10px] text-muted-foreground flex items-start gap-1.5">
                        <Shield className="h-3 w-3 mt-0.5 text-amber-400 flex-shrink-0" />
                        <span>
                          <strong className="text-foreground">Pity guarantee:</strong> if you open{" "}
                          {threshold} boxes without rolling Epic or Legendary, the next opening is
                          guaranteed Epic+.
                        </span>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Pity progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Shield className="h-3 w-3 text-amber-400" /> Epic+ pity
                      </span>
                      <span className="tabular-nums">
                        {opensUntil === 0
                          ? "Next box guaranteed!"
                          : `${opensSince}/${threshold} (${opensUntil} to go)`}
                      </span>
                    </div>
                    <Progress
                      value={pityPct}
                      className={cn(
                        "h-1.5",
                        opensUntil === 0 && "[&>div]:bg-amber-400 [&>div]:animate-pulse",
                        opensUntil > 0 && opensUntil <= 3 && "[&>div]:bg-amber-400/70",
                      )}
                    />
                  </div>

                  {/* Availability window detail */}
                  {(avail.startsAt || avail.endsAt) && (
                    <div className="rounded-md border bg-muted/30 p-2 text-[10px] text-muted-foreground space-y-0.5">
                      {avail.status === "upcoming" && (
                        <div className="flex items-center gap-1.5 text-blue-300">
                          <Lock className="h-3 w-3" />
                          <span>
                            Unlocks in <span className="tabular-nums font-semibold">{formatCountdown(avail.msUntilStart)}</span>
                          </span>
                        </div>
                      )}
                      {avail.status === "live" && avail.endsAt && (
                        <div className={cn("flex items-center gap-1.5", avail.endingSoon && "text-amber-300")}>
                          <Clock className="h-3 w-3" />
                          <span>
                            Ends in <span className="tabular-nums font-semibold">{formatCountdown(avail.msUntilEnd)}</span>
                          </span>
                        </div>
                      )}
                      {avail.status === "expired" && (
                        <div className="flex items-center gap-1.5 text-destructive">
                          <XCircle className="h-3 w-3" />
                          <span>Expired {avail.endsAt?.toLocaleDateString()}</span>
                        </div>
                      )}
                      {avail.startsAt && (
                        <div className="opacity-70">From: {avail.startsAt.toLocaleString()}</div>
                      )}
                      {avail.endsAt && (
                        <div className="opacity-70">Until: {avail.endsAt.toLocaleString()}</div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 font-semibold">
                      {isPrem ? (
                        <>
                          <Gem className="h-4 w-4 text-purple-400" /> {price}
                        </>
                      ) : (
                        <>
                          <Coins className="h-4 w-4" /> ${price.toLocaleString()}
                        </>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setSelected(box)}
                      disabled={!isOpenable || !profileId || !canAfford}
                      title={disabledReason ?? undefined}
                    >
                      {avail.status === "upcoming"
                        ? "Locked"
                        : avail.status === "expired"
                        ? "Expired"
                        : canAfford
                        ? "Open Box"
                        : "Insufficient funds"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <BlindBoxPurchaseDialog
        box={selected}
        balance={selected?.currency === "premium" ? tokens : cash}
        onClose={() => setSelected(null)}
        onPurchased={onPurchased}
      />
      <BlindBoxRevealDialog reveal={reveal} onClose={() => setReveal(null)} />
    </div>
  );
}
