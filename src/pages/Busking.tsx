import React from "react";
import { Coins, History, Loader2, Music, Music2, Scale } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { useGameData } from "@/hooks/useGameData";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables } from "@/lib/supabase-types";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

const SESSION_LENGTHS = [30, 60, 120] as const;
type SessionLength = (typeof SESSION_LENGTHS)[number];

type SessionReward = {
  experience: number;
  cash: number;
};

type BuskingLocation = {
  id: string;
  name: string;
  neighborhood: string;
  description: string;
  vibe: string;
  tip: string;
  rewards: Record<string, SessionReward>;
};

type BuskingOptions = {
  profileId: string;
  cityId: string;
  cityName: string;
  licenceFee: number;
  audienceDemandMultiplier: number;
  spots: BuskingLocation[];
};

type BuskingResult = {
  sessionId: string;
  locationName: string;
  duration: SessionLength;
  xpGained: number;
  cashEarned: number;
  licenceFee: number;
  netCashChange: number;
  startedAt: string;
  endsAt: string;
  performanceDescriptor: string;
  cityDemandMultiplier: number;
};

type ProfileActivityStatus = Database["public"]["Tables"]["profile_activity_statuses"]["Row"];

const sessionOptions: { value: SessionLength; label: string; description: string }[] = [
  { value: 30, label: "30 minutes", description: "Quick warm-up set." },
  { value: 60, label: "1 hour", description: "Prime-time showcase." },
  { value: 120, label: "2 hours", description: "Full evening takeover." },
];

const getReward = (location: BuskingLocation | undefined, duration: SessionLength): SessionReward =>
  location?.rewards?.[String(duration)] ?? { experience: 0, cash: 0 };

const getStatusEndDate = (status: ProfileActivityStatus | null): Date | null => {
  if (!status) return null;
  if (status.ends_at) {
    const ends = new Date(status.ends_at);
    if (!Number.isNaN(ends.getTime())) return ends;
  }
  if (!status.started_at || typeof status.duration_minutes !== "number") return null;
  const start = new Date(status.started_at);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + status.duration_minutes * 60_000);
};

const formatSessionWindow = (startIso: string, endIso: string): string => {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return `${startIso} – ${endIso}`;
  const formatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
};

const friendlyBuskingError = (message: string) => {
  if (message.includes("busking_player_busy")) return "You already have an activity in progress.";
  if (message.includes("busking_schedule_conflict")) return "This busking session overlaps another scheduled activity.";
  if (message.includes("busking_insufficient_funds_for_licence")) return "You do not have enough cash to pay this city's busking licence fee.";
  if (message.includes("busking_invalid_location")) return "That busking location is no longer available in your current city.";
  if (message.includes("busking_city_not_set")) return "Your character needs to be in a city before busking.";
  return message || "Unable to start busking.";
};

