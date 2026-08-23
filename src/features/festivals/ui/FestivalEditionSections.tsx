import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  Banknote,
  BarChart3,
  Building2,
  Music2,
  PlayCircle,
  Ticket,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FestivalArtistPlanner } from "@/features/festival-company/ui/FestivalArtistPlanner";
import { FestivalLineupWorkflowManager } from "@/features/festival-company/ui/FestivalLineupWorkflowManager";
import { FestivalTicketPlanner } from "@/features/festival-company/ui/FestivalTicketPlanner";
import { FestivalAnnualPlan } from "@/features/festivals/annual-plan/FestivalAnnualPlan";
import {
  getFestivalCompanyEditions,
  type FestivalEditionPlanBindingKey,
} from "@/features/festivals/editions/repository";
import { festivalRoutes } from "@/features/festivals/routes";
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
  configuration: "company setup",
  site: "annual Festival plan",
  tickets: "ticket",
  artists: "line-up",
  operations: "automatic operations",
  sponsorship: "automatic commercial",
  timetable: "automatic running order",
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

  if (query.isLoading) {
    return <p role="status">Loading annual Festival…</p>;
  }

  const edition = query.data?.editions.find(
    (item) => item.festivalEditionId === editionId,
  );

  if (query.error || !edition) {
    return (
      <Card>
        <CardContent className="pt-6">
          This annual Festival could not be loaded.
        </CardContent>
      </Card>
    );
  }

  const missingBindings = requiredBindings.filter(
    (binding) => !edition.planBindings[binding],
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{edition.name}</CardTitle>
              <CardDescription>
                Annual company event · game year {edition.editionYear}
              </CardDescription>
            </div>
            <Badge
              variant={edition.editable ? "secondary" : "outline"}
              className="capitalize"
            >
              {edition.status.replaceAll("_", " ")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <p>
            Dates:{" "}
            <strong>
              {edition.startsOn ?? "Not set"} – {edition.endsOn ?? "Not set"}
            </strong>
          </p>
          <p>
            Scale:{" "}
            <strong className="capitalize">
              {edition.festivalScale ?? "Not set"}
            </strong>
          </p>
          <p>
            Duration:{" "}
            <strong>
              {edition.durationDays
                ? `${edition.durationDays} day(s)`
                : "Not set"}
            </strong>
          </p>
          <p>
            Readiness: <strong>{edition.readinessScore}%</strong>
          </p>
        </CardContent>
      </Card>

      {requireEditable && !edition.editable ? (
        <Card>
          <CardHeader>
            <CardTitle>Festival is read-only</CardTitle>
            <CardDescription>
              Completed, cancelled or locked annual Festivals cannot be changed.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : missingBindings.length ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle>Finish the earlier Festival choices first</CardTitle>
            <CardDescription>
              This annual Festival is not yet connected to its{" "}
              {missingBindings
                .map((binding) => bindingLabels[binding])
                .join(", ")}{" "}
              settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Return to the Plan screen. The game creates the site foundations,
            stages and operating requirements automatically from your high-level
            choices and company upgrades.
          </CardContent>
        </Card>
      ) : (
        children
      )}
    </>
  );
}

