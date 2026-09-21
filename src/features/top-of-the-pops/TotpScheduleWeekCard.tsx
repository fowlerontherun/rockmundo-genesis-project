import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarPlus, CheckCircle2, ClipboardList, Pencil, Tv2, XCircle } from "lucide-react";
import { resolveTotpPresenter, totpVariantLabel } from "./presenters";
import { totpEpisodeIsEditable, totpStatusLabel, type TotpScheduleEpisode } from "./scheduleApi";
import type { TotpScheduleWeek } from "./scheduleWeeks";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" })
    .format(new Date(`${iso.slice(0, 10)}T12:00:00Z`));
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeStyle: "short", timeZone: "Europe/London" }).format(new Date(iso));
}

function formatRange(week: TotpScheduleWeek) {
  return `${formatDate(week.weekStart)} – ${formatDate(week.weekEnd)}`;
}

export function TotpScheduleWeekCard({
  week,
  onAdd,
  onEdit,
  onPlan,
  onCancel,
}: {
  week: TotpScheduleWeek;
  onAdd: (weekStart: string) => void;
  onEdit: (episode: TotpScheduleEpisode) => void;
  onPlan: (episode: TotpScheduleEpisode) => void;
  onCancel: (episode: TotpScheduleEpisode) => void;
}) {
  return (
    <Card data-totp-week={week.weekStart}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2"><Tv2 className="h-4 w-4" /> {formatRange(week)}</span>
          {week.episodes.length === 0 && (
            <Button size="sm" variant="outline" data-totp-week-add onClick={() => onAdd(week.weekStart)}>
              <CalendarPlus className="mr-1 h-4 w-4" /> Add episode
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {week.episodes.length === 0 ? (
          <p className="text-xs text-muted-foreground">No episode planned for this week.</p>
        ) : (
          week.episodes.map((episode) => {
            const presenter = resolveTotpPresenter(episode.presenter_key);
            const variant = totpVariantLabel(episode.show_variant);
            const editable = totpEpisodeIsEditable(episode.status);
            return (
              <div key={episode.id} className="space-y-1 rounded-md border p-3" data-totp-episode={episode.id}>
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <span>Episode #{episode.episode_number}</span>
                  <span className="text-muted-foreground">
                    {formatDate(episode.episode_date)} · {formatTime(episode.broadcast_at)}
                  </span>
                  <Badge variant={episode.status === "cancelled" ? "destructive" : "secondary"}>
                    {totpStatusLabel(episode.status)}
                  </Badge>
                  {variant && <Badge variant="outline">{variant}</Badge>}
                  {episode.has_plan && (
                    <Badge variant="outline" className="gap-1">
                      <ClipboardList className="h-3 w-3" /> Plan saved
                    </Badge>
                  )}
                  {episode.has_manifest && (
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Running sheet saved
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {presenter.displayName} · {episode.city_name ?? "City to confirm"} · {episode.performance_count}/
                  {episode.max_performances} acts booked · {episode.checked_in_count} checked in
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" data-totp-episode-plan onClick={() => onPlan(episode)}>
                    <ClipboardList className="mr-1 h-4 w-4" /> Running sheet notes
                  </Button>
                  {editable && (
                    <Button size="sm" variant="outline" data-totp-episode-edit onClick={() => onEdit(episode)}>
                      <Pencil className="mr-1 h-4 w-4" /> Reschedule / edit
                    </Button>
                  )}
                  {editable && episode.status !== "cancelled" && (
                    <Button size="sm" variant="ghost" data-totp-episode-cancel onClick={() => onCancel(episode)}>
                      <XCircle className="mr-1 h-4 w-4" /> Cancel
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
