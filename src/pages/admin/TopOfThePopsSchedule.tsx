import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, CalendarDays, RefreshCw, Tv2 } from "lucide-react";
import { TOTP_PRESENTERS } from "@/features/top-of-the-pops/presenters";
import { TotpScheduleWeekCard } from "@/features/top-of-the-pops/TotpScheduleWeekCard";
import { TotpEpisodePlanEditor } from "@/features/top-of-the-pops/TotpEpisodePlanEditor";
import {
  cancelTotpEpisode,
  getTotpCityOptions,
  getTotpSchedule,
  saveTotpEpisodeDraft,
  totpEpisodeIsEditable,
  type TotpScheduleEpisode,
} from "@/features/top-of-the-pops/scheduleApi";
import {
  addDaysIso,
  buildTotpScheduleWeeks,
  mondayOfIso,
  todayIso,
} from "@/features/top-of-the-pops/scheduleWeeks";

const SHOW_VARIANTS = [
  { value: "regular", label: "Regular show" },
  { value: "guest_host", label: "Guest host edition" },
  { value: "milestone", label: "Milestone edition" },
  { value: "christmas", label: "Christmas special" },
  { value: "anniversary", label: "Anniversary special" },
];

interface EpisodeForm {
  episodeId: string | null;
  episodeDate: string;
  broadcastTime: string;
  checkInTime: string;
  chartSnapshotDate: string;
  cityId: string;
  presenterKey: string;
  showVariant: string;
  maxPerformances: number;
}

function localIsoToTimestamp(dateIso: string, time: string): string {
  return new Date(`${dateIso}T${time || "19:30"}:00`).toISOString();
}

