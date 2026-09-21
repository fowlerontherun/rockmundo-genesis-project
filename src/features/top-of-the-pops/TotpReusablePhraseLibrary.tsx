import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, Mic2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { detectTotpUploadMime, TOTP_MEDIA_BUCKET, TOTP_MEDIA_PATHS, totpMediaPublicUrl } from "./totpMedia";
import { TOTP_REUSABLE_PRESENTER_PHRASES } from "./presenterPhraseAudio";
import { totpAudioFileExtension, totpAudioSha256 } from "./audioAsset";

const ACCEPTED_AUDIO = "audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4,.mp3,.wav,.ogg,.webm,.m4a";
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

async function validateAudio(file: File) {
  if (file.size <= 0) throw new Error("The selected recording is empty.");
  if (file.size > MAX_AUDIO_BYTES) throw new Error("Recordings must be 25 MB or smaller.");
  const mime = await detectTotpUploadMime(file);
  if (!mime.startsWith("audio/")) throw new Error("Choose an audio recording.");
  const sha256 = await totpAudioSha256(file);
  return { mime, sha256 };
}

export function TotpReusablePhraseLibrary({ presenterKey }: { presenterKey: string }) {
  const { toast } = useToast();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const requestIdRef = useRef(0);
  const [assets, setAssets] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const folder = TOTP_MEDIA_PATHS.reusablePhraseFolder(presenterKey);
    void supabase.storage.from(TOTP_MEDIA_BUCKET).list(folder, { limit: 300 }).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        toast({ title: "Could not load reusable presenter phrases", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      const newest = new Map<string, { path: string; createdAt: number }>();
      for (const item of data ?? []) {
        const match = /^([a-z0-9-]+)-([a-f0-9]{8,64})\.(mp3|wav|ogg|webm|m4a|mp4)$/i.exec(item.name);
        if (!match) continue;
        const id = match[1];
        const createdAt = Date.parse(item.created_at ?? item.updated_at ?? "") || 0;
        const current = newest.get(id);
        if (!current || createdAt >= current.createdAt) {
          newest.set(id, { path: `${folder}/${item.name}`, createdAt });
        }
      }
      setAssets(new Map([...newest.entries()].map(([id, value]) => [id, value.path])));
      setLoading(false);
    });
    return () => { active = false; };
  }, [presenterKey, refreshKey, toast]);

  useEffect(() => () => {
    requestIdRef.current += 1;
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const recordedCount = assets.size;
  const grouped = useMemo(() => {
    const order = ["general", "new_entry", "climber", "returning", "top_ten", "number_one", "continuity"] as const;
    return order.map((category) => ({
      category,
      phrases: TOTP_REUSABLE_PRESENTER_PHRASES.filter((phrase) => phrase.category === category),
    })).filter((group) => group.phrases.length > 0);
  }, []);

  async function savePhrase(id: string, file: File) {
    setUploadingId(id);
    try {
      const { mime, sha256 } = await validateAudio(file);
      const extension = totpAudioFileExtension(mime);
      const path = TOTP_MEDIA_PATHS.reusablePhrase(presenterKey, id, sha256.slice(0, 16), extension);
      const { error } = await supabase.storage.from(TOTP_MEDIA_BUCKET).upload(path, file, {
        contentType: mime,
        cacheControl: "31536000",
        upsert: false,
      });
      if (error && !/already exists/i.test(error.message)) throw new Error(error.message);
      toast({ title: "Presenter phrase saved", description: "The reusable take is ready for future shows." });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      toast({ title: "Could not save presenter phrase", description: error instanceof Error ? error.message : "Upload failed.", variant: "destructive" });
    } finally {
      setUploadingId(null);
    }
  }

  async function startRecording(id: string) {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast({ title: "Microphone recording unavailable", description: "Upload an audio file instead.", variant: "destructive" });
      return;
    }
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (requestId !== requestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecordingId(null);
        if (requestId !== requestIdRef.current) return;
        if (blob.size > 0) {
          const extension = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
          const file = new File([blob], `${id}.${extension}`, { type });
          void savePhrase(id, file);
        }
      };
      recorder.start();
      setRecordingId(id);
    } catch (error) {
      toast({ title: "Could not start microphone", description: error instanceof Error ? error.message : "Microphone permission was not granted.", variant: "destructive" });
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  const categoryLabels: Record<string, string> = {
    general: "General introductions",
    new_entry: "New entries & debuts",
    climber: "Chart climbers",
    returning: "Returning acts",
    top_ten: "Top Ten",
    number_one: "Number one",
    continuity: "Crowd & continuity",
  };

  return (
    <Card id="totp-presenter-phrase-library">
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Reusable Presenter Phrase Library</CardTitle>
            <CardDescription className="mt-1 max-w-3xl">
              Record these splice-safe phrases once per presenter. Each phrase ends immediately before the recorded band name,
              so song titles can remain visual-only on screen.
            </CardDescription>
          </div>
          <Badge variant={recordedCount === TOTP_REUSABLE_PRESENTER_PHRASES.length ? "secondary" : "outline"}>
            {recordedCount}/{TOTP_REUSABLE_PRESENTER_PHRASES.length} recorded
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading phrase recordings…</div>}
        {!loading && grouped.map((group) => (
          <section key={group.category} className="space-y-2">
            <h3 className="text-sm font-semibold">{categoryLabels[group.category]}</h3>
            <div className="grid gap-2 lg:grid-cols-2">
              {group.phrases.map((phrase) => {
                const path = assets.get(phrase.id);
                const isRecording = recordingId === phrase.id;
                const isBusy = uploadingId === phrase.id;
                return (
                  <div key={phrase.id} className="rounded-lg border bg-muted/10 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{phrase.label}</span>
                          {path ? (
                            <Badge variant="secondary"><CheckCircle2 className="mr-1 h-3 w-3" /> recorded</Badge>
                          ) : <Badge variant="outline">missing</Badge>}
                        </div>
                        <p className="mt-1 text-sm font-medium">“{phrase.script} [BAND NAME]”</p>
                        <p className="mt-1 text-xs text-muted-foreground">{phrase.usage}</p>
                      </div>
                    </div>
                    {path && <audio className="mt-3 w-full" controls preload="none" src={totpMediaPublicUrl(path)} />}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={isRecording ? "destructive" : "outline"}
                        disabled={isBusy || (!!recordingId && !isRecording)}
                        onClick={() => isRecording ? stopRecording() : void startRecording(phrase.id)}
                      >
                        <Mic2 className="mr-1 h-4 w-4" /> {isRecording ? "Stop & save" : "Record"}
                      </Button>
                      <label className="inline-flex">
                        <input
                          className="sr-only"
                          type="file"
                          accept={ACCEPTED_AUDIO}
                          disabled={isBusy || !!recordingId}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.currentTarget.value = "";
                            if (file) void savePhrase(phrase.id, file);
                          }}
                        />
                        <span className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                          {isBusy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                          {path ? "Replace" : "Upload"}
                        </span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
