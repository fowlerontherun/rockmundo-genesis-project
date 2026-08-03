import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Gauge,
  History,
  LockKeyhole,
  Plus,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { planNextFestivalEdition } from "@/features/festival-company/data/festivalCompanyRepository";
import { festivalRoutes } from "@/features/festivals/routes";
import {
  festivalCompanyEditionsQueryKey,
  getFestivalCompanyEditions,
  type FestivalCompanyEdition,
} from "./repository";

const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(`${value}T12:00:00`))
    : "Dates not set";

const statusLabel = (status: string) => status.replaceAll("_", " ");
const money = (minor: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(minor / 100);

function EditionCard({
  festivalCompanyId,
  edition,
}: {
  festivalCompanyId: string;
  edition: FestivalCompanyEdition;
}) {
  const destination = festivalRoutes.edition(
    festivalCompanyId,
    edition.festivalEditionId,
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{edition.name}</CardTitle>
            <CardDescription>
              Annual company Festival · game year {edition.editionYear}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge
              variant={edition.editable ? "secondary" : "outline"}
              className="capitalize"
            >
              {statusLabel(edition.status)}
            </Badge>
            {edition.editable ? (
              <Badge
                variant={edition.planningStatus === "ready" ? "default" : "outline"}
                className="capitalize"
              >
                {statusLabel(edition.planningStatus)}
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {edition.startsOn && edition.endsOn
              ? `${date(edition.startsOn)} – ${date(edition.endsOn)}`
              : "Dates not set"}
          </p>
          <p>
            Size:{" "}
            <strong className="capitalize">
              {edition.festivalScale ?? "Not set"}
            </strong>
          </p>
          <p>
            Target attendance:{" "}
            <strong>
              {edition.expectedCapacity?.toLocaleString("en-GB") ?? "Not set"}
            </strong>
          </p>
          <p className="flex items-center gap-2">
            <WalletCards className="h-4 w-4 text-muted-foreground" />
            <strong>
              {edition.estimatedOperatingCostMinor
                ? money(edition.estimatedOperatingCostMinor)
                : "Cost not calculated"}
            </strong>
          </p>
        </div>

        {edition.editable ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Gauge className="h-3.5 w-3.5" /> Planning readiness
              </span>
              <strong>{edition.readinessScore}%</strong>
            </div>
            <Progress value={edition.readinessScore} />
          </div>
        ) : null}

        {edition.lockedAt ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LockKeyhole className="h-4 w-4" /> This Festival result is locked.
          </p>
        ) : null}

        <Button
          asChild
          className="w-full"
          variant={edition.editable ? "default" : "outline"}
        >
          <Link to={destination}>
            {edition.editable ? "Plan Festival" : "View result"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function FestivalCompanyEditionsPage({
  festivalCompanyId,
}: {
  festivalCompanyId: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: festivalCompanyEditionsQueryKey(festivalCompanyId),
    queryFn: () => getFestivalCompanyEditions(festivalCompanyId),
  });
  const createFestival = useMutation({
    mutationFn: () =>
      planNextFestivalEdition(festivalCompanyId, crypto.randomUUID()),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: festivalCompanyEditionsQueryKey(festivalCompanyId),
      });
      toast.success(`Annual Festival ${result.editionYear} planned`);
      navigate(
        festivalRoutes.edition(
          festivalCompanyId,
          result.festivalEditionId,
        ),
      );
    },
    onError: (error: Error) => {
      const message = error.message.includes("festival_edition_year_exists")
        ? "A Festival already exists for the next available game year."
        : "The next annual Festival could not be planned.";
      toast.error(message);
    },
  });

  if (query.isLoading) {
    return (
      <main className="p-6" role="status">
        Loading annual Festivals…
      </main>
    );
  }

  if (query.error || !query.data) {
    return (
      <main className="mx-auto max-w-3xl space-y-3 p-6">
        <h1 className="text-3xl font-bold">Annual Festivals unavailable</h1>
        <p role="alert">
          The Festival list could not be loaded or you do not have company
          management permission.
        </p>
        <Link
          className="underline"
          to={festivalRoutes.company(festivalCompanyId)}
        >
          Return to Festival company
        </Link>
      </main>
    );
  }

  const data = query.data;
  const activeFestivals = data.editions.filter((edition) => edition.editable);
  const historicalFestivals = data.editions.filter(
    (edition) => !edition.editable,
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link
          className="underline"
          to={festivalRoutes.company(festivalCompanyId)}
        >
          {data.publicName}
        </Link>
        {" / Annual Festivals"}
      </nav>

      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Company events
          </p>
          <h1 className="text-3xl font-bold">Annual Festivals</h1>
          <p className="mt-1 max-w-3xl text-muted-foreground">
            Run one Festival each game year. Your company upgrades carry forward;
            dates, line-up, tickets and results belong to that year's event.
          </p>
        </div>
        <Button
          type="button"
          disabled={!data.canPlanNext || createFestival.isPending}
          onClick={() => createFestival.mutate()}
        >
          <Plus className="mr-2 h-4 w-4" />
          {createFestival.isPending
            ? "Planning…"
            : "Plan next annual Festival"}
        </Button>
      </header>

      {!data.canPlanNext ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Complete the Festival company setup and keep the company active before
            planning another annual event.
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3" aria-labelledby="active-festivals-heading">
        <h2 id="active-festivals-heading" className="text-xl font-semibold">
          Current and upcoming Festivals
        </h2>
        {activeFestivals.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {activeFestivals.map((edition) => (
              <EditionCard
                key={edition.festivalEditionId}
                festivalCompanyId={festivalCompanyId}
                edition={edition}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              No annual Festival is being planned. Start the next event when the
              company is ready.
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="festival-history-heading">
        <h2
          id="festival-history-heading"
          className="flex items-center gap-2 text-xl font-semibold"
        >
          <History className="h-5 w-5" /> Company Festival history
        </h2>
        {historicalFestivals.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {historicalFestivals.map((edition) => (
              <EditionCard
                key={edition.festivalEditionId}
                festivalCompanyId={festivalCompanyId}
                edition={edition}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Completed and cancelled annual Festivals will appear here.
          </p>
        )}
      </section>
    </main>
  );
}

export default FestivalCompanyEditionsPage;
