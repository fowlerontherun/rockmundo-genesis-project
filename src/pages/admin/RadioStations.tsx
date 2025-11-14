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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Radio, Trash2, Plus, Edit2, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react";
import { SKILL_TREE_DEFINITIONS } from "@/data/skillTree";

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
};

const validateStationForm = (station: StationFormState): StationValidationErrors => {
  const errors: StationValidationErrors = {};

  if (!station.name.trim()) {
    errors.name = "Station name is required.";
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

const MIN_LISTENER_MULTIPLIER = 0.5;
const MAX_LISTENER_MULTIPLIER = 5;

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
  const [submissionToReview, setSubmissionToReview] = useState<any>(null);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

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

  const { data: submissions, isLoading: submissionsLoading } = useQuery({
    queryKey: ['admin-radio-submissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('radio_submissions')
        .select(
          '*, songs(title, genre, band_id, hype, total_radio_plays, streams, revenue), radio_stations(name, listener_base), profiles(display_name)'
        )
        .order('submitted_at', { ascending: false });
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

  // Computed submissions
  const pendingSubmissions = useMemo(() => {
    return submissions?.filter((s: any) => s.status === 'pending') || [];
  }, [submissions]);

  const reviewedSubmissions = useMemo(() => {
    return submissions?.filter((s: any) => s.status !== 'pending') || [];
  }, [submissions]);

  // Handler for creating show
  const handleCreateShow = () => {
    createShow.mutate(newShow);
  };

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
    onError: (error: any) => {
      toast.error('Failed to update station: ' + error.message);
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

  const approveSubmission = useMutation<{ showMissing: boolean }, any, any>({
    mutationFn: async (submission: any) => {
      const now = new Date();
      const nowIso = now.toISOString();

      const { data: songData, error: songError } = await supabase
        .from('songs')
        .select('id, title, hype, band_id, total_radio_plays, streams, revenue')
        .eq('id', submission.song_id)
        .single();
      if (songError) throw songError;

      const { data: stationData, error: stationError } = await supabase
        .from('radio_stations')
        .select('id, name, listener_base')
        .eq('id', submission.station_id)
        .single();
      if (stationError) throw stationError;

      const { data: showData, error: showError } = await supabase
        .from('radio_shows')
        .select('id, name')
        .eq('station_id', submission.station_id)
        .eq('is_active', true)
        .order('time_slot', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (showError) throw showError;

      const { error: updateError } = await supabase
        .from('radio_submissions')
        .update({
          status: 'accepted',
          reviewed_at: nowIso,
          rejection_reason: null,
        })
        .eq('id', submission.id);
      if (updateError) throw updateError;

      if (!songData || !stationData) {
        return { showMissing: false };
      }

      if (!showData) {
        return { showMissing: true };
      }

      const weekStartDate =
        submission.week_submitted ||
        (() => {
          const weekStart = new Date(now);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          return weekStart.toISOString().split('T')[0];
        })();

      let playlistId: string | null = null;

      const { data: existingPlaylist } = await supabase
        .from('radio_playlists')
        .select('*')
        .eq('show_id', (showData as any).id)
        .eq('song_id', submission.song_id)
        .eq('week_start_date', weekStartDate)
        .maybeSingle();

      if (existingPlaylist) {
        const { error: playlistUpdateError } = await supabase
          .from('radio_playlists')
          .update({
            times_played: (existingPlaylist.times_played || 0) + 1,
            added_at: nowIso,
            is_active: true,
          })
          .eq('id', existingPlaylist.id);
        if (playlistUpdateError) throw playlistUpdateError;

        playlistId = existingPlaylist.id;
      } else {
        const { data: newPlaylist, error: playlistInsertError } = await supabase
          .from('radio_playlists')
          .insert({
            show_id: (showData as any).id,
            song_id: submission.song_id,
            week_start_date: weekStartDate,
            added_at: nowIso,
            is_active: true,
            times_played: 1,
          })
          .select()
          .single();
        if (playlistInsertError) throw playlistInsertError;

        playlistId = newPlaylist?.id ?? null;
      }

      if (!playlistId) {
        return { showMissing: false };
      }

      const listeners = Math.max(
        100,
        Math.round((stationData.listener_base || 0) * (0.55 + Math.random() * 0.35))
      );
      const hypeGain = Math.max(1, Math.round(listeners * 0.002));
      const streamsBoost = Math.max(10, Math.round(listeners * 0.6));
      const radioRevenue = Math.max(5, Math.round(listeners * 0.015));

      const { data: playRecord, error: playError } = await supabase
        .from('radio_plays')
        .insert({
          playlist_id: playlistId,
          show_id: (showData as any).id,
          song_id: submission.song_id,
          station_id: submission.station_id,
          listeners,
          played_at: nowIso,
          hype_gained: hypeGain,
          streams_boost: streamsBoost,
          sales_boost: radioRevenue,
        })
        .select()
        .single();
      if (playError) throw playError;

      const { error: songUpdateError } = await supabase
        .from('songs')
        .update({
          hype: (songData.hype || 0) + hypeGain,
          total_radio_plays: (songData.total_radio_plays || 0) + 1,
          last_radio_play: nowIso,
          streams: (songData.streams || 0) + streamsBoost,
          revenue: (songData.revenue || 0) + radioRevenue,
        })
        .eq('id', submission.song_id);
      if (songUpdateError) throw songUpdateError;

      if (songData.band_id) {
        const { data: band, error: bandError } = await supabase
          .from('bands')
          .select('fame')
          .eq('id', songData.band_id)
          .single();

        if (!bandError && band) {
          const fameGain = 0.1;

          const { error: bandUpdateError } = await supabase
            .from('bands')
            .update({ fame: (band.fame || 0) + fameGain })
            .eq('id', songData.band_id);
          if (bandUpdateError) throw bandUpdateError;

          const { error: fameEventError } = await supabase.from('band_fame_events').insert({
            band_id: songData.band_id,
            fame_gained: fameGain,
            event_type: 'radio_play',
            event_data: {
              station_id: submission.station_id,
              station_name: stationData.name,
              play_id: playRecord?.id,
            },
          });
          if (fameEventError) throw fameEventError;

          if (radioRevenue > 0) {
            const { error: bandEarningsError } = await supabase.from('band_earnings').insert({
              band_id: songData.band_id,
              amount: radioRevenue,
              source: 'radio_play',
              description: `Radio play on ${stationData.name}`,
              metadata: {
                station_id: submission.station_id,
                station_name: stationData.name,
                song_id: songData.id,
                play_id: playRecord?.id,
              },
            });
            if (bandEarningsError) throw bandEarningsError;
          }
        }
      }

      return { showMissing: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-radio-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['my-radio-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['station-now-playing'] });
      queryClient.invalidateQueries({ queryKey: ['band-radio-earnings'] });
      queryClient.invalidateQueries({ queryKey: ['station-play-summary'] });
      queryClient.invalidateQueries({ queryKey: ['station-play-timeline'] });
      queryClient.invalidateQueries({ queryKey: ['top-radio-songs'] });

      if (result?.showMissing) {
        toast.success('Submission approved. No active show found, so scheduling was skipped.');
      } else {
        toast.success('Submission approved and scheduled for airplay.');
      }
    },
    onError: (error: any) => {
      toast.error('Failed to approve submission: ' + error.message);
    },
  });

  const rejectSubmission = useMutation<any, any, { submissionId: string; reason: string }>({
    mutationFn: async ({ submissionId, reason }) => {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('radio_submissions')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          reviewed_at: nowIso,
        })
        .eq('id', submissionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-radio-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['my-radio-submissions'] });
      toast.success('Submission rejected.');
      setIsRejectDialogOpen(false);
      setSubmissionToReview(null);
      setRejectionReason('');
    },
    onError: (error: any) => {
      toast.error('Failed to reject submission: ' + error.message);
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
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
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
            <Dialog
              open={!!editingStation}
              onOpenChange={(open) => {
                if (!open) {
                  setEditingStation(null);
                }
              }}
            >
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Edit Radio Station</DialogTitle>
                  <DialogDescription>
                    Update the details of the selected radio station.
                  </DialogDescription>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!editingStation || !editStationForm) return;
                    const updates = {
                      name: editStationForm.name,
                      frequency: editStationForm.frequency,
                      station_type: editStationForm.station_type,
                      quality_level: editStationForm.quality_level,
                      listener_base: editStationForm.listener_base,
                      accepted_genres: editStationForm.accepted_genres,
                      description: editStationForm.description,
                      country:
                        editStationForm.station_type === 'national'
                          ? editStationForm.country
                          : null,
                      city_id:
                        editStationForm.station_type === 'local'
                          ? editStationForm.city_id
                          : null,
                    };

                    updateStation.mutate({
                      id: editingStation.id,
                      updates,
                    });
                  }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Station Name</Label>
                      <Input
                        value={editStationForm?.name || ''}
                        onChange={(e) =>
                          editStationForm && setEditStationForm({
                            ...editStationForm,
                            name: e.target.value,
                          })
                        }
                        placeholder="ROCK FM"
                      />
                    </div>
                    <div>
                      <Label>Frequency (FM/AM)</Label>
                      <Input
                        value={editStationForm?.frequency || ''}
                        onChange={(e) =>
                          editStationForm && setEditStationForm({
                            ...editStationForm,
                            frequency: e.target.value,
                          })
                        }
                        placeholder="98.5 FM"
                      />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Select
                        value={editStationForm?.station_type || 'national'}
                        onValueChange={(value: 'national' | 'local') =>
                          editStationForm && setEditStationForm({
                            ...editStationForm,
                            station_type: value,
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
                    {editStationForm?.station_type === 'national' ? (
                      <div>
                        <Label>Country</Label>
                        <Input
                          value={editStationForm?.country || ''}
                          onChange={(e) =>
                            editStationForm && setEditStationForm({
                              ...editStationForm,
                              country: e.target.value,
                            })
                          }
                          placeholder="USA"
                        />
                      </div>
                    ) : (
                      <div>
                        <Label>City</Label>
                        <Select
                          value={editStationForm?.city_id || ''}
                          onValueChange={(value) =>
                            editStationForm && setEditStationForm({
                              ...editStationForm,
                              city_id: value,
                            })
                          }
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
                        value={editStationForm?.quality_level || 3}
                        onChange={(e) =>
                          editStationForm && setEditStationForm({
                            ...editStationForm,
                            quality_level: parseInt(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Listener Base</Label>
                      <Input
                        type="number"
                        value={editStationForm?.listener_base || 0}
                        onChange={(e) =>
                          editStationForm && setEditStationForm({
                            ...editStationForm,
                            listener_base: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={editStationForm?.description || ''}
                      onChange={(e) =>
                        editStationForm && setEditStationForm({
                          ...editStationForm,
                          description: e.target.value,
                        })
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
                          variant={editStationForm?.accepted_genres.includes(genre) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() =>
                            editStationForm && toggleGenre(genre, editStationForm.accepted_genres, (genres) =>
                              setEditStationForm({
                                ...editStationForm,
                                accepted_genres: genres,
                              })
                            )
                          }
                        >
                          {genre}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingStation(null)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={!editStationForm?.name || updateStation.isPending}>
                      Save Changes
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="submissions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pending Submissions</CardTitle>
                <CardDescription>
                  Review and approve songs before they hit the airwaves.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {submissionsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading submissions...</p>
                ) : pendingSubmissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending submissions right now.</p>
                ) : (
                  pendingSubmissions.map((submission: any) => {
                    const isApproving =
                      approveSubmission.isPending &&
                      (approveSubmission.variables as any)?.id === submission.id;

                    return (
                      <div key={submission.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                          <div>
                            <h3 className="font-semibold">{submission.songs?.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              {submission.profiles?.display_name} • {submission.radio_stations?.name}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>
                              Submitted {new Date(submission.submitted_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <Badge variant="outline" className="uppercase">
                            {submission.songs?.genre || 'Unknown Genre'}
                          </Badge>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSubmissionToReview(submission);
                                setRejectionReason('');
                                setIsRejectDialogOpen(true);
                              }}
                              disabled={approveSubmission.isPending || rejectSubmission.isPending}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => approveSubmission.mutate(submission)}
                              disabled={isApproving || rejectSubmission.isPending}
                            >
                              {isApproving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Approve & Schedule'
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recently Reviewed</CardTitle>
                <CardDescription>
                  Keep tabs on the decisions your team has made.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {submissionsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading submissions...</p>
                ) : reviewedSubmissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No reviewed submissions yet.</p>
                ) : (
                  reviewedSubmissions.slice(0, 10).map((submission: any) => (
                    <div
                      key={submission.id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border rounded-lg p-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {submission.status === 'accepted' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <h3 className="font-semibold">{submission.songs?.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {submission.profiles?.display_name} • {submission.radio_stations?.name}
                        </p>
                        {submission.status === 'rejected' && submission.rejection_reason && (
                          <p className="text-xs text-red-500">
                            Reason: {submission.rejection_reason}
                          </p>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Reviewed{' '}
                        {submission.reviewed_at
                          ? new Date(submission.reviewed_at).toLocaleString()
                          : '—'}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
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
                        onChange={(e) =>
                          setEditStationForm({
                            ...editStationForm,
                            quality_level: parseInt(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Listener Base</Label>
                      <Input
                        type="number"
                        value={editStationForm.listener_base}
                        onChange={(e) =>
                          setEditStationForm({
                            ...editStationForm,
                            listener_base: parseInt(e.target.value),
                          })
                        }
                      />
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
