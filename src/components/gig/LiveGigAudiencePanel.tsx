import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, Radio, ShieldCheck, Sparkles } from "lucide-react";
import { AUDIENCE_REACTION_TYPES, aggregateAudienceResponse, checkAudienceReactionRateLimit, type AudienceAggregate, type AudienceReactionType, type ParticipationLevel } from "@/utils/gigAudience";

interface LiveGigAudiencePanelProps { gigId: string; liveSessionId?: string | null; currentSegmentId?: string | null; isAudienceView?: boolean; }
interface AttendanceRow { id: string; attendance_type: string; status: string; participation_score: number; watch_duration_seconds: number; reward_status: string; last_presence_at: string | null; }
interface AggregateRow { participation_level: string; participation_score: number; reaction_counts: Record<string, number>; unique_participants: number; encore_demand: number; singalong_strength: number; audience_modifier: number; }
interface AggregateView { participationLevel: ParticipationLevel | string; participationScore: number; uniqueParticipants: number; encoreDemand: number; audienceModifier: number; }

const reactionLabels: Record<AudienceReactionType, string> = { cheer: "Cheer", clap: "Clap", sing_along: "Sing along", hands_up: "Hands up", dance: "Dance", phone_wave: "Phone wave", chant: "Chant", encore_request: "Encore!", support_performer: "Support", highlight: "Highlight" };

const toAggregateView = (value: AggregateRow | AudienceAggregate): AggregateView => {
  if ("participation_level" in value) {
    return { participationLevel: value.participation_level, participationScore: value.participation_score, uniqueParticipants: value.unique_participants, encoreDemand: value.encore_demand, audienceModifier: value.audience_modifier };
  }
  return { participationLevel: value.participationLevel, participationScore: value.participationScore, uniqueParticipants: value.uniqueParticipants, encoreDemand: value.encoreDemand, audienceModifier: value.audienceModifier };
};

