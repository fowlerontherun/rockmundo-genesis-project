import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Search, Filter, Download, Upload } from "lucide-react";

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

const CATEGORIES = ["career", "health", "financial", "social", "random", "industry"];

const defaultEffects = { fans: 0, cash: 0, health: 0, energy: 0, fame: 0, xp: 0 };

function EffectsEditor({ effects, onChange }: { effects: Record<string, number>; onChange: (e: Record<string, number>) => void }) {
  const effectKeys = ["fans", "cash", "health", "energy", "fame", "xp"];
  
  return (
    <div className="grid grid-cols-3 gap-2">
      {effectKeys.map((key) => (
        <div key={key} className="flex items-center gap-1">
          <Label className="text-xs w-12 capitalize">{key}</Label>
          <Input
            type="number"
            value={effects[key] || 0}
            onChange={(e) => onChange({ ...effects, [key]: parseInt(e.target.value) || 0 })}
            className="h-8 text-sm"
          />
        </div>
      ))}
    </div>
  );
}

function EventDialog({ event, onSave, trigger }: { event?: RandomEvent; onSave: (e: Partial<RandomEvent>) => void; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<RandomEvent>>(
    event || {
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
    }
  );

  const handleSave = () => {
    onSave(form);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? "Edit Event" : "Create Event"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Title</Label>
              <Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div>
            <Label>Description</Label>
            <Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={form.is_common || false} onCheckedChange={(c) => setForm({ ...form, is_common: c })} />
              <Label>Common (repeatable)</Label>
            </div>
            <div>
              <Label>Health Min</Label>
              <Input type="number" value={form.health_min ?? ""} onChange={(e) => setForm({ ...form, health_min: e.target.value ? parseInt(e.target.value) : null })} placeholder="Any" />
            </div>
            <div>
              <Label>Health Max</Label>
              <Input type="number" value={form.health_max ?? ""} onChange={(e) => setForm({ ...form, health_max: e.target.value ? parseInt(e.target.value) : null })} placeholder="Any" />
            </div>
          </div>

          <Card>
            <CardHeader className="py-2"><CardTitle className="text-sm">Option A</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input placeholder="Option text" value={form.option_a_text || ""} onChange={(e) => setForm({ ...form, option_a_text: e.target.value })} />
              <EffectsEditor effects={form.option_a_effects || defaultEffects} onChange={(e) => setForm({ ...form, option_a_effects: e })} />
              <Input placeholder="Outcome message" value={form.option_a_outcome_text || ""} onChange={(e) => setForm({ ...form, option_a_outcome_text: e.target.value })} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-2"><CardTitle className="text-sm">Option B</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input placeholder="Option text" value={form.option_b_text || ""} onChange={(e) => setForm({ ...form, option_b_text: e.target.value })} />
              <EffectsEditor effects={form.option_b_effects || defaultEffects} onChange={(e) => setForm({ ...form, option_b_effects: e })} />
              <Input placeholder="Outcome message" value={form.option_b_outcome_text || ""} onChange={(e) => setForm({ ...form, option_b_outcome_text: e.target.value })} />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Event</Button>
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
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: events, isLoading } = useQuery({
    queryKey: ["admin-random-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("random_events")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as RandomEvent[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-event-stats"],
    queryFn: async () => {
      const { data: triggered } = await supabase.from("player_events").select("id", { count: "exact" });
      const { data: completed } = await supabase.from("player_events").select("id", { count: "exact" }).eq("status", "completed");
      return { triggered: triggered?.length || 0, completed: completed?.length || 0 };
    },
  });

  const createMutation = useMutation({
    mutationFn: async (event: Partial<RandomEvent>) => {
      const { error } = await supabase.from("random_events").insert([event as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Event created" });
      queryClient.invalidateQueries({ queryKey: ["admin-random-events"] });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RandomEvent> & { id: string }) => {
      const { error } = await supabase.from("random_events").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Event updated" });
      queryClient.invalidateQueries({ queryKey: ["admin-random-events"] });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("random_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Event deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-random-events"] });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filteredEvents = events?.filter((e) => {
    if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
    if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const exportEvents = () => {
    const json = JSON.stringify(events, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "random-events.json";
    a.click();
  };

  const categoryColors: Record<string, string> = {
    career: "bg-blue-500/20 text-blue-400",
    health: "bg-red-500/20 text-red-400",
    financial: "bg-green-500/20 text-green-400",
    social: "bg-purple-500/20 text-purple-400",
    random: "bg-yellow-500/20 text-yellow-400",
    industry: "bg-cyan-500/20 text-cyan-400",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Random Events</h1>
          <p className="text-muted-foreground">Manage random events that can happen to players</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportEvents}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <EventDialog onSave={(e) => createMutation.mutate(e)} trigger={
            <Button><Plus className="h-4 w-4 mr-2" /> Add Event</Button>
          } />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{events?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Total Events</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{events?.filter((e) => e.is_active).length || 0}</div>
            <div className="text-sm text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.triggered || 0}</div>
            <div className="text-sm text-muted-foreground">Times Triggered</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.completed || 0}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Common</TableHead>
              <TableHead>Health Req</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : filteredEvents?.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">No events found</TableCell></TableRow>
            ) : (
              filteredEvents?.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium max-w-xs truncate">{event.title}</TableCell>
                  <TableCell>
                    <Badge className={categoryColors[event.category]}>{event.category}</Badge>
                  </TableCell>
                  <TableCell>{event.is_common ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    {event.health_min !== null || event.health_max !== null
                      ? `${event.health_min ?? "0"}-${event.health_max ?? "100"}`
                      : "Any"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={event.is_active}
                      onCheckedChange={(c) => updateMutation.mutate({ id: event.id, is_active: c })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <EventDialog
                        event={event}
                        onSave={(e) => updateMutation.mutate({ ...e, id: event.id })}
                        trigger={<Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>}
                      />
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(event.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
