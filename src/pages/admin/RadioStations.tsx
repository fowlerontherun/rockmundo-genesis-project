import { useEffect, useMemo, useState } from "react";
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

type StationFormState = {
  name: string;
  station_type: "national" | "local";
  country: string;
  city_id: string | null;
  quality_level: number;
  listener_base: number;
  accepted_genres: string[];
  description: string;
  frequency: string;
};

type StationValidationErrors = {
  name?: string;
  location?: string;
  quality_level?: string;
  listener_base?: string;
};

const validateStationForm = (station: StationFormState): StationValidationErrors => {
  const errors: StationValidationErrors = {};

  if (!station.name.trim()) {
    errors.name = "Station name is required.";
  }

  if (!Number.isFinite(station.quality_level)) {
    errors.quality_level = "Quality level is required.";
  } else if (!Number.isInteger(station.quality_level) || station.quality_level < 1 || station.quality_level > 5) {
    errors.quality_level = "Quality level must be a whole number between 1 and 5.";
  }

  if (!Number.isFinite(station.listener_base)) {
    errors.listener_base = "Listener base is required.";
  } else if (!Number.isInteger(station.listener_base) || station.listener_base < 1) {
    errors.listener_base = "Listener base must be a positive whole number.";
  }

  if (station.station_type === "national") {
    if (!station.country.trim()) {
      errors.location = "Country is required for national stations.";
    }
  } else {
    if (!station.city_id) {
      errors.location = "City is required for local stations.";
    }
  }

  return errors;
};

const formatStationForPersistence = (station: StationFormState): StationFormState => ({
  ...station,
  quality_level: Number.isFinite(station.quality_level)
    ? Math.min(5, Math.max(1, Math.round(station.quality_level)))
    : 1,
  listener_base: Number.isFinite(station.listener_base)
    ? Math.max(1, Math.round(station.listener_base))
    : 1,
  country: station.station_type === "national" ? station.country.trim() : "",
  city_id:
    station.station_type === "local"
      ? station.city_id && station.city_id !== ""
        ? station.city_id
        : null
      : null,
});

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

