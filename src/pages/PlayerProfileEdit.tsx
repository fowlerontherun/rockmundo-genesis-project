import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Save, User } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useGameData } from "@/hooks/useGameData";
import { calculateProfileCompleteness, getOwnPlayerSocialProfile, sanitizeProfileList, sanitizeProfileText, updatePlayerSocialProfile, BIOGRAPHY_MAX_LENGTH, STATUS_MESSAGE_MAX_LENGTH } from "@/services/playerProfileService";

const bools = [
  ["looking_for_band", "Looking for a band"], ["looking_for_members", "Looking for band members"], ["available_for_session_work", "Available for session work"], ["available_for_collaboration", "Available for songwriting collaboration"], ["available_for_gigs", "Available for gigs"], ["available_for_employment", "Available for employment"], ["available_for_teaching", "Available for teaching"], ["available_for_social", "Available for social activities"],
] as const;
const visibilityBools = ["show_online_status", "show_last_active", "show_city", "show_schedule_availability", "show_skills", "show_career_history", "show_employment", "show_activity", "show_achievements"] as const;

const defaults: any = { biography: "", primary_instrument: "", secondary_instruments: [], preferred_genres: [], preferred_roles: [], vocal_capability: "", songwriting_specialisms: [], status_message: "", visibility: "public", skill_visibility: "broad", show_online_status: false, show_last_active: false, show_city: true, show_schedule_availability: false, show_skills: true, show_career_history: true, show_employment: true, show_activity: true, show_achievements: true };

