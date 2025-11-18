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
import { Calendar, Music, Users, DollarSign, Plus, Trash2, Edit } from "lucide-react";
import { format } from "date-fns";
import { MUSIC_GENRES } from "@/data/genres";
import { Checkbox } from "@/components/ui/checkbox";

export default function FestivalsAdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingFestival, setEditingFestival] = useState<any>(null);

  // Fetch festivals
  const { data: festivals, isLoading } = useQuery({
    queryKey: ["admin-festivals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_events")
        .select("*")
        .eq("event_type", "festival")
        .order("start_date", { ascending: false });
      if (error) throw error;
      
      // Fetch participants and revenue separately
      const festivalsWithDetails = await Promise.all((data || []).map(async (festival) => {
        const { data: participants } = await (supabase as any)
          .from("festival_participants")
          .select("*, bands(name)")
          .eq("event_id", festival.id);
          
        const { data: revenue } = await (supabase as any)
          .from("festival_revenue_streams")
          .select("*")
          .eq("event_id", festival.id);
          
        return {
          ...festival,
          festival_participants: participants || [],
          festival_revenue_streams: revenue || [],
        };
      }));
      
      return festivalsWithDetails;
    },
  });

  // Create festival
  const createMutation = useMutation({
    mutationFn: async (festivalData: any) => {
      const { data, error } = await supabase
        .from("game_events")
        .insert({
          title: festivalData.title,
          event_type: "festival",
          start_date: festivalData.start_date,
          end_date: festivalData.end_date,
          description: festivalData.description,
          metadata: {
            city_id: festivalData.city_id,
            capacity: parseInt(festivalData.capacity),
            ticket_price: parseInt(festivalData.ticket_price),
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
      toast({ title: "Festival created successfully" });
      setIsCreateOpen(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to create festival", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Delete festival
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("game_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-festivals"] });
      toast({ title: "Festival deleted successfully" });
    },
  });

  // Add participant
  const addParticipantMutation = useMutation({
    mutationFn: async (participantData: any) => {
      const { error } = await (supabase as any).from("festival_participants").insert({
        event_id: participantData.event_id,
        band_id: participantData.band_id,
        slot_type: participantData.slot_type,
        performance_date: participantData.performance_date,
        payout_amount: parseInt(participantData.payout_amount),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-festivals"] });
      toast({ title: "Participant added successfully" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-oswald">Festivals Administration</h1>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Festival
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Festival</DialogTitle>
            </DialogHeader>
            <FestivalForm onSubmit={(data) => createMutation.mutate(data)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading festivals...</div>
      ) : (
        <div className="grid gap-4">
          {festivals?.map((festival: any) => (
            <Card key={festival.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {festival.title}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(festival.start_date), "MMM d")} -{" "}
                      {format(new Date(festival.end_date), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingFestival(festival)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Delete this festival?")) {
                          deleteMutation.mutate(festival.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">{festival.description}</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="font-medium">{festival.metadata?.location || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Capacity</p>
                    <p className="font-medium">{festival.metadata?.capacity?.toLocaleString() || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ticket Price</p>
                    <p className="font-medium">${festival.metadata?.ticket_price || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Participants</p>
                    <p className="font-medium">{festival.festival_participants?.length || 0}</p>
                  </div>
                </div>

                {festival.metadata?.genres && (
                  <div className="flex gap-2 flex-wrap">
                    {festival.metadata.genres.map((genre: string) => (
                      <Badge key={genre} variant="secondary">
                        {genre}
                      </Badge>
                    ))}
                  </div>
                )}

                {festival.festival_participants && festival.festival_participants.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Music className="h-4 w-4" />
                      Lineup
                    </h4>
                    <div className="space-y-1">
                      {festival.festival_participants.map((participant: any) => (
                        <div
                          key={participant.id}
                          className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {participant.slot_type}
                            </Badge>
                            <span>{participant.bands?.name || "Unknown Band"}</span>
                          </div>
                          <span className="text-muted-foreground">
                            ${participant.payout_amount?.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {festival.festival_revenue_streams && festival.festival_revenue_streams.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Revenue Streams
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {festival.festival_revenue_streams.map((stream: any) => (
                        <div key={stream.id} className="text-sm py-1 px-2 rounded bg-muted/50">
                          <p className="text-xs text-muted-foreground capitalize">{stream.stream_type}</p>
                          <p className="font-medium">${stream.amount?.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function FestivalForm({ onSubmit, initialData }: { onSubmit: (data: any) => void; initialData?: any }) {
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    start_date: initialData?.start_date?.split("T")[0] || "",
    end_date: initialData?.end_date?.split("T")[0] || "",
    description: initialData?.description || "",
    city_id: initialData?.metadata?.city_id || "",
    capacity: initialData?.metadata?.capacity || "",
    ticket_price: initialData?.metadata?.ticket_price || "",
    genres: initialData?.metadata?.genres || [],
  });

  const { data: cities } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("id, name, country")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleGenreToggle = (genre: string) => {
    setFormData((prev) => {
      const genres = prev.genres.includes(genre)
        ? prev.genres.filter((g) => g !== genre)
        : [...prev.genres, genre];
      return { ...prev, genres };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Festival Name</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start_date">Start Date</Label>
          <Input
            id="start_date"
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="end_date">End Date</Label>
          <Input
            id="end_date"
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="city_id">City</Label>
        <Select
          value={formData.city_id}
          onValueChange={(value) => setFormData({ ...formData, city_id: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a city" />
          </SelectTrigger>
          <SelectContent>
            {cities?.map((city) => (
              <SelectItem key={city.id} value={city.id}>
                {city.name}, {city.country}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="capacity">Capacity</Label>
          <Input
            id="capacity"
            type="number"
            value={formData.capacity}
            onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="ticket_price">Ticket Price ($)</Label>
          <Input
            id="ticket_price"
            type="number"
            value={formData.ticket_price}
            onChange={(e) => setFormData({ ...formData, ticket_price: e.target.value })}
            required
          />
        </div>
      </div>

      <div>
        <Label>Genres</Label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {MUSIC_GENRES.map((genre) => (
            <div key={genre} className="flex items-center space-x-2">
              <Checkbox
                id={`genre-${genre}`}
                checked={formData.genres.includes(genre)}
                onCheckedChange={() => handleGenreToggle(genre)}
              />
              <label
                htmlFor={`genre-${genre}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {genre}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={4}
        />
      </div>

      <Button type="submit" className="w-full">
        {initialData ? "Update Festival" : "Create Festival"}
      </Button>
    </form>
  );
}
