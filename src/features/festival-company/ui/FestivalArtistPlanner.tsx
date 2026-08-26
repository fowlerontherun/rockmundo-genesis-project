import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Music2, WandSparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useFestivalArtistProgramme,
  useSaveFestivalArtistProgramme,
} from "../application/useFestivalArtistProgramme";
import type {
  FestivalApplicationWindow,
  FestivalArtistProgramme,
} from "../domain/festivalArtistProgramme";
import {
  formatMinorMoney,
  parseMoneyToMinor,
} from "../domain/festivalTicketPlan";

const lineupModes = [
  {
    value: "hybrid",
    label: "Applications and invitations",
    description: "Let bands apply while you also approach preferred acts.",
  },
  {
    value: "applications_only",
    label: "Applications",
    description: "Build the line-up mainly from bands that apply.",
  },
  {
    value: "invite_only",
    label: "Invitations",
    description: "Approach acts directly and keep applications closed.",
  },
  {
    value: "closed",
    label: "Curated with automatic fallback",
    description: "Use confirmed choices and let the game fill remaining spaces.",
  },
] as const;

type LineupMode = (typeof lineupModes)[number]["value"];

type LineupDraft = {
  applicationMode: LineupMode;
  artistBudgetMinor: number;
  minimumArtistFame: number | null;
  preferredGenres: string;
};

const toGenreList = (value: string) =>
  Array.from(
    new Set(
      value
        .split(",")
        .map((genre) => genre.trim())
        .filter(Boolean),
    ),
  );

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

function defaultWindow(
  festivalDates: string[],
  minimumArtistFame: number | null,
  preferredGenres: string[],
): FestivalApplicationWindow {
  const festivalStart = new Date(`${festivalDates[0]}T12:00:00.000Z`);
  const closesAt = addDays(festivalStart, -30);
  const opensAt = addDays(closesAt, -90);

  return {
    id: null,
    name: "General Festival applications",
    opensAt: opensAt.toISOString(),
    closesAt: closesAt.toISOString(),
    eligibleArtistType: "player_only",
    minimumFame: minimumArtistFame,
    maximumFame: null,
    preferredGenres,
    minimumBandMembers: null,
    maximumBandMembers: null,
    targetStageTypes: [],
    maximumSetMinutes: 60,
    active: true,
  };
}

