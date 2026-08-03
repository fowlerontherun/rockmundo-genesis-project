import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
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
import { FestivalTicketPlanner } from "@/features/festival-company/ui/FestivalTicketPlanner";
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
  site: "Festival site",
  tickets: "ticket",
  artists: "line-up",
  operations: "automatic operations",
  sponsorship: "commercial",
  timetable: "running order",
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
            Target capacity:{" "}
            <strong>
              {edition.expectedCapacity?.toLocaleString("en-GB") ?? "Not set"}
            </strong>
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
            Return to the Plan screen. The game will generate detailed operations
            and the running order automatically once the high-level choices are
            complete.
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
      description="Make the important music-business choices. The game handles detailed event operations automatically."
    >
      <EditionScope
        festivalCompanyId={festivalCompanyId}
        editionId={editionId}
      />

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
          description="Set the artist budget and decide whether to use applications, invitations or a mixture. Empty spaces can be filled automatically."
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
          description="Review simple blockers and warnings, then launch. Staffing, suppliers, running order and settlement are automatic."
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
          <p>• Stage count and running order</p>
          <p>• Security, medical and welfare requirements</p>
          <p>• Staff, supplier and operating costs</p>
          <p>• Weather, transport and technical risks</p>
          <p>• NPC acts for remaining line-up spaces</p>
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
      description="Set the overall approach and budget, then review applications, offers and confirmed acts in one place."
    >
      <EditionScope
        festivalCompanyId={festivalCompanyId}
        editionId={editionId}
        requireEditable
        requiredBindings={["artists"]}
      >
        <FestivalArtistPlanner festivalCompanyId={festivalCompanyId} />
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
      description="Set a standard ticket price, tickets available and expected demand. Detailed products and release phases are not required."
    >
      <EditionScope
        festivalCompanyId={festivalCompanyId}
        editionId={editionId}
        requireEditable
        requiredBindings={["site", "tickets"]}
      >
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
      title="Annual Festival results"
      description="The game freezes these results after automatic settlement."
    >
      {query.isLoading ? (
        <p role="status">Loading Festival results…</p>
      ) : !query.data ? (
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <HistoryStat
            label="Dates"
            value={`${query.data.dates?.startsOn ?? "—"} – ${
              query.data.dates?.endsOn ?? "—"
            }`}
          />
          <HistoryStat
            label="Attendance"
            value={(query.data.attendance ?? 0).toLocaleString("en-GB")}
          />
          <HistoryStat
            label="Audience rating"
            value={`${query.data.audienceScore ?? "—"}/100`}
          />
          <HistoryStat
            label="Company result"
            value={query.data.profitabilityBand.replaceAll("_", " ")}
          />
          <HistoryStat
            label="Headliners"
            value={query.data.headliners.map(String).join(", ") || "—"}
          />
          <HistoryStat
            label="Reputation change"
            value={`${query.data.reputationChange >= 0 ? "+" : ""}${
              query.data.reputationChange
            }`}
          />
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
