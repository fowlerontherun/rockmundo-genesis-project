import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FestivalSitePlanner } from "@/features/festival-company/ui/FestivalSitePlanner";
import { FestivalTicketPlanner } from "@/features/festival-company/ui/FestivalTicketPlanner";
import { FestivalArtistPlanner } from "@/features/festival-company/ui/FestivalArtistPlanner";
import { FestivalOperationsPlanner } from "@/features/festival-company/ui/FestivalOperationsPlanner";
import { FestivalSponsorshipPlanner } from "@/features/festival-company/ui/FestivalSponsorshipPlanner";
import { FestivalLaunchManager } from "@/features/festival-company/ui/FestivalLaunchManager";
import { getFestivalCompanyEditions, type FestivalEditionPlanBindingKey } from "@/features/festivals/editions/repository";
import { FestivalScheduleWorkspace } from "@/features/festivals/scheduling/components/FestivalScheduleWorkspace";
import { settlementRepository } from "@/features/festivals/settlement/repository";

const SectionShell = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-4" aria-label={title}>
    <header className="space-y-1">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </header>
    {children}
  </section>
);

const bindingLabels: Record<FestivalEditionPlanBindingKey, string> = {
  configuration: "configuration",
  site: "site",
  tickets: "ticket",
  artists: "artist programme",
  operations: "operations",
  sponsorship: "sponsorship",
  timetable: "legacy timetable",
};

function EditionScope({
  festivalCompanyId,
  editionId,
  children,
  requireEditable = false,
  requiredBindings = [],
}: {
  festivalCompanyId: string;
  editionId: string;
  children?: React.ReactNode;
  requireEditable?: boolean;
  requiredBindings?: FestivalEditionPlanBindingKey[];
}) {
  const query = useQuery({
    queryKey: ["festival-company-editions", festivalCompanyId],
    queryFn: () => getFestivalCompanyEditions(festivalCompanyId),
  });

  if (query.isLoading) return <p role="status">Loading edition scope…</p>;
  const edition = query.data?.editions.find((item) => item.festivalEditionId === editionId);
  if (query.error || !edition) {
    return <Card><CardContent className="pt-6">This annual edition could not be loaded.</CardContent></Card>;
  }

  const missingBindings = requiredBindings.filter((binding) => !edition.planBindings[binding]);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{edition.name}</CardTitle>
              <CardDescription>Game year {edition.editionYear}</CardDescription>
            </div>
            <Badge variant={edition.editable ? "secondary" : "outline"} className="capitalize">
              {edition.status.replaceAll("_", " ")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <p>Dates: <strong>{edition.startsOn ?? "Not set"} – {edition.endsOn ?? "Not set"}</strong></p>
          <p>Scale: <strong className="capitalize">{edition.festivalScale ?? "Not set"}</strong></p>
          <p>Duration: <strong>{edition.durationDays ? `${edition.durationDays} day(s)` : "Not set"}</strong></p>
          <p>Capacity: <strong>{edition.expectedCapacity?.toLocaleString("en-GB") ?? "Not set"}</strong></p>
        </CardContent>
      </Card>
      {requireEditable && !edition.editable ? (
        <Card>
          <CardHeader>
            <CardTitle>Edition is read-only</CardTitle>
            <CardDescription>Completed, cancelled or locked editions cannot change planning data.</CardDescription>
          </CardHeader>
        </Card>
      ) : missingBindings.length ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle>Planning controls safely blocked</CardTitle>
            <CardDescription>
              This edition is not bound to its {missingBindings.map((binding) => bindingLabels[binding]).join(", ")} plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            The existing compatibility planner is company-scoped. It has not been mounted because doing so could modify another annual edition. Complete the edition-native planner migration before enabling these controls.
          </CardContent>
        </Card>
      ) : children}
    </>
  );
}

export function FestivalEditionOverview({ festivalCompanyId, editionId }: { festivalCompanyId: string; editionId: string }) {
  return (
    <SectionShell
      title="Edition overview"
      description="Identity, location, scale and dates for this exact annual edition. Permanent company defaults are managed from the Festival company page."
    >
      <EditionScope festivalCompanyId={festivalCompanyId} editionId={editionId} />
    </SectionShell>
  );
}

export function FestivalEditionSchedule({ festivalCompanyId, editionId }: { festivalCompanyId: string; editionId: string }) {
  return (
    <SectionShell
      title="Timetable and readiness"
      description="Build the stage-by-stage running order for this edition using the canonical revisioned schedule."
    >
      <EditionScope festivalCompanyId={festivalCompanyId} editionId={editionId} requireEditable>
        <FestivalScheduleWorkspace editionId={editionId} />
      </EditionScope>
    </SectionShell>
  );
}

