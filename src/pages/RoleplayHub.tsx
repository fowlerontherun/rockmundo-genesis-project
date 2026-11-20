import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Drama, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RoomChat } from "@/features/roleplay/RoomChat";
import { useRoleplaySettings } from "@/features/roleplay/RoleplayProfileCard";
import { friendlyRoleplayError } from "@/features/roleplay/roleplay";

function useCity(profileId: string | null) {
  return useQuery({ queryKey: ["rp-city", profileId], enabled: !!profileId, queryFn: async () => {
    const { data } = await (supabase as any).from("profiles").select("current_city_id, city:cities!profiles_current_city_id_fkey(name)").eq("id", profileId).maybeSingle();
    return data as { current_city_id: string | null; city: { name: string } | null } | null;
  } });
}

function CityRoom({ profileId }: { profileId: string }) {
  const { data, isLoading } = useCity(profileId);
  if (isLoading) return <p className="text-xs text-muted-foreground">Loading…</p>;
  if (!data?.current_city_id) return <p className="text-xs text-muted-foreground">Travel to a city to join its room.</p>;
  return <RoomChat roomKey={`city:${data.current_city_id}`} title={`${data.city?.name ?? "City"} — street talk`} subtitle="Everyone in this city can read this. Messages fade after 24 hours." />;
}

type Scene = { id: string; title: string; setting: string | null; status: string; host_profile_id: string };

