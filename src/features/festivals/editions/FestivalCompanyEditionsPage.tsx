import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, History, LockKeyhole, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { planNextFestivalEdition } from "@/features/festival-company/data/festivalCompanyRepository";
import { festivalRoutes } from "@/features/festivals/routes";
import { getFestivalCompanyEditions, type FestivalCompanyEdition } from "./repository";

export const festivalCompanyEditionsQueryKey = (festivalCompanyId: string) =>
  ["festival-company-editions", festivalCompanyId] as const;

const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(`${value}T12:00:00`))
    : "Dates not set";

const statusLabel = (status: string) => status.replaceAll("_", " ");

function EditionCard({
  festivalCompanyId,
  edition,
}: {
  festivalCompanyId: string;
  edition: FestivalCompanyEdition;
}) {
  const destination = festivalRoutes.edition(festivalCompanyId, edition.festivalEditionId);
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{edition.name}</CardTitle>
            <CardDescription>Game year {edition.editionYear}</CardDescription>
          </div>
          <Badge variant={edition.editable ? "secondary" : "outline"} className="capitalize">
            {statusLabel(edition.status)}
          </Badge>
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
            Scale: <strong className="capitalize">{edition.festivalScale ?? "Not set"}</strong>
          </p>
          <p>
            Duration: <strong>{edition.durationDays ? `${edition.durationDays} day(s)` : "Not set"}</strong>
          </p>
          <p>
            Capacity: <strong>{edition.expectedCapacity?.toLocaleString("en-GB") ?? "Not set"}</strong>
          </p>
        </div>
        {edition.lockedAt ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LockKeyhole className="h-4 w-4" /> This edition is locked.
          </p>
        ) : null}
        <Button asChild className="w-full" variant={edition.editable ? "default" : "outline"}>
          <Link to={destination}>{edition.editable ? "Manage edition" : "View edition"}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function FestivalCompanyEditionsPage({ festivalCompanyId }: { festivalCompanyId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: festivalCompanyEditionsQueryKey(festivalCompanyId),
    queryFn: () => getFestivalCompanyEditions(festivalCompanyId),
  });
  const createEdition = useMutation({
    mutationFn: () => planNextFestivalEdition(festivalCompanyId, crypto.randomUUID()),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: festivalCompanyEditionsQueryKey(festivalCompanyId),
      });
      toast.success(`Festival edition ${result.editionYear} planned`);
      navigate(festivalRoutes.edition(festivalCompanyId, result.festivalEditionId));
    },
    onError: (error: Error) => {
      const message = error.message.includes("festival_edition_year_exists")
        ? "An edition already exists for the next available game year."
        : "The next annual edition could not be planned.";
      toast.error(message);
    },
  });

  if (query.isLoading) {
    return <main className="p-6" role="status">Loading annual Festival editions…</main>;
  }

  if (query.error || !query.data) {
    return (
      <main className="mx-auto max-w-3xl space-y-3 p-6">
        <h1 className="text-3xl font-bold">Annual editions unavailable</h1>
        <p role="alert">The edition list could not be loaded or you do not have management permission.</p>
        <Link className="underline" to={festivalRoutes.company(festivalCompanyId)}>Return to Festival company</Link>
      </main>
    );
  }

  const data = query.data;
  const activeEditions = data.editions.filter((edition) => edition.editable);
  const historicalEditions = data.editions.filter((edition) => !edition.editable);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link className="underline" to={festivalRoutes.company(festivalCompanyId)}>{data.publicName}</Link>
        {" / Annual editions"}
      </nav>

      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold">Annual editions</h1>
          <p className="mt-1 text-muted-foreground">
            Plan each game year separately. Runtime, contracts and settlement are never copied from a previous edition.
          </p>
        </div>
        <Button
          type="button"
          disabled={!data.canPlanNext || createEdition.isPending}
          onClick={() => createEdition.mutate()}
        >
          <Plus className="mr-2 h-4 w-4" />
          {createEdition.isPending ? "Planning…" : "Plan next annual edition"}
        </Button>
      </header>

      {!data.canPlanNext ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Complete company setup and return the Festival company to active status before planning another edition.
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3" aria-labelledby="active-editions-heading">
        <h2 id="active-editions-heading" className="text-xl font-semibold">Planning and live editions</h2>
        {activeEditions.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {activeEditions.map((edition) => (
              <EditionCard key={edition.festivalEditionId} festivalCompanyId={festivalCompanyId} edition={edition} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              No editable edition exists. Plan the next annual edition to begin.
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="edition-history-heading">
        <h2 id="edition-history-heading" className="flex items-center gap-2 text-xl font-semibold">
          <History className="h-5 w-5" /> Edition history
        </h2>
        {historicalEditions.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {historicalEditions.map((edition) => (
              <EditionCard key={edition.festivalEditionId} festivalCompanyId={festivalCompanyId} edition={edition} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Completed and cancelled editions will appear here.</p>
        )}
      </section>
    </main>
  );
}

export default FestivalCompanyEditionsPage;
