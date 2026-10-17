import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Disc3, Upload, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { DJ_AUDIO_BUCKET, DJ_FILE_SIZE_LIMIT, type AdminDjTrack } from "@/features/nightclub-dj/library";

type Row = AdminDjTrack & { rights_notes: string | null; created_at: string };
type UploadFields = { title: string; artist: string; genre: string; bpm: string; musicalKey: string; notes: string; cleared: boolean };
const initialFields: UploadFields = { title: "", artist: "", genre: "Electronic", bpm: "", musicalKey: "", notes: "", cleared: false };
const allowedExtensions: Record<string, string> = {
  mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg",
  wav: "audio/wav", webm: "audio/webm",
};

function validateAudioFile(file: File): { ext: string; mime: string } {
  if (file.size === 0 || file.size > DJ_FILE_SIZE_LIMIT) throw new Error("Audio must be between 1 byte and 50 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = allowedExtensions[ext];
  if (!mime) throw new Error("Upload MP3, M4A, OGG, WAV or WebM audio.");
  if (file.type && !file.type.startsWith("audio/") && file.type !== "application/ogg") throw new Error("Only audio files are supported.");
  return { ext, mime };
}

async function readAudioDuration(file: File): Promise<number | null> {
  const url = URL.createObjectURL(file);
  const audio = new Audio();
  try {
    return await new Promise<number | null>((resolve) => {
      let done = false;
      const finish = (value: number | null) => {
        if (done) return;
        done = true;
        audio.onloadedmetadata = null;
        audio.onerror = null;
        resolve(value);
      };
      audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) && audio.duration > 0 ? Math.round(audio.duration) : null);
      audio.onerror = () => finish(null);
      audio.src = url;
      audio.load();
      window.setTimeout(() => finish(null), 8000);
    });
  } finally {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    URL.revokeObjectURL(url);
  }
}

