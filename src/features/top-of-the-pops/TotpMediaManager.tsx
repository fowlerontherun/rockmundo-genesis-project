import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Film, Loader2, Mic2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  TOTP_MEDIA_BUCKET,
  TOTP_MEDIA_PATHS,
  detectTotpUploadMime,
  totpMediaPublicUrl,
  type TotpPresenterAudioSlot,
} from "./totpMedia";

interface MediaSlot {
  id: string;
  label: string;
  description: string;
  path: string;
  kind: "video" | "audio";
  accept: string;
}

const PRESENTER_SLOTS: Array<{ slot: TotpPresenterAudioSlot; label: string; description: string }> = [
  { slot: "opening", label: "Opening presenter line", description: "A recorded welcome used immediately after the titles." },
  { slot: "chart", label: "Chart rundown line", description: "A short recorded link into the chart rundown." },
  { slot: "act-intro", label: "Act introduction sting", description: "A generic recorded line used before the dynamic artist introduction." },
  { slot: "between", label: "Between acts link", description: "A short studio link used between performances." },
  { slot: "closing", label: "Closing presenter line", description: "A recorded sign-off for the end of the programme." },
];

export function TotpMediaManager({ presenterKey = "alex_rayne" }: { presenterKey?: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  const slots = useMemo<MediaSlot[]>(() => [
    {
      id: "programme-intro",
      label: "Programme intro video",
      description: "The actual opening titles. WebM and MP4 are accepted; the uploader detects a WebM even when its filename incorrectly ends in .mp4.",
      path: TOTP_MEDIA_PATHS.programmeIntro,
      kind: "video",
      accept: "video/webm,video/mp4,.webm,.mp4",
    },
    ...PRESENTER_SLOTS.map(({ slot, label, description }) => ({
      id: `presenter-${slot}`,
      label,
      description,
      path: TOTP_MEDIA_PATHS.presenter(presenterKey, slot),
      kind: "audio" as const,
      accept: "audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4,.mp3,.wav,.ogg,.webm,.m4a",
    })),
  ], [presenterKey]);

  const assets = useQuery({
    queryKey: ["totp", "media-assets", presenterKey],
    queryFn: async () => {
      const [programme, presenter] = await Promise.all([
        supabase.storage.from(TOTP_MEDIA_BUCKET).list("programme", { limit: 100 }),
        supabase.storage.from(TOTP_MEDIA_BUCKET).list(`presenters/${presenterKey}`, { limit: 100 }),
      ]);
      if (programme.error) throw programme.error;
      if (presenter.error) throw presenter.error;
      return new Set([
        ...(programme.data ?? []).map((item) => `programme/${item.name}`),
        ...(presenter.data ?? []).map((item) => `presenters/${presenterKey}/${item.name}`),
      ]);
    },
  });

  const upload = useMutation({
    mutationFn: async ({ slot, file }: { slot: MediaSlot; file: File }) => {
      const contentType = await detectTotpUploadMime(file);
      if (slot.kind === "video" && !contentType.startsWith("video/")) throw new Error("Choose a video file for the programme intro.");
      if (slot.kind === "audio" && !contentType.startsWith("audio/")) throw new Error("Choose an audio file for the presenter line.");
      const { error } = await supabase.storage.from(TOTP_MEDIA_BUCKET).upload(slot.path, file, {
        upsert: true,
        contentType,
        cacheControl: "3600",
      });
      if (error) throw error;
      return slot;
    },
    onMutate: ({ slot }) => setUploading(slot.id),
    onSuccess: (slot) => {
      toast({ title: "TOTP media uploaded", description: `${slot.label} is now available to the programme.` });
      void queryClient.invalidateQueries({ queryKey: ["totp", "media-assets"] });
      setUploading(null);
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(null);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Mic2 className="h-5 w-5" /> Television production media</CardTitle>
        <CardDescription>
          Upload the real opening titles and recorded presenter links. Uploaded presenter audio is preferred; browser speech synthesis remains the fallback for dynamic artist/chart wording.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-2">
        {slots.map((slot) => {
          const exists = assets.data?.has(slot.path) ?? false;
          const url = totpMediaPublicUrl(slot.path);
          return (
            <div key={slot.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    {slot.kind === "video" ? <Film className="h-4 w-4" /> : <Mic2 className="h-4 w-4" />}
                    {slot.label}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{slot.description}</p>
                </div>
                <Badge variant={exists ? "secondary" : "outline"}>
                  {exists ? <><CheckCircle2 className="mr-1 h-3 w-3" /> uploaded</> : "not uploaded"}
                </Badge>
              </div>
              {exists && slot.kind === "audio" ? <audio className="mt-3 h-8 w-full" controls preload="none" src={url} /> : null}
              {exists && slot.kind === "video" ? <video className="mt-3 aspect-video w-full rounded bg-black object-contain" controls preload="metadata" src={url} /> : null}
              <input
                ref={(node) => { refs.current[slot.id] = node; }}
                className="hidden"
                type="file"
                accept={slot.accept}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) upload.mutate({ slot, file });
                  event.currentTarget.value = "";
                }}
              />
              <Button
                className="mt-3"
                size="sm"
                variant="outline"
                disabled={uploading === slot.id}
                onClick={() => refs.current[slot.id]?.click()}
              >
                {uploading === slot.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {exists ? "Replace" : "Upload"}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