function timeOfDay(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function TopOfThePopsSchedule() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [anchor, setAnchor] = useState(() => mondayOfIso(todayIso()));
  const [weeks, setWeeks] = useState(8);
  const [form, setForm] = useState<EpisodeForm | null>(null);
  const [planEpisode, setPlanEpisode] = useState<TotpScheduleEpisode | null>(null);

  const schedule = useQuery({
    queryKey: ["totp", "schedule", anchor, weeks],
    queryFn: () => getTotpSchedule(anchor, weeks),
  });
  const cities = useQuery({ queryKey: ["totp", "schedule", "cities"], queryFn: getTotpCityOptions });

  const weekList = useMemo(
    () => buildTotpScheduleWeeks(anchor, weeks, schedule.data?.episodes ?? []),
    [anchor, weeks, schedule.data],
  );

  const saveEpisode = useMutation({
    mutationFn: async (draft: EpisodeForm) =>
      saveTotpEpisodeDraft({
        episodeId: draft.episodeId,
        episodeDate: draft.episodeDate,
        broadcastAt: localIsoToTimestamp(draft.episodeDate, draft.broadcastTime),
        checkInAt: localIsoToTimestamp(draft.episodeDate, draft.checkInTime),
        chartSnapshotDate: draft.chartSnapshotDate || null,
        cityId: draft.cityId || null,
        presenterKey: draft.presenterKey,
        showVariant: draft.showVariant,
        maxPerformances: draft.maxPerformances,
      }),
    onSuccess: () => {
      toast({ title: "Schedule updated", description: "The episode is saved in the broadcast schedule." });
      setForm(null);
      void queryClient.invalidateQueries({ queryKey: ["totp", "schedule"] });
    },
    onError: (error: Error) =>
      toast({ title: "Could not save the episode", description: error.message, variant: "destructive" }),
  });

  const cancelEpisode = useMutation({
    mutationFn: (episodeId: string) => cancelTotpEpisode(episodeId),
    onSuccess: () => {
      toast({ title: "Episode cancelled", description: "The slot stays in the schedule marked as cancelled." });
      void queryClient.invalidateQueries({ queryKey: ["totp", "schedule"] });
    },
    onError: (error: Error) =>
      toast({ title: "Could not cancel the episode", description: error.message, variant: "destructive" }),
  });

  function openAdd(weekStart: string) {
    const airDate = addDaysIso(weekStart, 3);
    setForm({
      episodeId: null,
      episodeDate: airDate,
      broadcastTime: "19:30",
      checkInTime: "18:00",
      chartSnapshotDate: addDaysIso(airDate, -1),
      cityId: cities.data?.[0]?.id ?? "",
      presenterKey: "alex_rayne",
      showVariant: "regular",
      maxPerformances: 10,
    });
  }

  function openEdit(episode: TotpScheduleEpisode) {
    setForm({
      episodeId: episode.id,
      episodeDate: episode.episode_date.slice(0, 10),
      broadcastTime: timeOfDay(episode.broadcast_at),
      checkInTime: timeOfDay(episode.check_in_at),
      chartSnapshotDate: episode.chart_snapshot_date.slice(0, 10),
      cityId: episode.city_id ?? "",
      presenterKey: episode.presenter_key,
      showVariant: episode.show_variant,
      maxPerformances: episode.max_performances,
    });
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <CalendarDays className="h-6 w-6" /> Broadcast schedule
          </h1>
          <p className="text-sm text-muted-foreground">
            Plan Top of the Pops weeks ahead: air nights, presenters and the running sheet notes for each show.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/top-of-the-pops"><Tv2 className="mr-1 h-4 w-4" /> Show controls</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Schedule window</CardTitle>
          <CardDescription>
            {schedule.data ? `${schedule.data.episodes.length} episode(s) between ${schedule.data.week_start} and ${schedule.data.week_end}` : "Loading…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" data-totp-schedule-prev onClick={() => setAnchor(addDaysIso(anchor, -7 * weeks))}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Earlier
          </Button>
          <Button size="sm" variant="outline" data-totp-schedule-today onClick={() => setAnchor(mondayOfIso(todayIso()))}>
            This week
          </Button>
          <Button size="sm" variant="outline" data-totp-schedule-next onClick={() => setAnchor(addDaysIso(anchor, 7 * weeks))}>
            Later <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
          <Select value={String(weeks)} onValueChange={(value) => setWeeks(Number(value))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="4">4 weeks</SelectItem>
              <SelectItem value="8">8 weeks</SelectItem>
              <SelectItem value="12">12 weeks</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={() => void schedule.refetch()}>
            <RefreshCw className="mr-1 h-4 w-4" /> Refresh
          </Button>
        </CardContent>
      </Card>

      {schedule.isError && (
        <Card><CardContent className="p-4 text-sm text-destructive">{(schedule.error as Error).message}</CardContent></Card>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {weekList.map((week) => (
          <TotpScheduleWeekCard
            key={week.weekStart}
            week={week}
            onAdd={openAdd}
            onEdit={openEdit}
            onPlan={setPlanEpisode}
            onCancel={(episode) => cancelEpisode.mutate(episode.id)}
          />
        ))}
      </div>

      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.episodeId ? "Edit episode" : "Plan a new episode"}</DialogTitle>
            <DialogDescription>Set the air night, host city and presenter for this show.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="episode-date">Air date</Label>
                <Input
                  id="episode-date"
                  type="date"
                  value={form.episodeDate}
                  onChange={(event) => setForm({ ...form, episodeDate: event.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="chart-date">Chart week</Label>
                <Input
                  id="chart-date"
                  type="date"
                  value={form.chartSnapshotDate}
                  onChange={(event) => setForm({ ...form, chartSnapshotDate: event.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="broadcast-time">On air time</Label>
                <Input
                  id="broadcast-time"
                  type="time"
                  value={form.broadcastTime}
                  onChange={(event) => setForm({ ...form, broadcastTime: event.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="checkin-time">Act check-in time</Label>
                <Input
                  id="checkin-time"
                  type="time"
                  value={form.checkInTime}
                  onChange={(event) => setForm({ ...form, checkInTime: event.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Host city</Label>
                <Select value={form.cityId} onValueChange={(value) => setForm({ ...form, cityId: value })}>
                  <SelectTrigger><SelectValue placeholder="Choose a city" /></SelectTrigger>
                  <SelectContent>
                    {(cities.data ?? []).map((city) => (
                      <SelectItem key={city.id} value={city.id}>{city.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Presenter</Label>
                <Select value={form.presenterKey} onValueChange={(value) => setForm({ ...form, presenterKey: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(TOTP_PRESENTERS).map((presenter) => (
                      <SelectItem key={presenter.key} value={presenter.key}>{presenter.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Show type</Label>
                <Select value={form.showVariant} onValueChange={(value) => setForm({ ...form, showVariant: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SHOW_VARIANTS.map((variant) => (
                      <SelectItem key={variant.value} value={variant.value}>{variant.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="max-acts">Maximum acts</Label>
                <Input
                  id="max-acts"
                  type="number"
                  min={1}
                  max={20}
                  value={form.maxPerformances}
                  onChange={(event) => setForm({ ...form, maxPerformances: Number(event.target.value) || 1 })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
            <Button
              data-totp-schedule-save
              disabled={saveEpisode.isPending || !form?.episodeDate}
              onClick={() => form && saveEpisode.mutate(form)}
            >
              {saveEpisode.isPending ? "Saving…" : "Save episode"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!planEpisode} onOpenChange={(open) => !open && setPlanEpisode(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Running sheet notes</DialogTitle>
            <DialogDescription>
              {planEpisode ? `Episode #${planEpisode.episode_number} · ${planEpisode.episode_date.slice(0, 10)}` : ""}
            </DialogDescription>
          </DialogHeader>
          {planEpisode && (
            <TotpEpisodePlanEditor
              episodeId={planEpisode.id}
              readOnly={!totpEpisodeIsEditable(planEpisode.status)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