export function FestivalEditionApplications({ festivalCompanyId, editionId }: { festivalCompanyId: string; editionId: string }) {
  return (
    <SectionShell
      title="Artist programme"
      description="Application windows, candidate discovery, invitations, offers and confirmed bookings for this edition."
    >
      <EditionScope festivalCompanyId={festivalCompanyId} editionId={editionId} requireEditable requiredBindings={["artists"]}>
        <FestivalArtistPlanner festivalCompanyId={festivalCompanyId} />
      </EditionScope>
    </SectionShell>
  );
}

export function FestivalEditionContracts({ festivalCompanyId, editionId }: { festivalCompanyId: string; editionId: string }) {
  return (
    <SectionShell
      title="Commercial partnerships and launch"
      description="Sponsorship packages and commercial agreements, followed by the atomic launch and ticket-sales controls for this edition."
    >
      <EditionScope
        festivalCompanyId={festivalCompanyId}
        editionId={editionId}
        requireEditable
        requiredBindings={["configuration", "site", "tickets", "artists", "operations", "sponsorship"]}
      >
        <FestivalSponsorshipPlanner festivalCompanyId={festivalCompanyId} />
        <FestivalLaunchManager festivalCompanyId={festivalCompanyId} />
      </EditionScope>
    </SectionShell>
  );
}

export function FestivalEditionOperations({ festivalCompanyId, editionId }: { festivalCompanyId: string; editionId: string }) {
  return (
    <SectionShell
      title="Site, staffing and suppliers"
      description="Site layout and stages, then departments, staffing coverage and supplier contracts for this edition."
    >
      <EditionScope festivalCompanyId={festivalCompanyId} editionId={editionId} requireEditable requiredBindings={["site", "operations"]}>
        <FestivalSitePlanner festivalCompanyId={festivalCompanyId} />
        <FestivalOperationsPlanner festivalCompanyId={festivalCompanyId} />
      </EditionScope>
    </SectionShell>
  );
}

export function FestivalEditionFinance({ festivalCompanyId, editionId }: { festivalCompanyId: string; editionId: string }) {
  return (
    <SectionShell
      title="Ticketing and revenue planning"
      description="Ticket products, daily capacity allocation, release phases and deterministic revenue forecasts for this edition. Planning only — nothing is sold here."
    >
      <EditionScope festivalCompanyId={festivalCompanyId} editionId={editionId} requireEditable requiredBindings={["site", "tickets"]}>
        <FestivalTicketPlanner festivalCompanyId={festivalCompanyId} />
      </EditionScope>
    </SectionShell>
  );
}

export function FestivalEditionHistory({ editionId }: { editionId: string }) {
  const query = useQuery({
    queryKey: ["festival-edition-history", editionId],
    queryFn: () => settlementRepository.history(editionId),
  });
  return (
    <SectionShell
      title="Immutable edition history"
      description="Frozen at settlement completion. Private contracts and exact financial totals are never published."
    >
      {query.isLoading ? (
        <p role="status">Loading edition history…</p>
      ) : !query.data ? (
        <Card>
          <CardHeader>
            <CardTitle>No history yet</CardTitle>
            <CardDescription>This edition has not completed settlement, so no permanent record exists.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <HistoryStat label="Dates" value={`${query.data.dates?.startsOn ?? "—"} – ${query.data.dates?.endsOn ?? "—"}`} />
          <HistoryStat label="Attendance" value={(query.data.attendance ?? 0).toLocaleString("en-GB")} />
          <HistoryStat label="Audience rating" value={`${query.data.audienceScore ?? "—"}/100`} />
          <HistoryStat label="Result" value={query.data.profitabilityBand.replaceAll("_", " ")} />
          <HistoryStat label="Headliners" value={query.data.headliners.map(String).join(", ") || "—"} />
          <HistoryStat
            label="Reputation change"
            value={`${query.data.reputationChange >= 0 ? "+" : ""}${query.data.reputationChange}`}
          />
        </div>
      )}
    </SectionShell>
  );
}

const HistoryStat = ({ label, value }: { label: string; value: string }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
    </CardHeader>
    <CardContent>
      <Badge variant="secondary" className="whitespace-normal text-left text-sm">
        {value}
      </Badge>
    </CardContent>
  </Card>
);
