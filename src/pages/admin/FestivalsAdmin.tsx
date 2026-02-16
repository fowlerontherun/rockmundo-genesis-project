import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, Music, Users, DollarSign, Plus, Trash2, Edit, ChevronDown, Layers, Clock } from "lucide-react";
import { format } from "date-fns";
import { MUSIC_GENRES } from "@/data/genres";
import { Checkbox } from "@/components/ui/checkbox";
import { FestivalInviteManager } from "@/components/festivals/FestivalInviteManager";
import { FestivalDetailManager } from "@/components/festivals/admin/FestivalDetailManager";

export default function FestivalsAdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingFestival, setEditingFestival] = useState<any>(null);
  const [expandedFestival, setExpandedFestival] = useState<string | null>(null);

  const { data: festivals, isLoading } = useQuery({
    queryKey: ["admin-festivals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_events")
        .select("*")
        .eq("event_type", "festival")
        .order("start_date", { ascending: false });
      if (error) throw error;
      
      const festivalsWithDetails = await Promise.all((data || []).map(async (festival) => {
        const { data: participants } = await (supabase as any)
          .from("festival_participants")
          .select("*, bands(name)")
          .eq("event_id", festival.id);
          
        const { data: stageCount } = await (supabase as any)
          .from("festival_stages")
          .select("id", { count: "exact", head: true })
          .eq("festival_id", festival.id);

        return {
          ...festival,
          festival_participants: participants || [],
          stage_count: stageCount?.length || 0,
        };
      }));
      
      return festivalsWithDetails;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (festivalData: any) => {
      if (!festivalData.city_id) throw new Error("Please select a city");
      
      const { data, error } = await supabase
        .from("game_events")
        .insert({
          title: festivalData.title,
          event_type: "festival",
          start_date: `${festivalData.start_date}T00:00:00Z`,
          end_date: `${festivalData.end_date}T23:59:59Z`,
          description: festivalData.description,
          duration_days: parseInt(festivalData.duration_days) || 2,
          day_of_week_start: festivalData.day_of_week_start || "saturday",
          ticket_price: parseInt(festivalData.ticket_price) || 50,
          max_stages: parseInt(festivalData.max_stages) || 1,
          festival_budget: 0,
          attendance_projection: parseInt(festivalData.capacity) || 5000,
          requirements: {
            city_id: festivalData.city_id,
            capacity: parseInt(festivalData.capacity),
            genres: festivalData.genres || [],
          },
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-festivals"] });
      toast({ title: "Festival created! Now add stages and configure finances." });
      setIsCreateOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create festival", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("game_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-festivals"] });
      toast({ title: "Festival deleted" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (festivalData: any) => {
      if (!festivalData.city_id) throw new Error("Please select a city");
      const { error } = await supabase
        .from("game_events")
        .update({
          title: festivalData.title,
          start_date: `${festivalData.start_date}T00:00:00Z`,
          end_date: `${festivalData.end_date}T23:59:59Z`,
          description: festivalData.description,
          duration_days: parseInt(festivalData.duration_days) || 2,
          day_of_week_start: festivalData.day_of_week_start || "saturday",
          ticket_price: parseInt(festivalData.ticket_price) || 50,
          max_stages: parseInt(festivalData.max_stages) || 1,
          requirements: {
            city_id: festivalData.city_id,
            capacity: parseInt(festivalData.capacity),
            genres: festivalData.genres || [],
          },
        })
        .eq("id", editingFestival?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-festivals"] });
      toast({ title: "Festival updated" });
      setIsEditOpen(false);
      setEditingFestival(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-oswald">Festivals Administration</h1>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Create Festival</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create New Festival</DialogTitle></DialogHeader>
            <FestivalForm onSubmit={(data) => createMutation.mutate(data)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading festivals...</div>
      ) : (
        <div className="grid gap-4">
          {festivals?.map((festival: any) => (
            <Collapsible
              key={festival.id}
              open={expandedFestival === festival.id}
              onOpenChange={(open) => setExpandedFestival(open ? festival.id : null)}
            >
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        {festival.title}
                      </CardTitle>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span>{format(new Date(festival.start_date), "MMM d")} - {format(new Date(festival.end_date), "MMM d, yyyy")}</span>
                        <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />{festival.duration_days || 2} days</Badge>
                        <Badge variant="outline" className="text-xs"><Layers className="h-3 w-3 mr-1" />{festival.max_stages || 1} stages</Badge>
                        <Badge variant="outline" className="text-xs"><DollarSign className="h-3 w-3 mr-1" />${festival.ticket_price || 0}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </CollapsibleTrigger>
                      <Button variant="ghost" size="sm" onClick={() => { setEditingFestival(festival); setIsEditOpen(true); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete?")) deleteMutation.mutate(festival.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CollapsibleContent>
                  <CardContent className="space-y-4 pt-0">
                    <p className="text-sm">{festival.description}</p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div><p className="text-xs text-muted-foreground">Capacity</p><p className="font-medium">{festival.requirements?.capacity?.toLocaleString() || "N/A"}</p></div>
                      <div><p className="text-xs text-muted-foreground">Participants</p><p className="font-medium">{festival.festival_participants?.length || 0}</p></div>
                      <div><p className="text-xs text-muted-foreground">Start Day</p><p className="font-medium capitalize">{festival.day_of_week_start || "saturday"}</p></div>
                      <div><p className="text-xs text-muted-foreground">Status</p><p className="font-medium">{festival.is_active ? "Active" : "Inactive"}</p></div>
                    </div>

                    {festival.requirements?.genres?.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {festival.requirements.genres.map((genre: string) => (
                          <Badge key={genre} variant="secondary">{genre}</Badge>
                        ))}
                      </div>
                    )}

                    <FestivalInviteManager festivalId={festival.id} />

                    {/* New expanded management */}
                    <FestivalDetailManager festivalId={festival.id} festival={festival} />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditingFestival(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Festival</DialogTitle></DialogHeader>
          {editingFestival && <FestivalForm onSubmit={(data) => updateMutation.mutate(data)} initialData={editingFestival} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FestivalForm({ onSubmit, initialData }: { onSubmit: (data: any) => void; initialData?: any }) {
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    start_date: initialData?.start_date?.split("T")[0] || "",
    end_date: initialData?.end_date?.split("T")[0] || "",
    description: initialData?.description || "",
    city_id: initialData?.requirements?.city_id || "",
    capacity: initialData?.requirements?.capacity || "",
    ticket_price: initialData?.ticket_price || initialData?.requirements?.ticket_price || "50",
    genres: initialData?.requirements?.genres || [],
    duration_days: initialData?.duration_days || "2",
    day_of_week_start: initialData?.day_of_week_start || "saturday",
    max_stages: initialData?.max_stages || "1",
  });

  const { data: cities } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cities").select("id, name, country").order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleGenreToggle = (genre: string) => {
    setFormData((prev) => ({
      ...prev,
      genres: prev.genres.includes(genre) ? prev.genres.filter((g: string) => g !== genre) : [...prev.genres, genre],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Festival Name</Label>
        <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div><Label>Start Date</Label><Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} required /></div>
        <div><Label>End Date</Label><Input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} required /></div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Duration (days)</Label>
          <Select value={String(formData.duration_days)} onValueChange={(v) => setFormData({ ...formData, duration_days: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 days (Sat-Sun)</SelectItem>
              <SelectItem value="3">3 days (Fri-Sun)</SelectItem>
              <SelectItem value="4">4 days (Thu-Sun)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Start Day</Label>
          <Select value={formData.day_of_week_start} onValueChange={(v) => setFormData({ ...formData, day_of_week_start: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="thursday">Thursday</SelectItem>
              <SelectItem value="friday">Friday</SelectItem>
              <SelectItem value="saturday">Saturday</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Max Stages (1-5)</Label>
          <Select value={String(formData.max_stages)} onValueChange={(v) => setFormData({ ...formData, max_stages: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1,2,3,4,5].map((n) => <SelectItem key={n} value={String(n)}>{n} stage{n > 1 ? "s" : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>City</Label>
        <Select value={formData.city_id} onValueChange={(v) => setFormData({ ...formData, city_id: v })}>
          <SelectTrigger><SelectValue placeholder="Select a city" /></SelectTrigger>
          <SelectContent>
            {cities?.map((city) => <SelectItem key={city.id} value={city.id}>{city.name}, {city.country}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div><Label>Capacity</Label><Input type="number" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: e.target.value })} required /></div>
        <div><Label>Ticket Price ($)</Label><Input type="number" value={formData.ticket_price} onChange={(e) => setFormData({ ...formData, ticket_price: e.target.value })} required /></div>
      </div>

      <div>
        <Label>Genres</Label>
        <div className="grid grid-cols-3 gap-2 mt-2 max-h-40 overflow-y-auto">
          {MUSIC_GENRES.map((genre) => (
            <div key={genre} className="flex items-center space-x-2">
              <Checkbox id={`genre-${genre}`} checked={formData.genres.includes(genre)} onCheckedChange={() => handleGenreToggle(genre)} />
              <label htmlFor={`genre-${genre}`} className="text-sm">{genre}</label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label>Description</Label>
        <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} />
      </div>

      <Button type="submit" className="w-full">{initialData ? "Update Festival" : "Create Festival"}</Button>
    </form>
  );
}