function Scenes({ profileId }: { profileId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [title, setTitle] = useState(""); const [setting, setSetting] = useState("");
  const [search, setSearch] = useState(""); const [guests, setGuests] = useState<{ id: string; name: string }[]>([]);
  const { data: scenes = [] } = useQuery({ queryKey: ["rp-scenes", profileId], queryFn: async () => {
    const { data } = await (supabase as any).from("roleplay_scenes").select("id,title,setting,status,host_profile_id").order("created_at", { ascending: false }).limit(30);
    return (data ?? []) as Scene[];
  } });
  const { data: found = [] } = useQuery({ queryKey: ["rp-find", search], enabled: search.trim().length >= 2, queryFn: async () => {
    const { data } = await (supabase as any).from("profiles").select("id,display_name,username").or(`display_name.ilike.%${search.replace(/[%,()]/g, "")}%,username.ilike.%${search.replace(/[%,()]/g, "")}%`).is("died_at", null).neq("id", profileId).limit(8);
    return (data ?? []) as { id: string; display_name: string | null; username: string | null }[];
  } });
  const create = async () => {
    const { data, error } = await (supabase as any).rpc("create_roleplay_scene", { p_profile: profileId, p_title: title, p_setting: setting, p_invitees: guests.map((g) => g.id) });
    if (error) return toast.error(friendlyRoleplayError(error.message));
    setTitle(""); setSetting(""); setGuests([]); setOpen(data as string);
    void qc.invalidateQueries({ queryKey: ["rp-scenes", profileId] });
  };
  const end = async (id: string) => {
    const { error } = await (supabase as any).rpc("end_roleplay_scene", { p_profile: profileId, p_scene: id });
    if (error) return toast.error(friendlyRoleplayError(error.message));
    toast.success("Scene ended and saved to everyone's history.");
    void qc.invalidateQueries({ queryKey: ["rp-scenes", profileId] });
  };
  const current = scenes.find((s) => s.id === open);
  return (
    <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
      <div className="space-y-3">
        <Card><CardContent className="space-y-2 p-3">
          <p className="text-xs font-semibold">Start a private scene</p>
          <Input className="h-8 text-xs" maxLength={80} placeholder="Title, e.g. After-show at the Dive Bar" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea className="text-xs" maxLength={280} rows={2} placeholder="Set the scene…" value={setting} onChange={(e) => setSetting(e.target.value)} />
          <Input className="h-8 text-xs" placeholder="Invite players (search name)" value={search} onChange={(e) => setSearch(e.target.value)} />
          {found.length > 0 && <div className="max-h-28 overflow-y-auto rounded border">{found.map((p) => (
            <button key={p.id} className="block w-full px-2 py-1 text-left text-xs hover:bg-muted" onClick={() => { if (guests.length < 5 && !guests.some((g) => g.id === p.id)) setGuests([...guests, { id: p.id, name: p.display_name || p.username || "Player" }]); setSearch(""); }}>{p.display_name || p.username}</button>))}</div>}
          <div className="flex flex-wrap gap-1">{guests.map((g) => <span key={g.id} className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px]">{g.name}<button aria-label={`Remove ${g.name}`} onClick={() => setGuests(guests.filter((x) => x.id !== g.id))}><X className="h-3 w-3" /></button></span>)}</div>
          <Button size="sm" className="w-full" disabled={title.trim().length < 3 || guests.length === 0} onClick={() => void create()}><Plus className="mr-1 h-3.5 w-3.5" />Open scene ({guests.length + 1}/6)</Button>
        </CardContent></Card>
        <div className="space-y-1">{scenes.map((s) => (
          <button key={s.id} onClick={() => setOpen(s.id)} className={`block w-full rounded border p-2 text-left text-xs ${open === s.id ? "border-primary" : ""}`}>
            <span className="font-medium">{s.title}</span> <span className="text-muted-foreground">· {s.status === "open" ? "live" : "ended"}</span>
          </button>))}
          {scenes.length === 0 && <p className="text-xs text-muted-foreground">No scenes yet.</p>}</div>
      </div>
      {current ? <div className="space-y-2">
        {current.setting && <p className="rounded border p-2 text-xs italic">{current.setting}</p>}
        <RoomChat roomKey={`scene:${current.id}`} title={current.title} subtitle="Only invited players can see this scene." />
        {current.status === "open" && current.host_profile_id === profileId && <Button size="sm" variant="outline" onClick={() => void end(current.id)}>End scene & save to history</Button>}
      </div> : <p className="text-xs text-muted-foreground">Pick or start a scene.</p>}
    </div>
  );
}

function RoleplayProfileForm({ profileId }: { profileId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useRoleplaySettings(profileId);
  const [f, setF] = useState({ mood: "", hooks: "", rp_enabled: true, open_romance: false, open_rivalry: true, open_collab: true });
  useEffect(() => { if (data) setF({ mood: data.mood ?? "", hooks: data.hooks ?? "", rp_enabled: data.rp_enabled, open_romance: data.open_romance, open_rivalry: data.open_rivalry, open_collab: data.open_collab }); }, [data]);
  const save = async () => {
    const { error } = await (supabase as any).from("profile_roleplay_settings").upsert({ profile_id: profileId, ...f, mood: f.mood.trim() || null, hooks: f.hooks.trim() || null, updated_at: new Date().toISOString() });
    if (error) return toast.error("Couldn't save your roleplay profile.");
    toast.success("Roleplay profile saved.");
    void qc.invalidateQueries({ queryKey: ["roleplay-settings", profileId] });
  };
  if (isLoading) return <p className="text-xs text-muted-foreground">Loading…</p>;
  const toggle = (k: "rp_enabled" | "open_romance" | "open_rivalry" | "open_collab", label: string) => (
    <div className="flex items-center justify-between"><Label className="text-xs">{label}</Label><Switch checked={f[k]} onCheckedChange={(v) => setF({ ...f, [k]: v })} /></div>);
  return (
    <Card className="max-w-lg"><CardContent className="space-y-3 p-3">
      <div><Label className="text-xs">Current mood</Label><Input className="h-8 text-xs" maxLength={60} placeholder="e.g. Hungover and grumpy" value={f.mood} onChange={(e) => setF({ ...f, mood: e.target.value })} /></div>
      <div><Label className="text-xs">Roleplay hooks</Label><Textarea className="text-xs" rows={3} maxLength={280} placeholder="e.g. Looking for a drummer. Feuding with The Shockmasters." value={f.hooks} onChange={(e) => setF({ ...f, hooks: e.target.value })} /></div>
      {toggle("rp_enabled", "I'm roleplaying (others can interact with me)")}
      {toggle("open_collab", "Open to collaborations and jams")}
      {toggle("open_rivalry", "Open to rivalries, insults and challenges")}
      {toggle("open_romance", "Open to romance and flirting")}
      <Button size="sm" onClick={() => void save()}>Save</Button>
    </CardContent></Card>
  );
}

export default function RoleplayHub() {
  const { profileId } = useActiveProfile();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "city";
  return (
    <FMPageScaffold title="Roleplay" subtitle="Talk in character, act with /me, mark out-of-character with (( )), and run private scenes." icon={Drama} backTo="/social" backLabel="Back to Social">
      {!profileId ? <p className="text-xs text-muted-foreground">Choose a character to roleplay.</p> :
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList className="overflow-x-auto"><TabsTrigger value="city">City room</TabsTrigger><TabsTrigger value="scenes">Scenes</TabsTrigger><TabsTrigger value="profile">My roleplay profile</TabsTrigger></TabsList>
        <TabsContent value="city"><CityRoom profileId={profileId} /></TabsContent>
        <TabsContent value="scenes"><Scenes profileId={profileId} /></TabsContent>
        <TabsContent value="profile"><RoleplayProfileForm profileId={profileId} /></TabsContent>
      </Tabs>}
    </FMPageScaffold>
  );
}
