import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Edit, Filter, Plus, Search, Trash2, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

interface RandomEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  is_common: boolean;
  health_min: number | null;
  health_max: number | null;
  option_a_text: string;
  option_a_effects: Record<string, number>;
  option_a_outcome_text: string;
  option_b_text: string;
  option_b_effects: Record<string, number>;
  option_b_outcome_text: string;
  is_active: boolean;
  created_at: string;
}

interface AdminPlayer {
  user_id: string;
  display_name: string | null;
  username: string | null;
}

const CATEGORIES = ["career", "health", "financial", "social", "random", "industry"];
const EFFECT_KEYS = ["fans", "cash", "health", "energy", "fame", "xp"];
const RANDOM_EVENT_VALUE = "__random_event__";
const defaultEffects = { fans: 0, cash: 0, health: 0, energy: 0, fame: 0, xp: 0 };

const categoryColors: Record<string, string> = {
  career: "bg-blue-500/20 text-blue-400",
  health: "bg-red-500/20 text-red-400",
  financial: "bg-green-500/20 text-green-400",
  social: "bg-purple-500/20 text-purple-400",
  random: "bg-yellow-500/20 text-yellow-400",
  industry: "bg-cyan-500/20 text-cyan-400",
};

const eventDefaults = (): Partial<RandomEvent> => ({
  title: "",
  description: "",
  category: "random",
  is_common: false,
  health_min: null,
  health_max: null,
  option_a_text: "",
  option_a_effects: { ...defaultEffects },
  option_a_outcome_text: "",
  option_b_text: "",
  option_b_effects: { ...defaultEffects },
  option_b_outcome_text: "",
  is_active: true,
});