export default function RadioStations() {
  const queryClient = useQueryClient();
  const [editingStation, setEditingStation] = useState<any>(null);
  const [editingShow, setEditingShow] = useState<any>(null);
  const [newStation, setNewStation] = useState<StationFormState>({
    name: "",
    station_type: "national",
    country: "",
    city_id: null,
    quality_level: 3,
    listener_base: 10000,
    accepted_genres: [],
    description: "",
    frequency: "",
  });
  const [editStationForm, setEditStationForm] = useState<StationFormState | null>(null);
  const createStationErrors: StationValidationErrors = useMemo(
    () => validateStationForm(newStation),
    [newStation],
  );
  const isCreateStationValid = useMemo(
    () => Object.keys(createStationErrors).length === 0,
    [createStationErrors],
  );
  const editStationErrors: StationValidationErrors = useMemo(
    () => (editStationForm ? validateStationForm(editStationForm) : {}),
    [editStationForm],
  );
  const isEditStationValid = editStationForm ? Object.keys(editStationErrors).length === 0 : false;

  useEffect(() => {
    if (editingStation) {
      setEditStationForm({
        name: editingStation.name ?? "",
        station_type: editingStation.station_type ?? "national",
        country: editingStation.country ?? "",
        city_id: editingStation.city_id ? String(editingStation.city_id) : null,
        quality_level: editingStation.quality_level ?? 3,
        listener_base: editingStation.listener_base ?? 10000,
        accepted_genres: editingStation.accepted_genres ?? [],
        description: editingStation.description ?? "",
        frequency: editingStation.frequency ?? "",
      });
    } else {
      setEditStationForm(null);
    }
  }, [editingStation]);
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
    mutationFn: async (station: StationFormState) => {
      const payload = formatStationForPersistence(station);
      const { data, error } = await supabase
        .from('radio_stations')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-radio-stations'] });
      toast.success('Radio station created successfully');
      setNewStation({
        name: "",
        station_type: "national",
        country: "",
        city_id: null,
        quality_level: 3,
        listener_base: 10000,
        accepted_genres: [],
        description: "",
        frequency: "",
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

  const handleCreateStation = () => {
    if (!isCreateStationValid) {
      return;
    }

    createStation.mutate(newStation);
  };

  const handleUpdateStation = () => {
    if (!editingStation || !editStationForm || !isEditStationValid) {
      return;
    }

    updateStation.mutate({
      id: editingStation.id,
      updates: formatStationForPersistence(editStationForm),
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
                      aria-invalid={!!createStationErrors.name}
                    />
                    {createStationErrors.name && (
                      <p className="text-sm text-destructive mt-1">{createStationErrors.name}</p>
                    )}
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
                        setNewStation({
                          ...newStation,
                          station_type: value,
                          country: value === 'national' ? newStation.country : '',
                          city_id: value === 'local' ? newStation.city_id : null,
                        })
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
                        aria-invalid={!!createStationErrors.location}
                      />
                      {newStation.station_type === 'national' && createStationErrors.location && (
                        <p className="text-sm text-destructive mt-1">{createStationErrors.location}</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <Label>City</Label>
                      <Select
                        value={newStation.city_id || ''}
                        onValueChange={(value) => setNewStation({ ...newStation, city_id: value })}
                      >
                        <SelectTrigger aria-invalid={!!createStationErrors.location}>
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
                      {newStation.station_type === 'local' && createStationErrors.location && (
                        <p className="text-sm text-destructive mt-1">{createStationErrors.location}</p>
                      )}
                    </div>
                  )}
                  <div>
                    <Label>Quality Level (1-5)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="5"
                      value={newStation.quality_level}
                      aria-invalid={!!createStationErrors.quality_level}
                      onChange={(e) =>
                        setNewStation({ ...newStation, quality_level: parseInt(e.target.value, 10) })
                      }
                    />
                    {createStationErrors.quality_level && (
                      <p className="text-sm text-destructive mt-1">{createStationErrors.quality_level}</p>
                    )}
                  </div>
                  <div>
                    <Label>Listener Base</Label>
                    <Input
                      type="number"
                      value={newStation.listener_base}
                      aria-invalid={!!createStationErrors.listener_base}
                      onChange={(e) =>
                        setNewStation({ ...newStation, listener_base: parseInt(e.target.value, 10) })
                      }
                    />
                    {createStationErrors.listener_base && (
                      <p className="text-sm text-destructive mt-1">{createStationErrors.listener_base}</p>
                    )}
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
                <Button
                  onClick={() => handleCreateStation()}
                  disabled={!isCreateStationValid || createStation.isPending}
                >
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
                  onClick={() => createShow.mutate(newShow)}
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteShow.mutate(show.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
          open={!!editingStation}
          onOpenChange={(open) => {
            if (!open) {
              setEditingStation(null);
            }
          }}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Edit Radio Station</DialogTitle>
              <DialogDescription>Update the radio station details.</DialogDescription>
            </DialogHeader>
            {editStationForm && (
              <>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Station Name</Label>
                      <Input
                        value={editStationForm.name}
                        onChange={(e) =>
                          setEditStationForm({ ...editStationForm, name: e.target.value })
                        }
                        placeholder="ROCK FM"
                        aria-invalid={!!editStationErrors.name}
                      />
                      {editStationErrors.name && (
                        <p className="text-sm text-destructive mt-1">{editStationErrors.name}</p>
                      )}
                    </div>
                    <div>
                      <Label>Frequency (FM/AM)</Label>
                      <Input
                        value={editStationForm.frequency}
                        onChange={(e) =>
                          setEditStationForm({ ...editStationForm, frequency: e.target.value })
                        }
                        placeholder="98.5 FM"
                      />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Select
                        value={editStationForm.station_type}
                        onValueChange={(value: 'national' | 'local') =>
                          setEditStationForm({
                            ...editStationForm,
                            station_type: value,
                            country: value === 'national' ? editStationForm.country : '',
                            city_id: value === 'local' ? editStationForm.city_id : null,
                          })
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
                    {editStationForm.station_type === 'national' ? (
                      <div>
                        <Label>Country</Label>
                        <Input
                          value={editStationForm.country}
                          onChange={(e) =>
                            setEditStationForm({ ...editStationForm, country: e.target.value })
                          }
                          placeholder="USA"
                          aria-invalid={!!editStationErrors.location}
                        />
                        {editStationForm.station_type === 'national' && editStationErrors.location && (
                          <p className="text-sm text-destructive mt-1">{editStationErrors.location}</p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <Label>City</Label>
                        <Select
                          value={editStationForm.city_id || ''}
                          onValueChange={(value) =>
                            setEditStationForm({ ...editStationForm, city_id: value })
                          }
                        >
                          <SelectTrigger aria-invalid={!!editStationErrors.location}>
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
                        {editStationForm.station_type === 'local' && editStationErrors.location && (
                          <p className="text-sm text-destructive mt-1">{editStationErrors.location}</p>
                        )}
                      </div>
                    )}
                    <div>
                      <Label>Quality Level (1-5)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="5"
                        value={editStationForm.quality_level}
                        aria-invalid={!!editStationErrors.quality_level}
                        onChange={(e) =>
                          setEditStationForm({
                            ...editStationForm,
                            quality_level: parseInt(e.target.value, 10),
                          })
                        }
                      />
                      {editStationErrors.quality_level && (
                        <p className="text-sm text-destructive mt-1">{editStationErrors.quality_level}</p>
                      )}
                    </div>
                    <div>
                      <Label>Listener Base</Label>
                      <Input
                        type="number"
                        value={editStationForm.listener_base}
                        aria-invalid={!!editStationErrors.listener_base}
                        onChange={(e) =>
                          setEditStationForm({
                            ...editStationForm,
                            listener_base: parseInt(e.target.value, 10),
                          })
                        }
                      />
                      {editStationErrors.listener_base && (
                        <p className="text-sm text-destructive mt-1">{editStationErrors.listener_base}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={editStationForm.description}
                      onChange={(e) =>
                        setEditStationForm({ ...editStationForm, description: e.target.value })
                      }
                      placeholder="Station description..."
                    />
                  </div>
                  <div>
                    <Label>Accepted Genres (max 4)</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {GENRES.map((genre) => (
                        <Badge
                          key={genre}
                          variant={editStationForm.accepted_genres.includes(genre) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() =>
                            toggleGenre(genre, editStationForm.accepted_genres, (genres) =>
                              setEditStationForm({ ...editStationForm, accepted_genres: genres })
                            )
                          }
                        >
                          {genre}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingStation(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdateStation}
                    disabled={!isEditStationValid || updateStation.isPending}
                  >
                    {updateStation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminRoute>
  );
}