export default function PlayerProfileEdit() {
  const { profile } = useGameData();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(defaults);
  const [dirty, setDirty] = useState(false);
  const profileId = profile?.id;
  const { data, isLoading, error } = useQuery({ queryKey: ["own-social-profile", profileId], queryFn: () => getOwnPlayerSocialProfile(profileId!), enabled: !!profileId });
  useEffect(() => { if (data) { setForm({ ...defaults, ...data }); setDirty(false); } }, [data]);
  useEffect(() => { const onBeforeUnload = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } }; window.addEventListener("beforeunload", onBeforeUnload); return () => window.removeEventListener("beforeunload", onBeforeUnload); }, [dirty]);
  const completeness = useMemo(() => calculateProfileCompleteness(form), [form]);
  const set = (key: string, value: any) => { setForm((f: any) => ({ ...f, [key]: value })); setDirty(true); };
  const mutation = useMutation({ mutationFn: () => updatePlayerSocialProfile({ ...form, profile_id: profileId!, biography: sanitizeProfileText(form.biography || "", BIOGRAPHY_MAX_LENGTH), status_message: sanitizeProfileText(form.status_message || "", STATUS_MESSAGE_MAX_LENGTH) }), onSuccess: (saved) => { setForm({ ...defaults, ...saved }); setDirty(false); qc.invalidateQueries({ queryKey: ["own-social-profile", profileId] }); toast({ title: "Profile saved", description: "Your public social identity settings were updated." }); }, onError: (e: any) => toast({ title: "Could not save profile", description: e.message, variant: "destructive" }) });
  const listInput = (key: string) => (form[key] || []).join(", ");
  const setList = (key: string, value: string) => set(key, sanitizeProfileList(value.split(",")));
  return <FMPageScaffold title="Edit Player Profile" icon={User} backTo={profileId ? `/players/${profileId}` : "/character"}>
    {error && <Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert>}
    {isLoading ? <Card><CardContent className="p-6">Loading profile editor…</CardContent></Card> : <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Card><CardHeader><CardTitle>Biography</CardTitle><CardDescription>Plain text only. Links, scripts and moderated terms are filtered before saving.</CardDescription></CardHeader><CardContent className="space-y-2"><Textarea id="biography" value={form.biography || ""} maxLength={BIOGRAPHY_MAX_LENGTH} rows={6} onChange={(e) => set("biography", e.target.value)} /><p className="text-xs text-muted-foreground">{(form.biography || "").length}/{BIOGRAPHY_MAX_LENGTH}</p><div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{sanitizeProfileText(form.biography || "No biography preview yet.", BIOGRAPHY_MAX_LENGTH)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle>Musical identity</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2"><Field label="Primary instrument" value={form.primary_instrument} onChange={(v) => set("primary_instrument", v)} /><Field label="Secondary instruments" value={listInput("secondary_instruments")} onChange={(v) => setList("secondary_instruments", v)} /><Field label="Preferred genres" value={listInput("preferred_genres")} onChange={(v) => setList("preferred_genres", v)} /><Field label="Performance roles" value={listInput("preferred_roles")} onChange={(v) => setList("preferred_roles", v)} /><Field label="Vocal capability" value={form.vocal_capability} onChange={(v) => set("vocal_capability", v)} /><Field label="Songwriting specialisms" value={listInput("songwriting_specialisms")} onChange={(v) => setList("songwriting_specialisms", v)} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Availability and social intent</CardTitle></CardHeader><CardContent className="space-y-3"><Field label="Short status message" value={form.status_message} maxLength={STATUS_MESSAGE_MAX_LENGTH} onChange={(v) => set("status_message", v)} /> <div className="grid gap-3 md:grid-cols-2">{bools.map(([key, label]) => <Toggle key={key} label={label} checked={!!form[key]} onCheckedChange={(v) => set(key, v)} />)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle>Profile visibility</CardTitle></CardHeader><CardContent className="space-y-3"><Label>Profile visibility</Label><Select value={form.visibility} onValueChange={(v) => set("visibility", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">Public</SelectItem><SelectItem value="friends">Friends only</SelectItem><SelectItem value="band_members">Band members only</SelectItem><SelectItem value="private">Private</SelectItem></SelectContent></Select><Label>Skill visibility</Label><Select value={form.skill_visibility} onValueChange={(v) => set("skill_visibility", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="exact">Show exact skill level</SelectItem><SelectItem value="broad">Show broad proficiency</SelectItem><SelectItem value="hidden">Hide skill information</SelectItem></SelectContent></Select><div className="grid gap-3 md:grid-cols-2">{visibilityBools.map((key) => <Toggle key={key} label={key.replace(/_/g, " ")} checked={!!form[key]} onCheckedChange={(v) => set(key, v)} />)}</div></CardContent></Card>
      </div>
      <aside className="space-y-4"><Card><CardHeader><CardTitle>Completeness</CardTitle></CardHeader><CardContent><Progress value={completeness.percent} /><p className="mt-2 text-sm">{completeness.completed}/{completeness.total} profile foundations complete</p>{completeness.items.map((i) => <p key={i.label} className="text-xs text-muted-foreground">{i.complete ? '✓' : '○'} {i.label}</p>)}</CardContent></Card><Button className="w-full" onClick={() => mutation.mutate()} disabled={!dirty || mutation.isPending || !profileId}><Save className="mr-2 h-4 w-4" />{mutation.isPending ? "Saving…" : "Save profile"}</Button>{profileId && <Button asChild variant="outline" className="w-full"><Link to={`/players/${profileId}`}>Preview profile</Link></Button>}{dirty && <p className="text-sm text-amber-600">You have unsaved changes.</p>}</aside>
    </div>}
  </FMPageScaffold>;
}
function Field({ label, value, onChange, maxLength }: { label: string; value?: string; onChange: (v: string) => void; maxLength?: number }) { const id = label.toLowerCase().replace(/\s+/g, '-'); return <div className="space-y-1"><Label htmlFor={id}>{label}</Label><Input id={id} value={value || ""} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} /></div>; }
function Toggle({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (v: boolean) => void }) { return <div className="flex items-center justify-between rounded-md border p-3"><Label className="capitalize">{label}</Label><Switch checked={checked} onCheckedChange={onCheckedChange} /></div>; }