function EffectsEditor({ effects, onChange }: { effects: Record<string, number>; onChange: (value: Record<string, number>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {EFFECT_KEYS.map((key) => (
        <div key={key} className="space-y-1">
          <Label className="text-xs capitalize">{key}</Label>
          <Input
            type="number"
            value={effects[key] ?? 0}
            onChange={(event) => onChange({ ...effects, [key]: Number.parseInt(event.target.value, 10) || 0 })}
            className="h-8 text-sm"
          />
        </div>
      ))}
    </div>
  );
}

function EventDialog({
  event,
  onSave,
  saving,
  trigger,
}: {
  event?: RandomEvent;
  onSave: (value: Partial<RandomEvent>) => void;
  saving: boolean;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<RandomEvent>>(event ? { ...event } : eventDefaults());
  const [validationError, setValidationError] = useState<string | null>(null);

  const updateOpen = (next: boolean) => {
    setOpen(next);
    if (next) {
      setForm(event ? { ...event } : eventDefaults());
      setValidationError(null);
    }
  };

  const handleSave = () => {
    if (!form.title?.trim() || !form.description?.trim()) {
      setValidationError("Title and description are required.");
      return;
    }
    if (!form.option_a_text?.trim() || !form.option_b_text?.trim()) {
      setValidationError("Both player choices require text.");
      return;
    }
    if (!form.option_a_outcome_text?.trim() || !form.option_b_outcome_text?.trim()) {
      setValidationError("Both choices require an outcome message.");
      return;
    }
    if (form.health_min != null && form.health_max != null && form.health_min > form.health_max) {
      setValidationError("Minimum health cannot be greater than maximum health.");
      return;
    }

    setValidationError(null);
    onSave({ ...form, title: form.title.trim(), description: form.description.trim() });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={updateOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? "Edit random event" : "Create random event"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {validationError && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{validationError}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1"><Label>Title</Label><Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={form.category ?? "random"} onValueChange={(category) => setForm({ ...form, category })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>Description</Label><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-2 pt-6"><Switch checked={form.is_common ?? false} onCheckedChange={(is_common) => setForm({ ...form, is_common })} /><Label>Repeatable</Label></div>
            <div className="space-y-1"><Label>Health minimum</Label><Input type="number" min={0} max={100} value={form.health_min ?? ""} onChange={(e) => setForm({ ...form, health_min: e.target.value === "" ? null : Number(e.target.value) })} placeholder="Any" /></div>
            <div className="space-y-1"><Label>Health maximum</Label><Input type="number" min={0} max={100} value={form.health_max ?? ""} onChange={(e) => setForm({ ...form, health_max: e.target.value === "" ? null : Number(e.target.value) })} placeholder="Any" /></div>
          </div>
          {(["a", "b"] as const).map((option) => {
            const textKey = `option_${option}_text` as const;
            const effectsKey = `option_${option}_effects` as const;
            const outcomeKey = `option_${option}_outcome_text` as const;
            return (
              <Card key={option}>
                <CardHeader className="py-3"><CardTitle className="text-sm">Option {option.toUpperCase()}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1"><Label>Player choice</Label><Input value={form[textKey] ?? ""} onChange={(e) => setForm({ ...form, [textKey]: e.target.value })} /></div>
                  <EffectsEditor effects={(form[effectsKey] as Record<string, number>) ?? defaultEffects} onChange={(effects) => setForm({ ...form, [effectsKey]: effects })} />
                  <div className="space-y-1"><Label>Outcome story</Label><Textarea value={form[outcomeKey] ?? ""} onChange={(e) => setForm({ ...form, [outcomeKey]: e.target.value })} /></div>
                </CardContent>
              </Card>
            );
          })}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save event"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function RandomEventsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedEventValue, setSelectedEventValue] = useState(RANDOM_EVENT_VALUE);
  const [triggerCategory, setTriggerCategory] = useState("all");

  const eventsQuery = useQuery({
    queryKey: ["admin-random-events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("random_events").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RandomEvent[];
    },
  });

  const statsQuery = useQuery({
    queryKey: ["admin-event-stats"],
    queryFn: async () => {
      const [triggered, completed, pending] = await Promise.all([
        supabase.from("player_events").select("id", { count: "exact", head: true }),
        supabase.from("player_events").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("player_events").select("id", { count: "exact", head: true }).in("status", ["pending_choice", "awaiting_outcome"]),
      ]);
      const failed = [triggered, completed, pending].find((result) => result.error);
      if (failed?.error) throw failed.error;
      return { triggered: triggered.count ?? 0, completed: completed.count ?? 0, pending: pending.count ?? 0 };
    },
  });

  const playersQuery = useQuery({
    queryKey: ["admin-random-event-players"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, display_name, username").not("user_id", "is", null).order("display_name", { ascending: true }).limit(500);
      if (error) throw error;
      return (data ?? []) as AdminPlayer[];
    },
  });

  const invalidate = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["admin-random-events"] }),
    queryClient.invalidateQueries({ queryKey: ["admin-event-stats"] }),
  ]);

  const createMutation = useMutation({
    mutationFn: async (event: Partial<RandomEvent>) => {
      const { error } = await supabase.from("random_events").insert(event as never);
      if (error) throw error;
    },
    onSuccess: async () => { await invalidate(); toast({ title: "Random event created" }); },
    onError: (error: Error) => toast({ title: "Could not create event", description: error.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RandomEvent> & { id: string }) => {
      const { error } = await supabase.from("random_events").update(updates as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => { await invalidate(); toast({ title: "Random event updated" }); },
    onError: (error: Error) => toast({ title: "Could not update event", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { count } = await supabase.from("player_events").select("id", { count: "exact", head: true }).eq("event_id", id);
      if ((count ?? 0) > 0) throw new Error("This event has player history. Disable it instead of deleting it.");
      const { error } = await supabase.from("random_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => { await invalidate(); toast({ title: "Random event deleted" }); },
    onError: (error: Error) => toast({ title: "Could not delete event", description: error.message, variant: "destructive" }),
  });

  const triggerMutation = useMutation({
    mutationFn: async () => {
      const eventId = selectedEventValue === RANDOM_EVENT_VALUE ? null : selectedEventValue;
      const { data, error } = await supabase.functions.invoke("admin-trigger-event", {
        body: { userId: selectedUserId, eventId, category: eventId ? null : triggerCategory === "all" ? null : triggerCategory },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: async (data) => {
      await invalidate();
      toast({ title: "Event triggered", description: `“${data.event.title}” is now waiting for the player.` });
      setTriggerDialogOpen(false);
      setSelectedUserId("");
      setSelectedEventValue(RANDOM_EVENT_VALUE);
      setTriggerCategory("all");
    },
    onError: (error: Error) => toast({ title: "Could not trigger event", description: error.message, variant: "destructive" }),
  });

  const events = eventsQuery.data ?? [];
  const filteredEvents = useMemo(() => events.filter((event) => {
    if (categoryFilter !== "all" && event.category !== categoryFilter) return false;
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    return event.title.toLowerCase().includes(term) || event.description.toLowerCase().includes(term);
  }), [events, categoryFilter, search]);

  const triggerEvents = useMemo(() => events.filter((event) => event.is_active && (triggerCategory === "all" || event.category === triggerCategory)), [events, triggerCategory]);

  const exportEvents = () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "rockmundo-random-events.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const loadError = eventsQuery.error ?? statsQuery.error ?? playersQuery.error;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div><h1 className="text-2xl font-bold">Random Events</h1><p className="text-muted-foreground">Create, test and manage player life events and their consequences.</p></div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={triggerDialogOpen} onOpenChange={setTriggerDialogOpen}>
            <DialogTrigger asChild><Button variant="outline"><Zap className="mr-2 h-4 w-4" />Trigger event</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Trigger random event</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1"><Label>Player</Label><Select value={selectedUserId} onValueChange={setSelectedUserId}><SelectTrigger><SelectValue placeholder="Choose a player" /></SelectTrigger><SelectContent><ScrollArea className="h-60">{playersQuery.data?.map((player) => <SelectItem key={player.user_id} value={player.user_id}>{player.display_name || player.username || player.user_id.slice(0, 8)}</SelectItem>)}</ScrollArea></SelectContent></Select></div>
                <div className="space-y-1"><Label>Category</Label><Select value={triggerCategory} onValueChange={(value) => { setTriggerCategory(value); setSelectedEventValue(RANDOM_EVENT_VALUE); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Any category</SelectItem>{CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Specific event</Label><Select value={selectedEventValue} onValueChange={setSelectedEventValue}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><ScrollArea className="h-60"><SelectItem value={RANDOM_EVENT_VALUE}>Choose randomly</SelectItem>{triggerEvents.map((event) => <SelectItem key={event.id} value={event.id}>[{event.category}] {event.title}</SelectItem>)}</ScrollArea></SelectContent></Select></div>
                <Button className="w-full" disabled={!selectedUserId || triggerMutation.isPending} onClick={() => triggerMutation.mutate()}>{triggerMutation.isPending ? "Triggering..." : "Trigger event"}</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={exportEvents} disabled={events.length === 0}><Download className="mr-2 h-4 w-4" />Export</Button>
          <EventDialog saving={createMutation.isPending} onSave={(event) => createMutation.mutate(event)} trigger={<Button><Plus className="mr-2 h-4 w-4" />Add event</Button>} />
        </div>
      </div>

      {loadError && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"><p className="font-medium">Random Events admin data could not be loaded.</p><p className="mt-1">{(loadError as Error).message}</p><Button className="mt-3" size="sm" variant="outline" onClick={() => { void eventsQuery.refetch(); void statsQuery.refetch(); void playersQuery.refetch(); }}>Retry</Button></div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{events.length}</div><div className="text-sm text-muted-foreground">Total events</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{events.filter((event) => event.is_active).length}</div><div className="text-sm text-muted-foreground">Active</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{statsQuery.data?.triggered ?? 0}</div><div className="text-sm text-muted-foreground">Times triggered</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{statsQuery.data?.pending ?? 0}</div><div className="text-sm text-muted-foreground">Awaiting outcome</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{statsQuery.data?.completed ?? 0}</div><div className="text-sm text-muted-foreground">Completed</div></CardContent></Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Search titles and descriptions..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="w-full sm:w-44"><Filter className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</SelectItem>)}</SelectContent></Select>
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Category</TableHead><TableHead>Repeatable</TableHead><TableHead>Health</TableHead><TableHead>Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {eventsQuery.isLoading ? <TableRow><TableCell colSpan={6} className="py-8 text-center">Loading events...</TableCell></TableRow> : filteredEvents.length === 0 ? <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No events found.</TableCell></TableRow> : filteredEvents.map((event) => (
              <TableRow key={event.id}>
                <TableCell><div className="max-w-md"><p className="font-medium">{event.title}</p><p className="line-clamp-1 text-xs text-muted-foreground">{event.description}</p></div></TableCell>
                <TableCell><Badge className={categoryColors[event.category] ?? ""}>{event.category}</Badge></TableCell>
                <TableCell>{event.is_common ? "Yes" : "No"}</TableCell>
                <TableCell>{event.health_min != null || event.health_max != null ? `${event.health_min ?? 0}–${event.health_max ?? 100}` : "Any"}</TableCell>
                <TableCell><Switch checked={event.is_active} disabled={updateMutation.isPending} onCheckedChange={(is_active) => updateMutation.mutate({ id: event.id, is_active })} /></TableCell>
                <TableCell className="text-right"><div className="flex justify-end gap-1"><EventDialog event={event} saving={updateMutation.isPending} onSave={(updates) => updateMutation.mutate({ ...updates, id: event.id })} trigger={<Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>} /><Button variant="ghost" size="icon" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(event.id)} title="Delete unused event"><Trash2 className="h-4 w-4 text-destructive" /></Button></div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
