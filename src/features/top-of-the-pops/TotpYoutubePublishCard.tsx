import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Loader2, Sparkles, Trash2, Youtube } from "lucide-react";
import type { TotpEpisode } from "./api";
import { resolveTotpPresenter } from "./presenters";
import { getStoredTotpEpisodeManifest } from "./episodeManifestApi";
import {
  deleteTotpYoutubePublication,
  getTotpYoutubePublications,
  publishTotpEpisodeToYoutube,
  saveTotpYoutubePublication,
  suggestTotpYoutubeListing,
  totpYoutubeStateLabel,
  type TotpYoutubePrivacy,
  type TotpYoutubePublication,
} from "./youtubePublishApi";

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatWhen(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" })
    .format(new Date(value));
}

function stateTone(state: TotpYoutubePublication["state"]) {
  switch (state) {
    case "published":
      return "border-emerald-500/40 text-emerald-500";
    case "scheduled":
      return "border-sky-500/40 text-sky-500";
    case "failed":
      return "border-destructive/50 text-destructive";
    case "uploading":
      return "border-amber-500/40 text-amber-500";
    default:
      return "";
  }
}

export function TotpYoutubePublishCard({ episode }: { episode: TotpEpisode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const publications = useQuery({
    queryKey: ["totp", "youtube", episode.id],
    queryFn: () => getTotpYoutubePublications(episode.id, 10),
  });
  const stored = useQuery({
    queryKey: ["totp", "running-sheet", "stored", episode.id],
    queryFn: () => getStoredTotpEpisodeManifest(episode.id),
  });

  const latest = publications.data?.[0] ?? null;
  const editable = !latest || latest.state === "draft" || latest.state === "failed";

  const suggestion = useMemo(() => {
    const presenter = resolveTotpPresenter(episode.presenter_key);
    return suggestTotpYoutubeListing({
      episodeNumber: episode.episode_number,
      episodeDate: episode.episode_date,
      presenterName: episode.presenter_display_name ?? presenter?.displayName ?? null,
      acts: [...(episode.performances ?? [])]
        .sort((a, b) => a.running_order - b.running_order)
        .map((act) => ({ artist: act.band_name, song: act.song_title })),
    });
  }, [episode]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [privacy, setPrivacy] = useState<TotpYoutubePrivacy>("private");
  const [publishAt, setPublishAt] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  useEffect(() => {
    if (latest && editable) {
      setTitle(latest.title);
      setDescription(latest.description);
      setTags(latest.tags.join(", "));
      setPrivacy(latest.privacy_status);
      setPublishAt(toLocalInput(latest.publish_at));
      setSourceUrl(latest.source_url ?? "");
      return;
    }
    if (!latest) {
      setTitle(suggestion.title);
      setDescription(suggestion.description);
      setTags(suggestion.tags.join(", "));
      setPrivacy("private");
      setPublishAt(toLocalInput(episode.broadcast_at));
      setSourceUrl("");
    }
  }, [latest, editable, suggestion, episode.broadcast_at]);

  const save = useMutation({
    mutationFn: () =>
      saveTotpYoutubePublication({
        id: latest && editable ? latest.id : null,
        episodeId: episode.id,
        title,
        description,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        privacyStatus: privacy,
        publishAt: publishAt ? new Date(publishAt).toISOString() : null,
        sourceUrl: sourceUrl || null,
        manifestChecksum: stored.data?.manifest?.checksum ?? null,
      }),
    onSuccess: () => {
      toast({ title: "Upload details saved" });
      void queryClient.invalidateQueries({ queryKey: ["totp", "youtube", episode.id] });
    },
    onError: (error: Error) => toast({ title: "Could not save", description: error.message, variant: "destructive" }),
  });

  const publish = useMutation({
    mutationFn: (id: string) => publishTotpEpisodeToYoutube(id),
    onSuccess: (result) => {
      toast({
        title: result.scheduled ? "Premiere scheduled on YouTube" : "Episode published to YouTube",
        description: result.watchUrl ?? undefined,
      });
      void queryClient.invalidateQueries({ queryKey: ["totp", "youtube", episode.id] });
      void queryClient.invalidateQueries({ queryKey: ["totp", "production-audit", episode.id] });
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      void queryClient.invalidateQueries({ queryKey: ["totp", "youtube", episode.id] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTotpYoutubePublication(id),
    onSuccess: () => {
      toast({ title: "Planned upload removed" });
      void queryClient.invalidateQueries({ queryKey: ["totp", "youtube", episode.id] });
    },
    onError: (error: Error) => toast({ title: "Could not remove", description: error.message, variant: "destructive" }),
  });

  const busy = publish.isPending || latest?.state === "uploading";

  return (
    <Card data-totp-youtube-card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Youtube className="h-4 w-4" /> YouTube publishing
            </CardTitle>
            <CardDescription>
              Send the finished episode to the channel, either straight away or as a scheduled premiere.
            </CardDescription>
          </div>
          {latest ? (
            <Badge variant="outline" className={stateTone(latest.state)} data-totp-youtube-state>
              {totpYoutubeStateLabel(latest.state)}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="text-xs">Video title</Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} disabled={!editable} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              disabled={!editable}
            />
          </div>
          <div>
            <Label className="text-xs">Tags (comma separated)</Label>
            <Input value={tags} onChange={(event) => setTags(event.target.value)} disabled={!editable} />
          </div>
          <div>
            <Label className="text-xs">Visibility</Label>
            <Select value={privacy} onValueChange={(value) => setPrivacy(value as TotpYoutubePrivacy)} disabled={!editable}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="unlisted">Unlisted</SelectItem>
                <SelectItem value="public">Public</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Premiere time (leave blank to publish now)</Label>
            <Input
              type="datetime-local"
              value={publishAt}
              onChange={(event) => setPublishAt(event.target.value)}
              disabled={!editable}
            />
          </div>
          <div>
            <Label className="text-xs">Finished video link (Google Drive or direct link)</Label>
            <Input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://drive.google.com/file/d/…"
              disabled={!editable}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => save.mutate()} disabled={!editable || save.isPending || !title.trim()}>
            {save.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            {latest && editable ? "Save changes" : "Save upload details"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            data-totp-youtube-publish
            onClick={() => latest && publish.mutate(latest.id)}
            disabled={!latest || !editable || !latest.source_url || busy}
          >
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
            {publishAt ? "Schedule premiere" : "Publish now"}
          </Button>
          {latest?.watch_url ? (
            <Button size="sm" variant="outline" asChild>
              <a href={latest.watch_url} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1 h-4 w-4" /> Open on YouTube
              </a>
            </Button>
          ) : null}
          {latest && editable ? (
            <Button size="sm" variant="ghost" onClick={() => remove.mutate(latest.id)} disabled={remove.isPending}>
              <Trash2 className="mr-1 h-4 w-4" /> Remove
            </Button>
          ) : null}
        </div>

        {latest && !latest.source_url ? (
          <p className="text-xs text-muted-foreground">
            Export the episode video first, then paste its link above so it can be uploaded.
          </p>
        ) : null}
        {latest?.error_message ? (
          <p className="text-xs text-destructive" data-totp-youtube-error>{latest.error_message}</p>
        ) : null}

        {(publications.data ?? []).length ? (
          <>
            <Separator />
            <ul className="space-y-1.5">
              {(publications.data ?? []).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-xs">
                  <span className="min-w-0 truncate">{item.title}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {totpYoutubeStateLabel(item.state)}
                    {item.publish_at ? ` · ${formatWhen(item.publish_at)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