export default function DjAudioLibraryAdmin() {
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<UploadFields>(initialFields);
  const [file, setFile] = useState<File | null>(null);
  const { data: tracks = [], isLoading, error: queryError } = useQuery({
    queryKey: ["admin-dj-audio-tracks"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await (supabase as any).from("dj_audio_tracks")
        .select("id,title,artist,genre,bpm,musical_key,duration_seconds,storage_path,rights_confirmed,rights_notes,is_active,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Select an audio file.");
      if (!fields.cleared || !fields.notes.trim()) throw new Error("Confirm usage rights and record the rights source.");
      if (!fields.title.trim() || !fields.artist.trim() || !fields.genre.trim()) throw new Error("Title, artist and genre are required.");
      const { ext, mime } = validateAudioFile(file);
      const bpm = fields.bpm.trim() ? Number(fields.bpm) : null;
      if (bpm !== null && (!Number.isInteger(bpm) || bpm < 40 || bpm > 240)) throw new Error("BPM must be between 40 and 240.");
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Admin sign-in required.");
      const id = crypto.randomUUID();
      const path = `catalog/${id}/track.${ext}`;
      const duration = await readAudioDuration(file);
      const { error: fileError } = await supabase.storage.from(DJ_AUDIO_BUCKET)
        .upload(path, file, { upsert: false, contentType: mime });
      if (fileError) throw fileError;
      const { error: dbError } = await (supabase as any).from("dj_audio_tracks").insert({
        id, title: fields.title.trim(), artist: fields.artist.trim(),
        genre: fields.genre.trim(), bpm, musical_key: fields.musicalKey.trim() || null,
        duration_seconds: duration, storage_path: path,
        rights_confirmed: true, rights_notes: fields.notes.trim(),
        uploaded_by: user.id, is_active: true,
      });
      if (dbError) {
        await supabase.storage.from(DJ_AUDIO_BUCKET).remove([path]);
        throw dbError;
      }
    },
    onSuccess: async () => {
      toast.success("DJ track uploaded and published.");
      setFields(initialFields);
      setFile(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-dj-audio-tracks"] });
      await queryClient.invalidateQueries({ queryKey: ["dj-track-library"] });
    },
    onError: (reason) => toast.error(reason instanceof Error ? reason.message : "Upload failed"),
  });

  const changeAvailability = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { data, error } = await (supabase as any).from("dj_audio_tracks")
        .update({ is_active: active, updated_at: new Date().toISOString() })
        .eq("id", id).select("id").single();
      if (error || !data) throw error || new Error("No track updated");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-dj-audio-tracks"] });
      await queryClient.invalidateQueries({ queryKey: ["dj-track-library"] });
    },
    onError: (reason) => toast.error(reason instanceof Error ? reason.message : "Cannot update track"),
  });

  const setField = <K extends keyof UploadFields>(key: K, value: UploadFields[K]) =>
    setFields((current) => ({ ...current, [key]: value }));

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <header className="flex items-center gap-3">
        <Disc3 className="h-8 w-8 text-primary" />
        <div><h1 className="text-2xl font-semibold">DJ Club Audio Library</h1>
          <p className="text-sm text-muted-foreground">Upload cleared audio for DJs to play and mix in nightclubs.</p></div>
      </header>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Upload a new club track</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="dj-title">Title</Label><Input id="dj-title" maxLength={200} value={fields.title} onChange={(e) => setField("title", e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="dj-artist">Artist</Label><Input id="dj-artist" maxLength={200} value={fields.artist} onChange={(e) => setField("artist", e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="dj-genre">Genre</Label><Input id="dj-genre" maxLength={100} value={fields.genre} onChange={(e) => setField("genre", e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="dj-bpm">BPM (optional, 40–240)</Label><Input id="dj-bpm" type="number" min={40} max={240} value={fields.bpm} onChange={(e) => setField("bpm", e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="dj-key">Musical key (optional)</Label><Input id="dj-key" maxLength={12} placeholder="e.g. Am" value={fields.musicalKey} onChange={(e) => setField("musicalKey", e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="dj-file">Audio (MP3, M4A, OGG, WAV, WebM · 50 MB max)</Label><Input id="dj-file" type="file" accept=".mp3,.m4a,.ogg,.wav,.webm,audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="dj-rights-notes">Rights / licence source (required)</Label>
            <Input id="dj-rights-notes" placeholder="e.g. internally produced, licensed for in-game streaming" maxLength={500}
              value={fields.notes} onChange={(e) => setField("notes", e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <Switch id="dj-cleared" checked={fields.cleared} onCheckedChange={(value) => setField("cleared", value)} />
            <Label htmlFor="dj-cleared">I confirm RockMundo is permitted to stream and mix this audio in the game</Label>
          </div>
          <Button disabled={upload.isPending || !file || !fields.cleared || !fields.notes.trim()} onClick={() => upload.mutate()}>
            {upload.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Upload and publish
          </Button>
          <p className="text-xs text-muted-foreground">Private storage. Only published, rights-cleared tracks appear in player mixers. Access is enforced by database and storage policies.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Uploaded tracks ({tracks.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading tracks...</p>}
          {queryError && <p className="text-sm text-destructive" role="alert">Unable to load catalogue. Check deployment and admin permissions.</p>}
          {!isLoading && !queryError && tracks.length === 0 && <p className="text-sm text-muted-foreground">No DJ audio has been uploaded.</p>}
          {tracks.map((track) => (
            <div key={track.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="font-medium">{track.title} · {track.artist}</p>
                <p className="text-xs text-muted-foreground">{track.genre} · {track.bpm ?? "?"} BPM · {track.musical_key ?? "Key unknown"}</p>
                <p className="text-xs text-muted-foreground">{track.rights_notes}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={track.is_active ? "default" : "secondary"}>{track.is_active ? "Published" : "Hidden"}</Badge>
                <Switch aria-label={`Publish ${track.title}`} checked={track.is_active}
                  disabled={changeAvailability.isPending || !track.rights_confirmed}
                  onCheckedChange={(active) => changeAvailability.mutate({ id: track.id, active })} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
