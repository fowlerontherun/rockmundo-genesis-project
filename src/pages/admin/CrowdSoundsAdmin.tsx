import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Volume2, Upload, Trash2, Play, Pause, Plus, 
  Music, Users, Mic2, PartyPopper, Loader2, Files, Sparkles
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SOUND_TYPES = [
  { value: 'band_entrance', label: 'Band Entrance', icon: Mic2 },
  { value: 'band_exit', label: 'Band Exit', icon: Mic2 },
  { value: 'encore_request', label: 'Encore Request', icon: PartyPopper },
  { value: 'crowd_cheer_small', label: 'Crowd Cheer (Small)', icon: Users },
  { value: 'crowd_cheer_medium', label: 'Crowd Cheer (Medium)', icon: Users },
  { value: 'crowd_cheer_large', label: 'Crowd Cheer (Large)', icon: Users },
  { value: 'crowd_singing', label: 'Crowd Singing', icon: Music },
  { value: 'applause', label: 'Applause', icon: Users },
  { value: 'booing', label: 'Booing', icon: Users },
  { value: 'ambient_chatter', label: 'Ambient Chatter', icon: Users },
  { value: 'song_recognition', label: 'Song Recognition', icon: Music },
  { value: 'mosh_pit', label: 'Mosh Pit', icon: PartyPopper },
  { value: 'lighter_moment', label: 'Lighter Moment', icon: Music },
] as const;

type CrowdSoundType = typeof SOUND_TYPES[number]["value"];

function inferCrowdSoundMetadata(fileName: string): { soundType: CrowdSoundType; intensity: number; name: string } {
  const base = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const value = base.toLowerCase();

  let soundType: CrowdSoundType = "crowd_cheer_medium";
  let intensity = 5;

  if (/pre.?gig|pub background|gig background|background|ambient|chatter/.test(value)) {
    soundType = "ambient_chatter";
    intensity = /large|stadium|festival/.test(value) ? 6 : /pub|small/.test(value) ? 3 : 4;
  } else if (/encore/.test(value)) {
    soundType = "encore_request";
    intensity = /small/.test(value) ? 5 : 8;
  } else if (/clap|applause/.test(value)) {
    soundType = "applause";
    intensity = /large|festival/.test(value) ? 9 : /medium|indoor/.test(value) ? 6 : /small/.test(value) ? 4 : 6;
  } else if (/end of gig|gig end|band exit|exit/.test(value)) {
    soundType = "band_exit";
    intensity = /large|festival/.test(value) ? 9 : 7;
  } else if (/sing|chant/.test(value)) {
    soundType = "crowd_singing";
    intensity = 7;
  } else if (/boo/.test(value)) {
    soundType = "booing";
    intensity = 6;
  } else if (/cheer|roar/.test(value)) {
    soundType = /large|stadium|festival/.test(value)
      ? "crowd_cheer_large"
      : /small/.test(value)
        ? "crowd_cheer_small"
        : "crowd_cheer_medium";
    intensity = soundType === "crowd_cheer_large" ? 9 : soundType === "crowd_cheer_small" ? 4 : 7;
  } else if (/entrance|band enters|walk on/.test(value)) {
    soundType = "band_entrance";
    intensity = 7;
  }

  return {
    soundType,
    intensity,
    name: base.replace(/\b\w/g, (letter) => letter.toUpperCase()),
  };
}

async function crowdAudioDurationSeconds(url: string): Promise<number | null> {
  if (typeof Audio === "undefined") return null;
  const audio = new Audio(url);
  return await new Promise<number | null>((resolve) => {
    const finish = (value: number | null) => {
      audio.onloadedmetadata = null;
      audio.onerror = null;
      resolve(value);
    };
    audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) ? Math.round(audio.duration) : null);
    audio.onerror = () => finish(null);
    audio.load();
    window.setTimeout(() => finish(null), 5_000);
  });
}

