import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminRoute } from "@/components/AdminRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Radio, Trash2, Plus, Edit2 } from "lucide-react";
import { SKILL_TREE_DEFINITIONS } from "@/data/skillTree";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const GENRES = SKILL_TREE_DEFINITIONS
  .filter((skill: any) => skill.metadata?.category === 'genre')
  .map((skill: any) => skill.slug);

const TIME_SLOTS = [
  { value: 'morning_drive', label: 'Morning Drive (6-10 AM)' },
  { value: 'midday', label: 'Midday (10 AM-2 PM)' },
  { value: 'afternoon_drive', label: 'Afternoon Drive (2-6 PM)' },
  { value: 'evening', label: 'Evening (6-10 PM)' },
  { value: 'late_night', label: 'Late Night (10 PM-2 AM)' },
  { value: 'overnight', label: 'Overnight (2-6 AM)' },
  { value: 'weekend', label: 'Weekend Special' },
];

const MIN_LISTENER_MULTIPLIER = 0.5;
const MAX_LISTENER_MULTIPLIER = 5;

export default function RadioStations() {
  const queryClient = useQueryClient();
  const [editingStation, setEditingStation] = useState<any>(null);
  const [editingShow, setEditingShow] = useState<any>(null);
  const [editShowData, setEditShowData] = useState<typeof newShow | null>(null);
  const [newStation, setNewStation] = useState({
    name: '',
    station_type: 'national' as 'national' | 'local',
    country: '',
    city_id: null as string | null,
    quality_level: 3,
    listener_base: 10000,
    accepted_genres: [] as string[],
    description: '',
    frequency: '',
  });
  const [newShow, setNewShow] = useState({
    station_id: '',
    show_name: '',
    host_name: '',
    time_slot: 'morning_drive',
    day_of_week: null as number | null,
    listener_multiplier: 1.0,
    show_genres: [] as string[],
    description: '',
  });

  const { data: stations, isLoading: stationsLoading } = useQuery({
    queryKey: ['admin-radio-stations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('radio_stations')
        .select('*, cities(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: shows } = useQuery({
    queryKey: ['admin-radio-shows'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('radio_shows')
        .select('*, radio_stations(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: cities } = useQuery({
    queryKey: ['cities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cities')
        .select('id, name, country')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const createStation = useMutation({
    mutationFn: async (station: typeof newStation) => {
      const { data, error } = await supabase
        .from('radio_stations')
        .insert([station])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-radio-stations'] });
      toast.success('Radio station created successfully');
      setNewStation({
        name: '',
        station_type: 'national',
        country: '',
        city_id: null,
        quality_level: 3,
        listener_base: 10000,
        accepted_genres: [],
        description: '',
        frequency: '',
      });
    },
    onError: (error: any) => {
      toast.error('Failed to create station: ' + error.message);
    },
  });

  const updateStation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from('radio_stations')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-radio-stations'] });
      toast.success('Station updated');
      setEditingStation(null);
    },
  });

  const deleteStation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('radio_stations')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-radio-stations'] });
      toast.success('Station deleted');
    },
  });

  const createShow = useMutation({
    mutationFn: async (show: typeof newShow) => {
      const { data, error } = await supabase
        .from('radio_shows')
        .insert([show])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-radio-shows'] });
      toast.success('Radio show created successfully');
      setNewShow({
        station_id: '',
        show_name: '',
        host_name: '',
        time_slot: 'morning_drive',
        day_of_week: null,
        listener_multiplier: 1.0,
        show_genres: [],
        description: '',
      });
    },
    onError: (error: any) => {
      toast.error('Failed to create show: ' + error.message);
    },
  });

  const updateShow = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: typeof newShow }) => {
      const { error } = await supabase
        .from('radio_shows')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-radio-shows'] });
      toast.success('Radio show updated successfully');
      setEditingShow(null);
    },
    onError: (error: any) => {
      toast.error('Failed to update show: ' + error.message);
    },
  });

  const deleteShow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('radio_shows')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-radio-shows'] });
      toast.success('Show deleted');
    },
  });

  const toggleGenre = (genre: string, list: string[], setter: (list: string[]) => void) => {
    if (list.includes(genre)) {
      setter(list.filter(g => g !== genre));
    } else if (list.length < 4) {
      setter([...list, genre]);
    } else {
      toast.error('Maximum 4 genres allowed');
    }
  };

  useEffect(() => {
    if (editingShow) {
      setEditShowData({
        station_id: editingShow.station_id,
        show_name: editingShow.show_name,
        host_name: editingShow.host_name,
        time_slot: editingShow.time_slot,
        day_of_week: editingShow.day_of_week ?? null,
        listener_multiplier: Number(editingShow.listener_multiplier) || 1.0,
        show_genres: Array.isArray(editingShow.show_genres) ? editingShow.show_genres : [],
        description: editingShow.description ?? '',
      });
    } else {
      setEditShowData(null);
    }
  }, [editingShow]);

  const handleCreateShow = () => {
    if (!newShow.station_id || !newShow.show_name) {
      toast.error('Station and show name are required');
      return;
    }

    if (
      Number.isNaN(newShow.listener_multiplier) ||
      newShow.listener_multiplier < MIN_LISTENER_MULTIPLIER ||
      newShow.listener_multiplier > MAX_LISTENER_MULTIPLIER
    ) {
      toast.error(`Listener multiplier must be between ${MIN_LISTENER_MULTIPLIER}x and ${MAX_LISTENER_MULTIPLIER}x`);
      return;
    }

    if (newShow.show_genres.length > 4) {
      toast.error('Maximum 4 genres allowed');
      return;
    }

    createShow.mutate(newShow);
  };

  const handleUpdateShow = () => {
    if (!editingShow || !editShowData) return;

    if (!editShowData.station_id || !editShowData.show_name) {
      toast.error('Station and show name are required');
      return;
    }

    if (
      Number.isNaN(editShowData.listener_multiplier) ||
      editShowData.listener_multiplier < MIN_LISTENER_MULTIPLIER ||
      editShowData.listener_multiplier > MAX_LISTENER_MULTIPLIER
    ) {
      toast.error(`Listener multiplier must be between ${MIN_LISTENER_MULTIPLIER}x and ${MAX_LISTENER_MULTIPLIER}x`);
      return;
    }

    if (editShowData.show_genres.length > 4) {
      toast.error('Maximum 4 genres allowed');
      return;
    }

    updateShow.mutate({
      id: editingShow.id,
      updates: {
        ...editShowData,
      },
    });
  };

  if (stationsLoading) {
    return (
      <AdminRoute>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </AdminRoute>
    );
  }

  return (
    <AdminRoute>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Radio className="h-8 w-8" />
          <div>
            <h1 className="text-4xl font-oswald">Radio Management</h1>
            <p className="text-muted-foreground">Manage radio stations and shows</p>
          </div>
        </div>

        <Tabs defaultValue="stations" className="w-full">
          <TabsList>
            <TabsTrigger value="stations">Radio Stations</TabsTrigger>
            <TabsTrigger value="shows">Radio Shows</TabsTrigger>
          </TabsList>

          <TabsContent value="stations" className="space-y-6">
            {/* Create Station */}
            <Card>
              <CardHeader>
                <CardTitle>Create Radio Station</CardTitle>
                <CardDescription>Add a new national or local radio station</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Station Name</Label>
                    <Input
                      value={newStation.name}
                      onChange={(e) => setNewStation({ ...newStation, name: e.target.value })}
                      placeholder="ROCK FM"
                    />
                  </div>
                  <div>
                    <Label>Frequency (FM/AM)</Label>
                    <Input
                      value={newStation.frequency}
                      onChange={(e) => setNewStation({ ...newStation, frequency: e.target.value })}
                      placeholder="98.5 FM"
                    />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={newStation.station_type}
                      onValueChange={(value: 'national' | 'local') =>
                        setNewStation({ ...newStation, station_type: value, city_id: null })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="national">National</SelectItem>
                        <SelectItem value="local">Local</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newStation.station_type === 'national' ? (
                    <div>
                      <Label>Country</Label>
                      <Input
                        value={newStation.country}
                        onChange={(e) => setNewStation({ ...newStation, country: e.target.value })}
                        placeholder="USA"
                      />
                    </div>
                  ) : (
                    <div>
                      <Label>City</Label>
                      <Select
                        value={newStation.city_id || ''}
                        onValueChange={(value) => setNewStation({ ...newStation, city_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select city" />
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
                  )}
                  <div>
                    <Label>Quality Level (1-5)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="5"
                      value={newStation.quality_level}
                      onChange={(e) =>
                        setNewStation({ ...newStation, quality_level: parseInt(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label>Listener Base</Label>
                    <Input
                      type="number"
                      value={newStation.listener_base}
                      onChange={(e) =>
                        setNewStation({ ...newStation, listener_base: parseInt(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={newStation.description}
                    onChange={(e) => setNewStation({ ...newStation, description: e.target.value })}
                    placeholder="Station description..."
                  />
                </div>
                <div>
                  <Label>Accepted Genres (max 4)</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {GENRES.map((genre) => (
                      <Badge
                        key={genre}
                        variant={newStation.accepted_genres.includes(genre) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() =>
                          toggleGenre(genre, newStation.accepted_genres, (genres) =>
                            setNewStation({ ...newStation, accepted_genres: genres })
                          )
                        }
                      >
                        {genre}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button onClick={() => createStation.mutate(newStation)} disabled={!newStation.name}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Station
                </Button>
              </CardContent>
            </Card>

            {/* Stations List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stations?.map((station) => (
                <Card key={station.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{station.name}</CardTitle>
                        <CardDescription>{station.frequency}</CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingStation(station)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteStation.mutate(station.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Type:</span>
                      <Badge variant="outline">{station.station_type}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Location:</span>
                      <span>
                        {station.station_type === 'national'
                          ? station.country
                          : station.cities?.name}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Quality:</span>
                      <Badge>Level {station.quality_level}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Listeners:</span>
                      <span>{station.listener_base.toLocaleString()}</span>
                    </div>
                    {station.accepted_genres?.length > 0 && (
                      <div className="pt-2">
                        <p className="text-sm text-muted-foreground mb-1">Genres:</p>
                        <div className="flex flex-wrap gap-1">
                          {station.accepted_genres.map((genre: string) => (
                            <Badge key={genre} variant="secondary" className="text-xs">
                              {genre}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="shows" className="space-y-6">
            {/* Create Show */}
            <Card>
              <CardHeader>
                <CardTitle>Create Radio Show</CardTitle>
                <CardDescription>Add a new show to a radio station</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Radio Station</Label>
                    <Select
                      value={newShow.station_id}
                      onValueChange={(value) => setNewShow({ ...newShow, station_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select station" />
                      </SelectTrigger>
                      <SelectContent>
                        {stations?.map((station) => (
                          <SelectItem key={station.id} value={station.id}>
                            {station.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Show Name</Label>
                    <Input
                      value={newShow.show_name}
                      onChange={(e) => setNewShow({ ...newShow, show_name: e.target.value })}
                      placeholder="Morning Rock Show"
                    />
                  </div>
                  <div>
                    <Label>Host Name</Label>
                    <Input
                      value={newShow.host_name}
                      onChange={(e) => setNewShow({ ...newShow, host_name: e.target.value })}
                      placeholder="DJ Johnny"
                    />
                  </div>
                  <div>
                    <Label>Time Slot</Label>
                    <Select
                      value={newShow.time_slot}
                      onValueChange={(value) => setNewShow({ ...newShow, time_slot: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_SLOTS.map((slot) => (
                          <SelectItem key={slot.value} value={slot.value}>
                            {slot.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Listener Multiplier</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min={MIN_LISTENER_MULTIPLIER}
                      max={MAX_LISTENER_MULTIPLIER}
                      value={newShow.listener_multiplier}
                      onChange={(e) =>
                        setNewShow({ ...newShow, listener_multiplier: parseFloat(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={newShow.description}
                    onChange={(e) => setNewShow({ ...newShow, description: e.target.value })}
                    placeholder="Show description..."
                  />
                </div>
                <div>
                  <Label>Show Genres (max 4)</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {GENRES.map((genre) => (
                      <Badge
                        key={genre}
                        variant={newShow.show_genres.includes(genre) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() =>
                          toggleGenre(genre, newShow.show_genres, (genres) =>
                            setNewShow({ ...newShow, show_genres: genres })
                          )
                        }
                      >
                        {genre}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={handleCreateShow}
                  disabled={!newShow.station_id || !newShow.show_name}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Show
                </Button>
              </CardContent>
            </Card>

            {/* Shows List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {shows?.map((show) => (
                <Card key={show.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{show.show_name}</CardTitle>
                        <CardDescription>{show.radio_stations?.name}</CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingShow(show)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteShow.mutate(show.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Host:</span>
                      <span>{show.host_name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Time Slot:</span>
                      <Badge variant="outline">
                        {TIME_SLOTS.find((s) => s.value === show.time_slot)?.label}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Multiplier:</span>
                      <span>{show.listener_multiplier}x</span>
                    </div>
                    {show.show_genres?.length > 0 && (
                      <div className="pt-2">
                        <p className="text-sm text-muted-foreground mb-1">Genres:</p>
                        <div className="flex flex-wrap gap-1">
                          {show.show_genres.map((genre: string) => (
                            <Badge key={genre} variant="secondary" className="text-xs">
                              {genre}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog
          open={!!editingShow}
          onOpenChange={(open) => {
            if (!open) {
              setEditingShow(null);
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Radio Show</DialogTitle>
              <DialogDescription>Update the show's details and listener settings.</DialogDescription>
            </DialogHeader>

            {editShowData && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Radio Station</Label>
                    <Select
                      value={editShowData.station_id}
                      onValueChange={(value) =>
                        setEditShowData({ ...editShowData, station_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select station" />
                      </SelectTrigger>
                      <SelectContent>
                        {stations?.map((station) => (
                          <SelectItem key={station.id} value={station.id}>
                            {station.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Show Name</Label>
                    <Input
                      value={editShowData.show_name}
                      onChange={(e) =>
                        setEditShowData({ ...editShowData, show_name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Host Name</Label>
                    <Input
                      value={editShowData.host_name}
                      onChange={(e) =>
                        setEditShowData({ ...editShowData, host_name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Time Slot</Label>
                    <Select
                      value={editShowData.time_slot}
                      onValueChange={(value) =>
                        setEditShowData({ ...editShowData, time_slot: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_SLOTS.map((slot) => (
                          <SelectItem key={slot.value} value={slot.value}>
                            {slot.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Listener Multiplier</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min={MIN_LISTENER_MULTIPLIER}
                      max={MAX_LISTENER_MULTIPLIER}
                      value={editShowData.listener_multiplier}
                      onChange={(e) =>
                        setEditShowData({
                          ...editShowData,
                          listener_multiplier: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={editShowData.description}
                    onChange={(e) =>
                      setEditShowData({ ...editShowData, description: e.target.value })
                    }
                    placeholder="Show description..."
                  />
                </div>
                <div>
                  <Label>Show Genres (max 4)</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {GENRES.map((genre) => (
                      <Badge
                        key={genre}
                        variant={editShowData.show_genres.includes(genre) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() =>
                          toggleGenre(genre, editShowData.show_genres, (genres) =>
                            setEditShowData({ ...editShowData, show_genres: genres })
                          )
                        }
                      >
                        {genre}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingShow(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateShow} disabled={updateShow.isPending}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminRoute>
  );
}
