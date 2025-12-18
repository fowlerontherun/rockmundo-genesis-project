import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Plus, ArrowRight, Trash2, Trophy, Users, Music2 } from "lucide-react";
import { toast } from "sonner";

interface EurovisionEvent {
  id: string;
  year: number;
  status: "submissions" | "voting" | "complete";
  host_city: string | null;
  host_country: string | null;
  created_at: string;
}

interface EurovisionEntry {
  id: string;
  event_id: string;
  band_id: string;
  song_id: string;
  country: string;
  vote_count: number;
  final_rank: number | null;
  band: { name: string } | null;
  song: { title: string } | null;
}

const PHASES = ["submissions", "voting", "complete"] as const;
const PHASE_LABELS: Record<string, string> = {
  submissions: "Submissions Open",
  voting: "Voting Open", 
  complete: "Complete",
};

function EurovisionAdmin() {
  const queryClient = useQueryClient();
  const [newYear, setNewYear] = useState(new Date().getFullYear() + 1);
  const [hostCity, setHostCity] = useState("");
  const [hostCountry, setHostCountry] = useState("");

  // Fetch all events
  const { data: events = [] } = useQuery({
    queryKey: ["eurovision-admin-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eurovision_events")
        .select("*")
        .order("year", { ascending: false });
      if (error) throw error;
      return data as EurovisionEvent[];
    },
  });

  const currentEvent = events[0];

  // Fetch entries for current event
  const { data: entries = [] } = useQuery({
    queryKey: ["eurovision-admin-entries", currentEvent?.id],
    queryFn: async () => {
      if (!currentEvent?.id) return [];
      const { data, error } = await supabase
        .from("eurovision_entries")
        .select(`
          id, event_id, band_id, song_id, country, vote_count, final_rank,
          band:bands(name),
          song:songs(title)
        `)
        .eq("event_id", currentEvent.id)
        .order("vote_count", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as EurovisionEntry[];
    },
    enabled: !!currentEvent?.id,
  });

  // Create new event mutation
  const createEventMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("eurovision_events")
        .insert({
          year: newYear,
          status: "submissions",
          host_city: hostCity || null,
          host_country: hostCountry || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eurovision-admin-events"] });
      toast.success(`Eurovision ${newYear} created!`);
      setNewYear(newYear + 1);
      setHostCity("");
      setHostCountry("");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Advance phase mutation
  const advancePhaseMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const event = events.find(e => e.id === eventId);
      if (!event) throw new Error("Event not found");
      
      const currentIdx = PHASES.indexOf(event.status as typeof PHASES[number]);
      if (currentIdx >= PHASES.length - 1) throw new Error("Already at final phase");
      
      const nextPhase = PHASES[currentIdx + 1];
      
      // If advancing to complete, set final ranks
      if (nextPhase === "complete") {
        const sortedEntries = [...entries].sort((a, b) => b.vote_count - a.vote_count);
        for (let i = 0; i < sortedEntries.length; i++) {
          await supabase
            .from("eurovision_entries")
            .update({ final_rank: i + 1 })
            .eq("id", sortedEntries[i].id);
        }
      }
      
      const { error } = await supabase
        .from("eurovision_events")
        .update({ status: nextPhase })
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eurovision-admin-events"] });
      queryClient.invalidateQueries({ queryKey: ["eurovision-admin-entries"] });
      toast.success("Phase advanced!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete entry mutation
  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from("eurovision_entries")
        .delete()
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eurovision-admin-entries"] });
      toast.success("Entry deleted");
    },
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from("eurovision_events")
        .delete()
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eurovision-admin-events"] });
      toast.success("Event deleted");
    },
  });

  const getNextPhaseLabel = (currentStatus: string) => {
    const idx = PHASES.indexOf(currentStatus as typeof PHASES[number]);
    if (idx >= PHASES.length - 1) return null;
    return PHASE_LABELS[PHASES[idx + 1]];
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Sparkles className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Eurovision Admin</h1>
          <p className="text-muted-foreground">Manage Eurovision events, entries, and phases</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4" /> Total Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{events.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Music2 className="h-4 w-4" /> Current Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{entries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Total Votes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{entries.reduce((sum, e) => sum + e.vote_count, 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Create New Event */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" /> Create New Eurovision
          </CardTitle>
          <CardDescription>Start a new Eurovision season</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createEventMutation.mutate();
            }}
            className="flex flex-wrap gap-4 items-end"
          >
            <div className="space-y-2">
              <Label>Year</Label>
              <Input
                type="number"
                value={newYear}
                onChange={(e) => setNewYear(parseInt(e.target.value))}
                className="w-28"
              />
            </div>
            <div className="space-y-2">
              <Label>Host City (optional)</Label>
              <Input
                value={hostCity}
                onChange={(e) => setHostCity(e.target.value)}
                placeholder="e.g. Malmö"
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label>Host Country (optional)</Label>
              <Input
                value={hostCountry}
                onChange={(e) => setHostCountry(e.target.value)}
                placeholder="e.g. Sweden"
                className="w-40"
              />
            </div>
            <Button type="submit" disabled={createEventMutation.isPending}>
              <Plus className="mr-2 h-4 w-4" />
              Create Event
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Current Event Management */}
      {currentEvent && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Eurovision {currentEvent.year}</CardTitle>
                <CardDescription>
                  {currentEvent.host_city && `${currentEvent.host_city}, ${currentEvent.host_country}`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={currentEvent.status === "complete" ? "default" : "secondary"}>
                  {PHASE_LABELS[currentEvent.status]}
                </Badge>
                {getNextPhaseLabel(currentEvent.status) && (
                  <Button
                    size="sm"
                    onClick={() => advancePhaseMutation.mutate(currentEvent.id)}
                    disabled={advancePhaseMutation.isPending}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Advance to {getNextPhaseLabel(currentEvent.status)}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <h3 className="font-semibold">Entries ({entries.length})</h3>
              {entries.length === 0 ? (
                <p className="text-muted-foreground">No entries yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Band</TableHead>
                      <TableHead>Song</TableHead>
                      <TableHead className="text-right">Votes</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry, idx) => (
                      <TableRow key={entry.id}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell className="font-medium">{entry.country}</TableCell>
                        <TableCell>{entry.band?.name || "Unknown"}</TableCell>
                        <TableCell>{entry.song?.title || "Unknown"}</TableCell>
                        <TableCell className="text-right font-semibold">{entry.vote_count}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteEntryMutation.mutate(entry.id)}
                            disabled={deleteEntryMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Events */}
      {events.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>All Events</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-semibold">{event.year}</TableCell>
                    <TableCell>
                      {event.host_city ? `${event.host_city}, ${event.host_country}` : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{PHASE_LABELS[event.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Delete this event and all its entries?")) {
                            deleteEventMutation.mutate(event.id);
                          }
                        }}
                        disabled={deleteEventMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function EurovisionAdminPage() {
  return (
    <AdminRoute>
      <EurovisionAdmin />
    </AdminRoute>
  );
}