export function FestivalEditionOverview({
  festivalCompanyId,
  editionId,
}: {
  festivalCompanyId: string;
  editionId: string;
}) {
  return (
    <SectionShell
      title="Plan the annual Festival"
      description="Choose the dates, city, style, size, vibe and marketing emphasis. The game calculates operational detail from the company upgrades."
    >
      <EditionScope
        festivalCompanyId={festivalCompanyId}
        editionId={editionId}
        requireEditable
      >
        <FestivalAnnualPlan
          festivalCompanyId={festivalCompanyId}
          editionId={editionId}
        />
      </EditionScope>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Company strength drives the event
          </CardTitle>
          <CardDescription>
            Licence, reputation and the eleven permanent company upgrades decide
            how large, safe, attractive and profitable this Festival can become.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to={festivalRoutes.company(festivalCompanyId)}>
              Festival company
            </Link>
          </Button>
          <Button asChild>
            <Link to={festivalRoutes.upgrades(festivalCompanyId)}>
              View eleven upgrades
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <ActionCard
          icon={<Music2 className="h-5 w-5" />}
          title="Choose the line-up"
          description="Set the artist budget, review applications and invite acts. Empty spaces can be filled automatically."
          label="Manage line-up"
          to={festivalRoutes.applications(festivalCompanyId, editionId)}
        />
        <ActionCard
          icon={<Ticket className="h-5 w-5" />}
          title="Set tickets and budget"
          description="Choose one standard ticket price and how many tickets to make available. The game produces the forecast."
          label="Set tickets"
          to={festivalRoutes.finance(festivalCompanyId, editionId)}
        />
        <ActionCard
          icon={<PlayCircle className="h-5 w-5" />}
          title="Run the Festival"
          description="Review simple blockers and warnings, then launch. Staffing, suppliers and the running order are automatic."
          label="Run Festival"
          to={festivalRoutes.live(festivalCompanyId, editionId)}
        />
        <ActionCard
          icon={<BarChart3 className="h-5 w-5" />}
          title="See the result"
          description="Completed Festivals retain attendance, rating, headliners, profit band and reputation change as permanent company history."
          label="View results"
          to={festivalRoutes.history(festivalCompanyId, editionId)}
        />
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle>Generated automatically by the game</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>• Site capacity and stage count from scale and upgrades</p>
          <p>• Stage running order and NPC fallback acts</p>
          <p>• Security, medical and welfare requirements</p>
          <p>• Staff, supplier and operating costs</p>
          <p>• Weather, transport and technical risks</p>
          <p>• Final attendance, revenue and settlement</p>
        </CardContent>
      </Card>
    </SectionShell>
  );
}

export function FestivalEditionApplications({
  festivalCompanyId,
  editionId,
}: {
  festivalCompanyId: string;
  editionId: string;
}) {
  return (
    <SectionShell
      title="Line-up"
      description="Set the overall approach and budget, then review applications, invite acts and track confirmed bookings in one place."
    >
      <EditionScope
        festivalCompanyId={festivalCompanyId}
        editionId={editionId}
        requireEditable
      >
        <div className="space-y-4">
          <FestivalArtistPlanner
            festivalCompanyId={festivalCompanyId}
            festivalEditionId={editionId}
          />
          <FestivalLineupWorkflowManager
            festivalCompanyId={festivalCompanyId}
            festivalEditionId={editionId}
          />
        </div>
      </EditionScope>
    </SectionShell>
  );
}

export function FestivalEditionFinance({
  festivalCompanyId,
  editionId,
}: {
  festivalCompanyId: string;
  editionId: string;
}) {
  return (
    <SectionShell
      title="Tickets and budget"
      description="Set a standard ticket price and tickets available. The game calculates demand, automatic sponsorship and the projected Festival result."
    >
      <EditionScope
        festivalCompanyId={festivalCompanyId}
        editionId={editionId}
        requireEditable
        requiredBindings={["site"]}
      >
        <FestivalTicketPlanner
          festivalCompanyId={festivalCompanyId}
          festivalEditionId={editionId}
        />
      </EditionScope>
    </SectionShell>
  );
}

const formatMoney = (minor: number, currencyCode: string) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currencyCode,
  }).format(minor / 100);