interface CrowdSound {
  id: string;
  name: string;
  description: string | null;
  sound_type: string;
  audio_url: string;
  duration_seconds: number | null;
  intensity_level: number;
  is_active: boolean;
  created_at: string;
}

export default function CrowdSoundsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    sound_type: "crowd_cheer_medium",
    intensity_level: 5,
    is_active: true,
    audio_file: null as File | null,
  });

  const { data: sounds, isLoading } = useQuery({
    queryKey: ['crowd-sounds'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gig_crowd_sounds')
        .select('*')
        .order('sound_type')
        .order('intensity_level');
      if (error) throw error;
      return data as CrowdSound[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!data.audio_file) throw new Error("Audio file required");
      
      // Upload audio file
      const fileName = `${Date.now()}-${data.audio_file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('crowd-sounds')
        .upload(fileName, data.audio_file);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('crowd-sounds')
        .getPublicUrl(fileName);
      
      // Get audio duration
      const audio = new Audio(urlData.publicUrl);
      await new Promise((resolve) => {
        audio.addEventListener('loadedmetadata', resolve);
        audio.load();
      });
      
      // Insert record
      const { error } = await supabase.from('gig_crowd_sounds').insert({
        name: data.name,
        description: data.description || null,
        sound_type: data.sound_type,
        audio_url: urlData.publicUrl,
        duration_seconds: Math.round(audio.duration),
        intensity_level: data.intensity_level,
        is_active: data.is_active,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Crowd sound added" });
      queryClient.invalidateQueries({ queryKey: ['crowd-sounds'] });
      setIsDialogOpen(false);
      setFormData({
        name: "",
        description: "",
        sound_type: "crowd_cheer_medium",
        intensity_level: 5,
        is_active: true,
        audio_file: null,
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('gig_crowd_sounds').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Sound removed" });
      queryClient.invalidateQueries({ queryKey: ['crowd-sounds'] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('gig_crowd_sounds')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crowd-sounds'] });
    },
  });

  const handlePlay = (sound: CrowdSound) => {
    if (playingId === sound.id) {
      audioElement?.pause();
      setPlayingId(null);
      setAudioElement(null);
    } else {
      audioElement?.pause();
      const audio = new Audio(sound.audio_url);
      audio.play();
      audio.onended = () => {
        setPlayingId(null);
        setAudioElement(null);
      };
      setPlayingId(sound.id);
      setAudioElement(audio);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      await createMutation.mutateAsync(formData);
    } finally {
      setIsUploading(false);
    }
  };

  const handleBulkUpload = async (files: FileList | null) => {
    const selected = files ? Array.from(files).filter((file) => file.type.startsWith("audio/") || /\.(mp3|wav|ogg|webm|m4a|mp4)$/i.test(file.name)) : [];
    if (!selected.length) return;

    setBulkUploading(true);
    setBulkProgress({ done: 0, total: selected.length });
    let succeeded = 0;
    const failures: string[] = [];

    for (let index = 0; index < selected.length; index += 1) {
      const file = selected[index];
      try {
        const inferred = inferCrowdSoundMetadata(file.name);
        const safeOriginal = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
        const fileName = `${Date.now()}-${index}-${safeOriginal}`;
        const { error: uploadError } = await supabase.storage
          .from("crowd-sounds")
          .upload(fileName, file, { upsert: false, contentType: file.type || undefined });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("crowd-sounds").getPublicUrl(fileName);
        const duration = await crowdAudioDurationSeconds(urlData.publicUrl);
        const { error: insertError } = await supabase.from("gig_crowd_sounds").insert({
          name: inferred.name,
          description: `Bulk imported from ${file.name}`,
          sound_type: inferred.soundType,
          audio_url: urlData.publicUrl,
          duration_seconds: duration,
          intensity_level: inferred.intensity,
          is_active: true,
        });
        if (insertError) throw insertError;
        succeeded += 1;
      } catch (error) {
        failures.push(`${file.name}: ${error instanceof Error ? error.message : "upload failed"}`);
      } finally {
        setBulkProgress({ done: index + 1, total: selected.length });
      }
    }

    setBulkUploading(false);
    setBulkProgress(null);
    void queryClient.invalidateQueries({ queryKey: ["crowd-sounds"] });
    toast({
      title: failures.length ? "Crowd sound import completed with warnings" : "Crowd sound pack imported",
      description: failures.length
        ? `${succeeded}/${selected.length} imported. ${failures.slice(0, 2).join(" · ")}`
        : `${succeeded} crowd recordings are now active and available to gigs and Top of the Pops.`,
      variant: failures.length && succeeded === 0 ? "destructive" : "default",
    });
  };

  const filteredSounds = sounds?.filter(s => 
    filterType === "all" || s.sound_type === filterType
  );

  const getSoundTypeInfo = (type: string) => {
    return SOUND_TYPES.find(t => t.value === type) || { label: type, icon: Music };
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Crowd Sounds</h1>
          <p className="text-muted-foreground">Manage audio effects for live gigs and Top of the Pops studio audiences</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex">
            <input
              className="sr-only"
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.webm,.m4a"
              multiple
              disabled={bulkUploading}
              onChange={(event) => {
                const files = event.currentTarget.files;
                void handleBulkUpload(files);
                event.currentTarget.value = "";
              }}
            />
            <span className="inline-flex h-10 cursor-pointer items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
              {bulkUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Files className="mr-2 h-4 w-4" />}
              {bulkProgress ? `Importing ${bulkProgress.done}/${bulkProgress.total}` : "Bulk import pack"}
            </span>
          </label>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Sound
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Crowd Sound</DialogTitle>
              <DialogDescription>
                Upload a new audio file for gig experiences
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Stadium Roar"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="When to use this sound"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Sound Type</Label>
                <Select
                  value={formData.sound_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, sound_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOUND_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Intensity Level: {formData.intensity_level}</Label>
                <Slider
                  value={[formData.intensity_level]}
                  onValueChange={([value]) => setFormData(prev => ({ ...prev, intensity_level: value }))}
                  min={1}
                  max={10}
                  step={1}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="audio">Audio File</Label>
                <Input
                  id="audio"
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    audio_file: e.target.files?.[0] || null 
                  }))}
                  required
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label>Active</Label>
              </div>
              
              <DialogFooter>
                <Button type="submit" disabled={isUploading}>
                  {isUploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Sound
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium"><Sparkles className="h-4 w-4" /> Smart bulk import</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Drop a whole crowd pack at once. Filenames such as “pre gig crowd”, “medium crowd clapping”, “small encore”,
              “large gig background” and “end of gig” are automatically mapped to ambience, applause, encore and exit categories with sensible intensity.
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sound Library</CardTitle>
              <CardDescription>{sounds?.length || 0} sounds available · active cheers, applause, crowd singing and ambience are automatically eligible for Top of the Pops</CardDescription>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {SOUND_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredSounds?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Volume2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No crowd sounds yet</p>
              <p className="text-sm">Add your first sound to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Intensity</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSounds?.map((sound) => {
                  const typeInfo = getSoundTypeInfo(sound.sound_type);
                  const TypeIcon = typeInfo.icon;
                  
                  return (
                    <TableRow key={sound.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sound.name}</p>
                          {sound.description && (
                            <p className="text-xs text-muted-foreground">{sound.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TypeIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{typeInfo.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{sound.intensity_level}/10</Badge>
                      </TableCell>
                      <TableCell>
                        {sound.duration_seconds ? `${sound.duration_seconds}s` : '-'}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={sound.is_active}
                          onCheckedChange={(checked) => 
                            toggleActiveMutation.mutate({ id: sound.id, is_active: checked })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePlay(sound)}
                          >
                            {playingId === sound.id ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(sound.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