export function FestivalArtistPlanner({
  festivalCompanyId,
  festivalEditionId,
}: {
  festivalCompanyId: string;
  festivalEditionId?: string;
}) {
  const query = useFestivalArtistProgramme(
    festivalCompanyId,
    festivalEditionId,
  );
  const save = useSaveFestivalArtistProgramme();
  const [draft, setDraft] = useState<LineupDraft | null>(null);

  useEffect(() => {
    if (!query.data) return;
    const programme = query.data.programme;
    setDraft({
      applicationMode: programme?.applicationMode ?? "hybrid",
      artistBudgetMinor: programme?.artistBudgetMinor ?? 0,
      minimumArtistFame: programme?.minimumArtistFame ?? null,
      preferredGenres: programme?.preferredGenres.join(", ") ?? "",
    });
  }, [query.data]);

  if (query.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Line-up</CardTitle>
          <CardDescription>Loading Festival acts…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (query.isError || !query.data || !draft) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music2 aria-hidden="true" /> Line-up unavailable
          </CardTitle>
          <CardDescription>
            Complete the annual Festival Plan before choosing the line-up. The
            game creates the ticket foundation automatically; ticket price and
            availability are set later on Tickets & budget.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const data = query.data;
  const currency = data.programme?.currencyCode ?? "GBP";
  const activeMode = lineupModes.find(
    (mode) => mode.value === draft.applicationMode,
  )!;
  const blockingIssues = data.issues.filter((issue) => issue.blocking);
  const dirty =
    draft.applicationMode !== (data.programme?.applicationMode ?? "hybrid") ||
    draft.artistBudgetMinor !== (data.programme?.artistBudgetMinor ?? 0) ||
    draft.minimumArtistFame !== (data.programme?.minimumArtistFame ?? null) ||
    draft.preferredGenres !==
      (data.programme?.preferredGenres.join(", ") ?? "");

  const currentProgramme = data.programme;
  const genres = toGenreList(draft.preferredGenres);
  const acceptsApplications =
    draft.applicationMode === "applications_only" ||
    draft.applicationMode === "hybrid";
  const applicationWindow = acceptsApplications
    ? data.applicationWindows[0] ??
      defaultWindow(data.festivalDates, draft.minimumArtistFame, genres)
    : null;

  const programme: FestivalArtistProgramme = {
    id: currentProgramme?.id ?? null,
    currencyCode: currentProgramme?.currencyCode ?? "GBP",
    applicationMode: draft.applicationMode,
    applicationsOpenAt: applicationWindow?.opensAt ?? null,
    applicationsCloseAt: applicationWindow?.closesAt ?? null,
    minimumArtistFame: draft.minimumArtistFame,
    maximumArtistFame: currentProgramme?.maximumArtistFame ?? null,
    preferredGenres: genres,
    excludedGenres: currentProgramme?.excludedGenres ?? [],
    artistBudgetMinor: draft.artistBudgetMinor,
    contingencyBudgetMinor: currentProgramme?.contingencyBudgetMinor ?? 0,
    minimumPlayerArtistShareBasisPoints:
      currentProgramme?.minimumPlayerArtistShareBasisPoints ?? 0,
    status: currentProgramme?.status ?? "not_started",
  };

  let applicationWindows: FestivalApplicationWindow[] = [];
  if (acceptsApplications) {
    const currentWindow = data.applicationWindows[0];
    applicationWindows = currentWindow
      ? [
          {
            ...currentWindow,
            minimumFame: draft.minimumArtistFame,
            preferredGenres: genres,
          },
        ]
      : [defaultWindow(data.festivalDates, draft.minimumArtistFame, genres)];
  }

  const persist = (complete = false) => {
    if (save.isPending || !data.canWrite) return;
    save.mutate({
      festivalCompanyId,
      festivalEditionId,
      expectedVersion: data.planningVersion,
      programme,
      applicationWindows,
      idempotencyKey: crypto.randomUUID(),
      complete,
    });
  };

  return (
    <section aria-labelledby="lineup-heading" className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle id="lineup-heading" className="flex items-center gap-2">
                <Music2 aria-hidden="true" /> Festival line-up
              </CardTitle>
              <CardDescription>
                Choose the overall approach and budget. The game creates the
                running order and can fill empty spaces with suitable NPC acts.
              </CardDescription>
            </div>
            <Badge variant={data.ready ? "default" : "secondary"}>
              {data.ready ? "Line-up ready" : "Planning"}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Owner choices</CardTitle>
            <CardDescription>
              Choose the line-up method and artist budget. Optional targeting
              can be left alone unless you want tighter control.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="festival-lineup-mode">Line-up method</Label>
              <Select
                value={draft.applicationMode}
                onValueChange={(value: LineupMode) =>
                  setDraft((current) =>
                    current
                      ? { ...current, applicationMode: value }
                      : current,
                  )
                }
              >
                <SelectTrigger id="festival-lineup-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {lineupModes.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {activeMode.description}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="festival-artist-budget">
                Total artist budget ({currency})
              </Label>
              <Input
                id="festival-artist-budget"
                inputMode="decimal"
                value={(draft.artistBudgetMinor / 100).toFixed(2)}
                onChange={(event) => {
                  const value = parseMoneyToMinor(event.target.value);
                  if (value === null) return;
                  setDraft((current) =>
                    current
                      ? { ...current, artistBudgetMinor: value }
                      : current,
                  );
                }}
              />
            </div>

            <details className="rounded-lg border bg-muted/20 p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Optional artist targeting
              </summary>
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="festival-minimum-fame">
                    Minimum artist fame
                  </Label>
                  <Input
                    id="festival-minimum-fame"
                    type="number"
                    min={0}
                    value={draft.minimumArtistFame ?? ""}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              minimumArtistFame:
                                event.target.value === ""
                                  ? null
                                  : Math.max(0, Number(event.target.value)),
                            }
                          : current,
                      )
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="festival-preferred-genres">
                    Preferred genres
                  </Label>
                  <Input
                    id="festival-preferred-genres"
                    placeholder="Rock, indie, punk"
                    value={draft.preferredGenres}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, preferredGenres: event.target.value }
                          : current,
                      )
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    Separate genres with commas. This guides applications and NPC
                    fallback choices.
                  </p>
                </div>
              </div>
            </details>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Line-up summary</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-muted-foreground">Confirmed acts</dt>
                  <dd className="text-2xl font-semibold">{data.bookings.length}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Applications</dt>
                  <dd className="text-2xl font-semibold">
                    {data.applications.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Active offers</dt>
                  <dd>
                    {
                      data.offers.filter(
                        (offer) =>
                          offer.status === "sent" ||
                          offer.status === "countered",
                      ).length
                    }
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Budget remaining</dt>
                  <dd>
                    {formatMinorMoney(data.budget.remainingMinor, currency)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WandSparkles className="h-5 w-5" /> Automatic Festival work
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>• Orders confirmed acts by billing importance and popularity.</p>
              <p>• Assigns acts to suitable stages and Festival days.</p>
              <p>• Adds NPC acts when the selected approach allows fallback.</p>
              <p>• Calculates artist travel, accommodation and total costs.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {save.error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            The line-up choices could not be saved. {save.error.message}
          </AlertDescription>
        </Alert>
      ) : null}

      {blockingIssues.length ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {blockingIssues.length} line-up blocker(s) remain before launch.
          </AlertDescription>
        </Alert>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> No blocking
          line-up issue is currently reported.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-4">
        <span role="status" className="text-sm text-muted-foreground">
          {save.isPending
            ? "Saving…"
            : dirty
              ? "Unsaved line-up choices"
              : "Line-up choices saved"}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!dirty || save.isPending || !data.canWrite}
            onClick={() => persist(false)}
          >
            Save choices
          </Button>
          <Button
            disabled={
              save.isPending ||
              !data.canWrite ||
              blockingIssues.length > 0
            }
            onClick={() => persist(true)}
          >
            Confirm line-up plan
          </Button>
        </div>
      </div>
    </section>
  );
}
