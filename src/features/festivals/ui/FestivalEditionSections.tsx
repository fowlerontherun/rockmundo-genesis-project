import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getFestivalCompanySetup } from "@/features/festival-company/data/festivalCompanyRepository";
import { FestivalSetupSummary } from "@/features/festival-company/ui/FestivalSetupSummary";
import { FestivalConfigurationWizard } from "@/features/festival-company/ui/FestivalConfigurationWizard";
import { FestivalSitePlanner } from "@/features/festival-company/ui/FestivalSitePlanner";
import { FestivalTicketPlanner } from "@/features/festival-company/ui/FestivalTicketPlanner";
import { FestivalArtistPlanner } from "@/features/festival-company/ui/FestivalArtistPlanner";
import { FestivalOperationsPlanner } from "@/features/festival-company/ui/FestivalOperationsPlanner";
import { FestivalSponsorshipPlanner } from "@/features/festival-company/ui/FestivalSponsorshipPlanner";
import { FestivalTimetablePlanner } from "@/features/festival-company/ui/FestivalTimetablePlanner";
import { FestivalLaunchManager } from "@/features/festival-company/ui/FestivalLaunchManager";
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

export function FestivalEditionOverview({ festivalCompanyId }: { festivalCompanyId: string }) {
  const query = useQuery({
    queryKey: ["festival-company-setup", festivalCompanyId],
    queryFn: () => getFestivalCompanySetup(festivalCompanyId),
  });
  return (
    <SectionShell
      title="Edition overview"
      description="Identity, location, scale and dates for this annual edition. All values are validated by the server."
    >
      {query.isLoading ? (
        <p role="status">Loading company setup…</p>
      ) : query.data ? (
        <FestivalSetupSummary setup={query.data} />
      ) : (
        <Card>
          <CardContent className="pt-6">Company setup could not be loaded.</CardContent>
        </Card>
      )}
      <FestivalConfigurationWizard festivalCompanyId={festivalCompanyId} />
    </SectionShell>
  );
}

export function FestivalEditionSchedule({ festivalCompanyId }: { festivalCompanyId: string }) {
  return (
    <SectionShell
      title="Timetable and readiness"
      description="Build stage-by-stage running orders, then recalculate final readiness before launch."
    >
      <FestivalTimetablePlanner festivalCompanyId={festivalCompanyId} />
    </SectionShell>
  );
}

export function FestivalEditionApplications({ festivalCompanyId }: { festivalCompanyId: string }) {
  return (
    <SectionShell
      title="Artist programme"
      description="Application windows, candidate discovery, invitations, offers and confirmed bookings."
    >
      <FestivalArtistPlanner festivalCompanyId={festivalCompanyId} />
    </SectionShell>
  );
}

export function FestivalEditionContracts({ festivalCompanyId }: { festivalCompanyId: string }) {
  return (
    <SectionShell
      title="Commercial partnerships and launch"
      description="Sponsorship packages and commercial agreements, followed by the atomic launch and ticket-sales controls."
    >
      <FestivalSponsorshipPlanner festivalCompanyId={festivalCompanyId} />
      <FestivalLaunchManager festivalCompanyId={festivalCompanyId} />
    </SectionShell>
  );
}

export function FestivalEditionOperations({ festivalCompanyId }: { festivalCompanyId: string }) {
  return (
    <SectionShell
      title="Site, staffing and suppliers"
      description="Site layout and stages, then departments, staffing coverage and supplier contracts."
    >
      <FestivalSitePlanner festivalCompanyId={festivalCompanyId} />
      <FestivalOperationsPlanner festivalCompanyId={festivalCompanyId} />
    </SectionShell>
  );
}

export function FestivalEditionFinance({ festivalCompanyId }: { festivalCompanyId: string }) {
  return (
    <SectionShell
      title="Ticketing and revenue planning"
      description="Ticket products, daily capacity allocation, release phases and deterministic revenue forecasts. Planning only — nothing is sold here."
    >
      <FestivalTicketPlanner festivalCompanyId={festivalCompanyId} />
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