export default function Busking() {
  const { profile, activityStatus, refreshActivityStatus, refetch } = useGameData();
  const { toast } = useToast();
  const [selectedLocationId, setSelectedLocationId] = React.useState("");
  const [selectedLength, setSelectedLength] = React.useState<SessionLength>(30);
  const [showHistory, setShowHistory] = React.useState(false);
  const [isStartingSession, setIsStartingSession] = React.useState(false);
  const [statusLoading, setStatusLoading] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<BuskingResult | null>(null);

  const {
    data: buskingOptions,
    isLoading: optionsLoading,
    error: optionsError,
    refetch: refetchOptions,
  } = useQuery<BuskingOptions>({
    queryKey: ["authoritative-busking-options", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("busking-session", {
        body: { action: "options" },
      });
      if (error) throw error;
      if (!data?.success || !data?.options) throw new Error(data?.error || "Busking options could not be loaded");
      return data.options as BuskingOptions;
    },
    enabled: !!profile?.id,
  });

  const buskingLocations = buskingOptions?.spots ?? [];

  React.useEffect(() => {
    if (buskingLocations.length > 0 && !buskingLocations.some((location) => location.id === selectedLocationId)) {
      setSelectedLocationId(buskingLocations[0].id);
    }
  }, [buskingLocations, selectedLocationId]);

  const activeLocation = React.useMemo(
    () => buskingLocations.find((location) => location.id === selectedLocationId) ?? buskingLocations[0],
    [buskingLocations, selectedLocationId],
  );
  const activeReward = getReward(activeLocation, selectedLength);
  const licenceFee = Math.max(0, Number(buskingOptions?.licenceFee ?? 0));
  const demandMultiplier = Number(buskingOptions?.audienceDemandMultiplier ?? 1);
  const expectedTips = Math.max(0, Math.round(activeReward.cash * demandMultiplier));
  const expectedNet = expectedTips - licenceFee;

  const { data: buskingHistory, refetch: refetchHistory } = useQuery({
    queryKey: ["busking-history", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("activity_feed")
        .select("*")
        .eq("profile_id", profile.id)
        .eq("activity_type", "busking_session")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as Tables<"activity_feed">[];
    },
    enabled: !!profile?.id && showHistory,
  });

  const statusEndsAt = React.useMemo(() => getStatusEndDate(activityStatus), [activityStatus]);
  const isBusy = React.useMemo(() => {
    if (!activityStatus) return false;
    if (activityStatus.duration_minutes === null || activityStatus.duration_minutes === undefined) {
      return activityStatus.status !== "idle" && activityStatus.status !== "completed" && activityStatus.status !== "cancelled";
    }
    if (!statusEndsAt) return false;
    return statusEndsAt.getTime() > Date.now();
  }, [activityStatus, statusEndsAt]);

  const timeRemainingLabel = React.useMemo(() => {
    if (!isBusy || !statusEndsAt) return null;
    try {
      return formatDistanceToNowStrict(statusEndsAt, { addSuffix: true });
    } catch {
      return null;
    }
  }, [isBusy, statusEndsAt]);

  const loadActivityStatus = React.useCallback(async () => {
    setStatusLoading(true);
    try {
      await refreshActivityStatus();
    } finally {
      setStatusLoading(false);
    }
  }, [refreshActivityStatus]);

  React.useEffect(() => {
    void loadActivityStatus();
  }, [loadActivityStatus]);

  const handleStartBusking = React.useCallback(async () => {
    if (!profile || !activeLocation) return;
    setIsStartingSession(true);

    try {
      const idempotencyKey = crypto.randomUUID();
      const { data, error } = await supabase.functions.invoke("busking-session", {
        body: {
          action: "start",
          locationId: activeLocation.id,
          duration: selectedLength,
          idempotencyKey,
        },
      });

      if (error) throw error;
      if (!data?.success || !data?.result) throw new Error(data?.error || "Unable to start busking");

      const result = data.result as BuskingResult;
      setLastResult(result);

      await Promise.all([
        refetch(),
        refreshActivityStatus(),
        refetchOptions(),
        showHistory ? refetchHistory() : Promise.resolve(),
      ]);

      toast({
        title: "Busking session started",
        description:
          result.licenceFee > 0
            ? `Outcome locked: ${result.xpGained} XP, $${result.cashEarned.toLocaleString()} tips, $${result.licenceFee.toLocaleString()} city licence.`
            : `Outcome locked: ${result.xpGained} XP and $${result.cashEarned.toLocaleString()} in tips.`,
      });
    } catch (error) {
      console.error("Failed to start authoritative busking session", error);
      const message = error instanceof Error ? error.message : "Unable to start busking";
      toast({
        title: "Unable to start busking",
        description: friendlyBuskingError(message),
        variant: "destructive",
      });
    } finally {
      setIsStartingSession(false);
      void loadActivityStatus();
    }
  }, [
    activeLocation,
    loadActivityStatus,
    profile,
    refetch,
    refetchHistory,
    refetchOptions,
    refreshActivityStatus,
    selectedLength,
    showHistory,
    toast,
  ]);

  const selectedLengthLabel = sessionOptions.find((option) => option.value === selectedLength)?.label;
  const busyStatusLabel = activityStatus?.status?.replace(/_/g, " ") ?? "another activity";
  const buttonDisabled =
    !profile || !activeLocation || isStartingSession || statusLoading || optionsLoading || !!optionsError || isBusy;

  return (
    <FMPageScaffold
      title="Busking"
      subtitle="Pick a spot, choose how long to play, and earn server-verified XP and tips."
      icon={Music2}
      backTo="/hub/live"
    >
      <Card>
        <CardContent className="space-y-8 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-4">
            <div>
              <p className="text-sm font-semibold">{buskingOptions?.cityName ?? "Current city"}</p>
              <p className="text-xs text-muted-foreground">
                City culture and music demand affect your crowd potential. The performance roll is resolved on the server.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Demand {demandMultiplier.toFixed(2)}×</Badge>
              <Badge variant={licenceFee > 0 ? "secondary" : "outline"} className="gap-1">
                <Scale className="h-3 w-3" />
                Licence ${licenceFee.toLocaleString()}
              </Badge>
            </div>
          </div>

          {optionsError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
              <p className="font-semibold text-destructive">Busking service unavailable</p>
              <p className="mt-1 text-muted-foreground">The server could not load authoritative city busking rules.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetchOptions()}>
                Retry
              </Button>
            </div>
          ) : optionsLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading city busking rules…
            </div>
          ) : (
            <>
              <section>
                <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">Choose a location</h3>
                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  {buskingLocations.map((location) => {
                    const isSelected = location.id === activeLocation?.id;
                    return (
                      <button
                        key={location.id}
                        type="button"
                        onClick={() => setSelectedLocationId(location.id)}
                        className={cn(
                          "flex h-full flex-col justify-between rounded-lg border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                          isSelected
                            ? "border-primary bg-primary/5 shadow-md"
                            : "border-border bg-background hover:border-primary/40 hover:shadow-sm",
                        )}
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-lg font-semibold leading-tight">{location.name}</h4>
                              <p className="text-sm text-muted-foreground">{location.description}</p>
                            </div>
                            <Badge variant="outline" className="whitespace-nowrap text-xs font-medium">
                              {location.vibe}
                            </Badge>
                          </div>
                          <p className="text-xs font-medium tracking-wide text-muted-foreground">{location.neighborhood}</p>
                        </div>
                        <p className="mt-4 text-sm text-muted-foreground">{location.tip}</p>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">Set your session length</h3>
                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  {sessionOptions.map((option) => {
                    const reward = getReward(activeLocation, option.value);
                    const isSelected = option.value === selectedLength;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSelectedLength(option.value)}
                        className={cn(
                          "rounded-lg border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                          isSelected
                            ? "border-primary bg-primary/5 shadow-md"
                            : "border-border bg-background hover:border-primary/40 hover:shadow-sm",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold leading-tight">{option.label}</p>
                            <p className="text-xs text-muted-foreground">{option.description}</p>
                          </div>
                          <Badge variant={isSelected ? "default" : "outline"} className="text-xs">
                            {isSelected ? "Selected" : "Preview"}
                          </Badge>
                        </div>
                        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <dt className="text-xs tracking-wide text-muted-foreground">Base XP</dt>
                            <dd className="text-lg font-semibold text-primary">{reward.experience}</dd>
                          </div>
                          <div>
                            <dt className="text-xs tracking-wide text-muted-foreground">Base tips</dt>
                            <dd className="text-lg font-semibold text-emerald-600">${reward.cash}</dd>
                          </div>
                        </dl>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="space-y-4 rounded-lg border bg-muted/40 p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Ready to perform?</p>
                      <p className="mt-2 text-lg font-semibold">
                        {activeLocation?.name} · {selectedLengthLabel}
                      </p>
                    </div>
                    <Button onClick={handleStartBusking} disabled={buttonDisabled} size="lg">
                      {isStartingSession ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resolving…</>
                      ) : statusLoading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking availability…</>
                      ) : isBusy ? (
                        "Time already committed"
                      ) : !profile ? (
                        "Create your artist to begin"
                      ) : (
                        "Start busking session"
                      )}
                    </Button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-md border border-primary/40 bg-background p-4">
                      <p className="text-xs tracking-wide text-muted-foreground">Base XP</p>
                      <p className="mt-1 text-2xl font-bold text-primary">{activeReward.experience}</p>
                    </div>
                    <div className="rounded-md border border-emerald-400/40 bg-background p-4">
                      <p className="text-xs tracking-wide text-muted-foreground">City-adjusted tips</p>
                      <p className="mt-1 text-2xl font-bold text-emerald-600">~${expectedTips.toLocaleString()}</p>
                    </div>
                    <div className="rounded-md border bg-background p-4">
                      <p className="text-xs tracking-wide text-muted-foreground">Before performance roll</p>
                      <p className={cn("mt-1 text-2xl font-bold", expectedNet >= 0 ? "text-foreground" : "text-destructive")}>
                        {expectedNet >= 0 ? "+" : "-"}${Math.abs(expectedNet).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">after ${licenceFee.toLocaleString()} licence</p>
                    </div>
                  </div>

                  {isBusy ? (
                    <div className="rounded-md border border-amber-300/60 bg-amber-100/40 p-4 text-sm text-amber-900">
                      <p className="font-medium">You're currently {busyStatusLabel}.</p>
                      {timeRemainingLabel && <p className="mt-1 text-amber-900/80">You can start another timed activity {timeRemainingLabel}.</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Reserving {selectedLength} in-game minutes blocks other timed activities. The server validates your schedule and cash before charging anything.
                    </p>
                  )}

                  {lastResult && (
                    <div className="rounded-md border border-border bg-background p-4 text-sm">
                      <p className="font-semibold">Last session outcome</p>
                      <ul className="mt-2 space-y-1 text-muted-foreground">
                        <li><span className="font-medium text-foreground">Location:</span> {lastResult.locationName}</li>
                        <li><span className="font-medium text-foreground">Outcome:</span> {lastResult.performanceDescriptor}</li>
                        <li>
                          <span className="font-medium text-foreground">Rewards:</span> {lastResult.xpGained} XP · ${lastResult.cashEarned.toLocaleString()} tips
                          {lastResult.licenceFee > 0 ? ` · $${lastResult.licenceFee.toLocaleString()} licence` : ""}
                        </li>
                        <li><span className="font-medium text-foreground">Net cash:</span> {lastResult.netCashChange >= 0 ? "+" : "-"}${Math.abs(lastResult.netCashChange).toLocaleString()}</li>
                        <li><span className="font-medium text-foreground">Time committed:</span> {lastResult.duration} minutes ({formatSessionWindow(lastResult.startedAt, lastResult.endsAt)})</li>
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          <section>
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-lg font-semibold"><History className="h-5 w-5" /> Busking History</h3>
              <Button variant="outline" size="sm" onClick={() => setShowHistory((value) => !value)}>
                {showHistory ? "Hide history" : "Show history"}
              </Button>
            </div>

            {showHistory && (
              <div className="mt-4 space-y-3">
                {buskingHistory && buskingHistory.length > 0 ? buskingHistory.map((session) => {
                  const metadata = (session.metadata as Record<string, any> | null) ?? {};
                  return (
                    <Card key={session.id} className="bg-muted/30 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Music className="h-4 w-4 text-primary" />
                            <span className="font-medium">{metadata.location_name || "Unknown Location"}</span>
                            <Badge variant="outline">{metadata.duration_minutes || 0} min</Badge>
                            {Number(metadata.licence_fee || 0) > 0 && <Badge variant="secondary">Licence ${Number(metadata.licence_fee).toLocaleString()}</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{new Date(session.created_at).toLocaleString()}</p>
                          {metadata.performance_descriptor && <p className="text-sm italic text-muted-foreground">“{metadata.performance_descriptor}”</p>}
                        </div>
                        <div className="space-y-1 text-right">
                          <div className="flex items-center gap-1 text-sm font-semibold text-green-600"><Coins className="h-4 w-4" /> ${Number(session.earnings || 0).toLocaleString()} net</div>
                          <div className="text-sm text-muted-foreground">+{metadata.xp_gained || 0} XP</div>
                        </div>
                      </div>
                    </Card>
                  );
                }) : (
                  <Card className="bg-muted/20 p-6">
                    <p className="text-center text-sm text-muted-foreground">No busking sessions yet. Get out there and perform!</p>
                  </Card>
                )}
              </div>
            )}
          </section>
        </CardContent>
      </Card>
    </FMPageScaffold>
  );
}