export function LiveGigAudiencePanel({ gigId, liveSessionId, currentSegmentId, isAudienceView = false }: LiveGigAudiencePanelProps) {
  const [attendance, setAttendance] = useState<AttendanceRow | null>(null);
  const [aggregate, setAggregate] = useState<AggregateRow | null>(null);
  const [friendCount, setFriendCount] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<Date | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const loadAudienceState = useCallback(async () => {
    const attendanceQuery = (supabase.from("gig_audience_attendance" as never) as any).select("id, attendance_type, status, participation_score, watch_duration_seconds, reward_status, last_presence_at").eq("gig_id", gigId).maybeSingle();
    const { data: attendanceData } = await attendanceQuery;
    setAttendance(attendanceData ?? null);

    if (liveSessionId) {
      const { data: aggregateData } = await (supabase.from("gig_audience_segment_aggregates" as never) as any)
        .select("participation_level, participation_score, reaction_counts, unique_participants, encore_demand, singalong_strength, audience_modifier")
        .eq("live_session_id", liveSessionId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setAggregate(aggregateData ?? null);

      const { count } = await (supabase.from("gig_audience_attendance" as never) as any)
        .select("id", { count: "exact", head: true })
        .eq("live_session_id", liveSessionId)
        .in("status", ["checked_in", "watching", "completed"]);
      setFriendCount(count ?? 0);
    }
  }, [gigId, liveSessionId]);

  useEffect(() => { loadAudienceState(); }, [loadAudienceState]);

  useEffect(() => {
    if (!liveSessionId) return;
    const channel = supabase
      .channel(`gig-audience-${liveSessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "gig_audience_segment_aggregates", filter: `live_session_id=eq.${liveSessionId}` }, () => loadAudienceState())
      .on("postgres_changes", { event: "*", schema: "public", table: "gig_audience_attendance", filter: `live_session_id=eq.${liveSessionId}` }, () => loadAudienceState())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [liveSessionId, loadAudienceState]);

  const derivedAggregate = useMemo(() => toAggregateView(aggregate ?? aggregateAudienceResponse([], friendCount)), [aggregate, friendCount]);
  const cooldownSeconds = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil.getTime() - Date.now()) / 1000)) : 0;

  const checkIn = async (attendanceType: "ticket_holder" | "remote_viewer") => {
    setIsCheckingIn(true); setMessage(null);
    const { data, error } = await (supabase.rpc("check_in_gig_audience" as never, { p_gig_id: gigId, p_ticket_id: null, p_attendance_type: attendanceType } as never) as any);
    if (error) setMessage(error.message); else { setAttendance(data); setMessage(attendanceType === "remote_viewer" ? "Viewing live presentation without attendance rewards." : "Checked in for the gig."); await loadAudienceState(); }
    setIsCheckingIn(false);
  };

  const react = async (reactionType: AudienceReactionType) => {
    if (!attendance) return;
    const limit = checkAudienceReactionRateLimit({ lastReactionAt: cooldownUntil && cooldownUntil > new Date() ? new Date(Date.now() - 1000).toISOString() : null });
    if (!limit.allowed) { setMessage(limit.reason ?? "Reaction cooldown active."); return; }
    const idempotency = `${attendance.id}:${currentSegmentId ?? "current"}:${reactionType}:${Math.floor(Date.now() / 4000)}`;
    const { error } = await (supabase.rpc("record_gig_audience_reaction" as never, { p_attendance_id: attendance.id, p_reaction_type: reactionType, p_segment_id: currentSegmentId ?? null, p_idempotency_key: idempotency } as never) as any);
    if (error) setMessage(error.message); else { setCooldownUntil(new Date(Date.now() + 4000)); setMessage(`${reactionLabels[reactionType]} counted in the crowd response.`); await loadAudienceState(); }
  };

  return (
    <Card className={isAudienceView ? "border-primary/40 bg-primary/5" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Radio className="h-5 w-5" /> Audience participation</CardTitle>
        <CardDescription>Server-authoritative social viewing with capped, aggregate-only influence.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div><p className="text-2xl font-bold capitalize">{derivedAggregate.participationLevel}</p><p className="text-xs text-muted-foreground">Participation</p></div>
          <div><p className="text-2xl font-bold">{derivedAggregate.uniqueParticipants}</p><p className="text-xs text-muted-foreground">Active fans</p></div>
          <div><p className="text-2xl font-bold">{derivedAggregate.encoreDemand}%</p><p className="text-xs text-muted-foreground">Encore demand</p></div>
          <div><p className="text-2xl font-bold">+{Number(derivedAggregate.audienceModifier || 0).toFixed(1)}</p><p className="text-xs text-muted-foreground">Capped atmosphere</p></div>
        </div>
        <Progress value={derivedAggregate.participationScore} className="h-2" />

        {attendance ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
            <Badge variant="secondary">{attendance.attendance_type.replace("_", " ")}</Badge>
            <Badge>{attendance.status}</Badge>
            <span className="text-sm text-muted-foreground">Your participation score: {attendance.participation_score}/100</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={isCheckingIn} onClick={() => checkIn("ticket_holder")}><Users className="mr-2 h-4 w-4" /> Check in</Button>
            <Button disabled={isCheckingIn} variant="outline" onClick={() => checkIn("remote_viewer")}><ShieldCheck className="mr-2 h-4 w-4" /> View only</Button>
          </div>
        )}

        {attendance && !["remote_viewer", "admin_viewer"].includes(attendance.attendance_type) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between"><p className="text-sm font-medium">Quick reactions</p>{cooldownSeconds > 0 && <Badge variant="outline">Cooldown {cooldownSeconds}s</Badge>}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {AUDIENCE_REACTION_TYPES.map((type) => <Button key={type} size="sm" variant={type === "encore_request" ? "default" : "outline"} disabled={cooldownSeconds > 0} onClick={() => react(type)}>{reactionLabels[type]}</Button>)}
            </div>
          </div>
        )}

        <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          <Sparkles className="mr-2 inline h-4 w-4" /> Friend presence is aggregate-only here; privacy, blocking and private gig visibility are enforced by server policies.
        </div>
        {message && <Alert><AlertDescription>{message}</AlertDescription></Alert>}
      </CardContent>
    </Card>
  );
}
