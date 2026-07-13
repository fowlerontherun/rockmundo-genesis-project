import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SOCIAL_ACTIVITY_CATALOG, estimatePersonalCost, type CostPayer, type SocialActivityType } from "@/features/social-activities/catalog";
import { createSocialActivity } from "@/features/social-activities/service";

export default function NewSocialActivity() {
  const navigate = useNavigate();
  const [type, setType] = useState<SocialActivityType>("coffee");
  const [participants, setParticipants] = useState("");
  const [startAt, setStartAt] = useState("");
  const [duration, setDuration] = useState(60);
  const [payer, setPayer] = useState<CostPayer>("split");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const activity = useMemo(() => SOCIAL_ACTIVITY_CATALOG.find((a) => a.activity_type === type)!, [type]);
  const participantIds = participants.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);
  const participantCount = participantIds.length + 1;
  const personalCost = estimatePersonalCost(activity, payer, participantCount);
  async function submit() {
    if (!startAt) { toast.error("Choose a date and time."); return; }
    if (!activity.duration_options.includes(duration)) { toast.error("Choose one of the configured durations."); return; }
    setSubmitting(true);
    try { const row = await createSocialActivity({ activityType: type, participantIds, startAt: new Date(startAt).toISOString(), durationMinutes: duration, costPayer: payer, title: activity.display_name, note }); toast.success("Invitations sent"); navigate(`/social/activities/${row.id}`); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to create activity"); } finally { setSubmitting(false); }
  }
  return <div className="mx-auto max-w-3xl space-y-4"><Card><CardHeader><CardTitle>Create social activity</CardTitle><CardDescription>Choose an activity, participants, time, duration, payment model and review configured effects before sending invitations.</CardDescription></CardHeader><CardContent className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="activity">Activity</Label><Select value={type} onValueChange={(v) => { const next = v as SocialActivityType; setType(next); setDuration(SOCIAL_ACTIVITY_CATALOG.find((a) => a.activity_type === next)?.duration_options[0] ?? 60); }}><SelectTrigger id="activity"><SelectValue /></SelectTrigger><SelectContent>{SOCIAL_ACTIVITY_CATALOG.map((a) => <SelectItem key={a.activity_type} value={a.activity_type}>{a.display_name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="duration">Duration</Label><Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}><SelectTrigger id="duration"><SelectValue /></SelectTrigger><SelectContent>{activity.duration_options.map((d) => <SelectItem key={d} value={String(d)}>{d} minutes</SelectItem>)}</SelectContent></Select></div></div>
    <div className="space-y-2"><Label htmlFor="participants">Participant profile IDs</Label><Input id="participants" value={participants} onChange={(e) => setParticipants(e.target.value)} placeholder="Paste profile IDs separated by commas" /><p className="text-xs text-muted-foreground">Server checks blocking, preferences, group limits and schedule conflicts before accepting.</p></div>
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="start">Date and time</Label><Input id="start" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="payer">Who pays?</Label><Select value={payer} onValueChange={(v) => setPayer(v as CostPayer)}><SelectTrigger id="payer"><SelectValue /></SelectTrigger><SelectContent>{["split","host","each_own","band","company_later","free"].map((p) => <SelectItem key={p} value={p}>{p.replace("_", " ")}</SelectItem>)}</SelectContent></Select></div></div>
    <div className="space-y-2"><Label htmlFor="note">Optional note</Label><Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} /></div>
    <div className="rounded-lg border bg-muted/30 p-3 text-sm"><strong>Review:</strong> {activity.description} Participants {participantCount}/{activity.maximum_participants}. Estimated personal cost: {personalCost}. Effects: mood {activity.mood_effect}, stress {activity.stress_effect}, energy {activity.energy_effect}, rapport +{activity.rapport_effect}, familiarity +{activity.familiarity_effect}, conflict {activity.conflict_effect}.</div>
    <Button onClick={submit} disabled={submitting}>{submitting ? "Sending…" : "Send invitations"}</Button>
  </CardContent></Card></div>;
}