export function FestivalEditionHistory({ editionId }: { editionId: string }) {
  const { festivalCompanyId } = useParams();
  const query = useQuery({
    queryKey: ["festival-edition-owner-results", festivalCompanyId, editionId],
    queryFn: () => settlementRepository.ownerHistory(festivalCompanyId!, editionId),
    enabled: Boolean(festivalCompanyId),
  });

  const result = query.data;

  return (
    <SectionShell
      title="Annual Festival results"
      description="The game automatically settles the Festival into the company and freezes this annual result."
    >
      {query.isLoading ? (
        <p role="status">Loading Festival results…</p>
      ) : query.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Results unavailable</CardTitle>
            <CardDescription>
              The completed Festival result could not be loaded for this company.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : !result ? (
        <Card>
          <CardHeader>
            <CardTitle>No result yet</CardTitle>
            <CardDescription>
              This annual Festival has not finished, so no permanent company
              result exists yet.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <HistoryStat
              label="Dates"
              value={`${result.dates?.startsOn ?? "—"} – ${result.dates?.endsOn ?? "—"}`}
            />
            <HistoryStat
              label="Attendance"
              value={result.attendance.toLocaleString("en-GB")}
            />
            <HistoryStat
              label="Audience rating"
              value={`${result.audienceScore}/100`}
            />
            <HistoryStat
              label="Company result"
              value={result.profitabilityBand.replaceAll("_", " ")}
            />
            <HistoryStat
              label="Headliners"
              value={result.headliners.map(String).join(", ") || "—"}
            />
            <HistoryStat
              label="Reputation change"
              value={`${result.companyImpact.reputationChange >= 0 ? "+" : ""}${result.companyImpact.reputationChange}`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="h-5 w-5" /> Festival finances
              </CardTitle>
              <CardDescription>
                Final revenue and operating costs from this annual Festival.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ResultValue label="Ticket revenue" value={formatMoney(result.financials.ticketRevenueMinor, result.currencyCode)} />
              <ResultValue label="Sponsorship" value={formatMoney(result.financials.sponsorshipRevenueMinor, result.currencyCode)} />
              <ResultValue label="Food & drink" value={formatMoney(result.financials.foodAndDrinkRevenueMinor, result.currencyCode)} />
              <ResultValue label="Merchandise" value={formatMoney(result.financials.merchandiseRevenueMinor, result.currencyCode)} />
              <ResultValue label="Total revenue" value={formatMoney(result.financials.totalRevenueMinor, result.currencyCode)} />
              <ResultValue label="Operating cost" value={formatMoney(result.financials.operatingCostMinor, result.currencyCode)} />
              <ResultValue label="Tax" value={formatMoney(result.financials.taxMinor, result.currencyCode)} />
              <ResultValue
                label="Net result"
                value={formatMoney(result.financials.netProfitMinor, result.currencyCode)}
                emphasis
              />
            </CardContent>
          </Card>

          <Card className={result.companyImpact.settlementApplied ? "border-primary/30 bg-primary/5" : "border-amber-500/40 bg-amber-500/5"}>
            <CardHeader>
              <CardTitle>Company impact</CardTitle>
              <CardDescription>
                {result.companyImpact.settlementApplied
                  ? "The financial result and reputation change have been posted automatically to the Festival company."
                  : "The Festival completed, but the company settlement has not been confirmed."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ResultValue
                label="Balance before"
                value={result.companyImpact.balanceBeforeMinor === null ? "—" : formatMoney(result.companyImpact.balanceBeforeMinor, result.currencyCode)}
              />
              <ResultValue
                label="Balance after"
                value={result.companyImpact.balanceAfterMinor === null ? "—" : formatMoney(result.companyImpact.balanceAfterMinor, result.currencyCode)}
              />
              <ResultValue
                label="Reputation before"
                value={result.companyImpact.reputationBefore?.toString() ?? "—"}
              />
              <ResultValue
                label="Reputation after"
                value={result.companyImpact.reputationAfter?.toString() ?? "—"}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </SectionShell>
  );
}

function ActionCard({
  icon,
  title,
  description,
  label,
  to,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  label: string;
  to: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link to={to}>{label}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

const HistoryStat = ({ label, value }: { label: string; value: string }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {label === "Company result" ? <Banknote className="h-4 w-4" /> : null}
        {label}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <Badge variant="secondary" className="whitespace-normal text-left text-sm">
        {value}
      </Badge>
    </CardContent>
  </Card>
);

const ResultValue = ({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) => (
  <div className="rounded-lg border bg-background/60 p-3">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className={emphasis ? "mt-1 text-lg font-bold" : "mt-1 font-semibold"}>{value}</p>
  </div>
);
