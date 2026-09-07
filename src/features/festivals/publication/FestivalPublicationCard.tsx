import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Megaphone, TicketCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  festivalCompanyEditionsQueryKey,
  getFestivalCompanyEditions,
} from "@/features/festivals/editions/repository";
import { festivalRoutes } from "@/features/festivals/routes";
import {
  getSimplifiedFestivalPublicationStatus,
  publishSimplifiedFestival,
} from "./simplifiedFestivalPublication";

const publicationStatusKey = (festivalCompanyId: string) => [
  "simplified-festival-publication",
  festivalCompanyId,
] as const;

const publicStatuses = new Set([
  "launched",
  "tickets_on_sale",
  "sales_paused",
  "sales_closed",
]);

const statusLabel = (status: string) => {
  switch (status) {
    case "tickets_on_sale":
      return "Tickets on sale";
    case "sales_paused":
      return "Sales paused";
    case "sales_closed":
      return "Sales closed";
    case "launched":
      return "Published";
    case "launch_review":
      return "Preparing publication";
    default:
      return "Not published";
  }
};

export function FestivalPublicationCard({
  festivalCompanyId,
  editionId,
}: {
  festivalCompanyId: string;
  editionId: string;
}) {
  const queryClient = useQueryClient();
  const editionsQuery = useQuery({
    queryKey: festivalCompanyEditionsQueryKey(festivalCompanyId),
    queryFn: () => getFestivalCompanyEditions(festivalCompanyId),
  });
  const publicationQuery = useQuery({
    queryKey: publicationStatusKey(festivalCompanyId),
    queryFn: () => getSimplifiedFestivalPublicationStatus(festivalCompanyId),
  });

  const edition = editionsQuery.data?.editions.find(
    (candidate) => candidate.festivalEditionId === editionId,
  );
  const publication = publicationQuery.data;
  const published = publication ? publicStatuses.has(publication.launchStatus) : false;

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!edition) throw new Error("festival_edition_not_found");
      return publishSimplifiedFestival({
        festivalCompanyId,
        festivalEditionId: editionId,
        expectedEditionVersion: edition.version,
        idempotencyKey: crypto.randomUUID(),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: publicationStatusKey(festivalCompanyId) }),
        queryClient.invalidateQueries({ queryKey: ["festival-directory"] }),
        queryClient.invalidateQueries({ queryKey: festivalCompanyEditionsQueryKey(festivalCompanyId) }),
      ]);
    },
  });

  if (editionsQuery.isLoading || publicationQuery.isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground" role="status">
          Checking Festival publication…
        </CardContent>
      </Card>
    );
  }

  if (!edition || editionsQuery.isError || publicationQuery.isError) {
    return (
      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardHeader>
          <CardTitle>Festival publication unavailable</CardTitle>
          <CardDescription>
            The public Festival status could not be loaded. Your planning data has not been changed.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const readyToPublish =
    edition.planningStatus === "ready" &&
    edition.readinessScore === 100 &&
    Boolean(edition.startsOn && edition.endsOn) &&
    edition.editable;

  const publicSlug = publication?.publicSlug ?? publishMutation.data?.launch.publicSlug ?? null;

  return (
    <Card className={published ? "border-emerald-500/40 bg-emerald-500/5" : "border-primary/30"}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              {published ? <TicketCheck className="h-5 w-5" /> : <Megaphone className="h-5 w-5" />}
              Publish the Festival
            </CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              Publishing makes this annual Festival visible to players before Festival Day and opens the existing standard ticket product for sale. Running the Festival itself still waits until the scheduled date.
            </CardDescription>
          </div>
          <Badge variant={published ? "default" : "secondary"}>
            {statusLabel(publication?.launchStatus ?? "ready_for_launch_preparation")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Planning</p>
            <p className="mt-1 font-semibold">{edition.readinessScore}% ready</p>
          </div>
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Festival date</p>
            <p className="mt-1 font-semibold">{edition.startsOn ?? "Not set"}</p>
          </div>
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Public sales</p>
            <p className="mt-1 font-semibold">{published ? statusLabel(publication!.launchStatus) : "Closed"}</p>
          </div>
        </div>

        {!published && !readyToPublish ? (
          <p className="text-sm text-muted-foreground">
            Finish the annual plan, line-up, stage and ticket choices first. Publication unlocks automatically when readiness reaches 100%.
          </p>
        ) : null}

        {publishMutation.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {publishMutation.error.message === "festival_launch_snapshot_stale"
              ? "The Festival changed while publication was being prepared. Reload the plan and publish again."
              : "The Festival could not be published. Check that the plan, stage, line-up and ticket product are still ready."}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {!published ? (
            <Button
              size="lg"
              disabled={!readyToPublish || publishMutation.isPending}
              onClick={() => publishMutation.mutate()}
            >
              <Megaphone className="mr-2 h-4 w-4" />
              {publishMutation.isPending ? "Publishing…" : "Publish Festival & open tickets"}
            </Button>
          ) : null}

          {published && publicSlug ? (
            <Button asChild variant="outline">
              <Link to={festivalRoutes.publicCompany(publicSlug)}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View public Festival
              </Link>
            </Button>
          ) : null}

          <Button asChild variant="ghost">
            <Link to={festivalRoutes.publicDirectory()}>Festival directory</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
