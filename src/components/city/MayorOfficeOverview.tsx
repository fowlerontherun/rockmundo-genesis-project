import { Link } from "react-router-dom";
import { differenceInCalendarDays, format } from "date-fns";
import {
  BarChart3,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Hammer,
  Landmark,
  Music,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useCityProjects, useCityTreasury } from "@/hooks/useCityProjects";
import { useCityElection } from "@/hooks/useCityElections";
import { useCityDevelopment } from "@/hooks/useCityDevelopment";
import { buildMayorOfficePath } from "@/config/mayorOfficeNavigation";
import { MayorPoliticsSidebar } from "@/components/city/MayorPoliticsSidebar";
import type { MayorPoliticsState } from "@/hooks/useMayorPolitics";
import { CITY_DEVELOPMENT_LABELS, cityRatingBand, type CityDevelopmentRatingKey } from "@/types/city-development";

export interface MayorOfficeCitySummary {
  id: string;
  name: string;
  country: string | null;
  population: number | null;
  music_scene: number | null;
  local_bonus: number | null;
  venues: number | null;
}

interface Props {
  city: MayorOfficeCitySummary;
  mayor: any;
  politics: MayorPoliticsState | undefined;
}

const money = (value: number) => `$${Math.round(value).toLocaleString()}`;

const OVERVIEW_RATINGS: CityDevelopmentRatingKey[] = [
  "economy",
  "infrastructure",
  "transport",
  "public_safety",
  "healthcare",
  "culture",
  "music_scene",
  "tourism",
  "quality_of_life",
  "education",
];

export function MayorOfficeOverview({ city, mayor, politics }: Props) {
  const { data: treasury } = useCityTreasury(city.id);
  const { data: projects } = useCityProjects(city.id);
  const { data: election } = useCityElection(city.id);
  const { data: development } = useCityDevelopment(city.id);

  const balance = Number(treasury?.balance ?? 0);
  const committed = Number(treasury?.pending_commitments ?? 0);
  const available = balance - committed;
  const activeProjects = projects?.filter((project) => project.status === "in_progress") ?? [];
  const approval = Number(mayor?.approval_rating ?? 50);
  const termStart = mayor?.term_start ? new Date(mayor.term_start) : null;
  const termEnd = mayor?.term_end ? new Date(mayor.term_end) : null;
  const today = new Date();
  const termLength = termStart && termEnd ? Math.max(1, differenceInCalendarDays(termEnd, termStart)) : null;
  const elapsed = termStart ? Math.max(0, differenceInCalendarDays(today, termStart)) : 0;
  const termProgress = termLength ? Math.min(100, Math.max(0, (elapsed / termLength) * 100)) : 0;
  const daysRemaining = termEnd ? Math.max(0, differenceInCalendarDays(termEnd, today)) : null;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={BarChart3}
          label="Approval"
          value={`${approval.toFixed(0)}%`}
          detail={approval >= 60 ? "Strong mandate" : approval >= 40 ? "Competitive" : "Under pressure"}
        />
        <KpiCard
          icon={CircleDollarSign}
          label="Available Treasury"
          value={money(available)}
          detail={`${money(committed)} committed`}
        />
        <KpiCard
          icon={Hammer}
          label="Active Projects"
          value={String(activeProjects.length)}
          detail={`${projects?.filter((project) => project.status === "completed").length ?? 0} completed`}
        />
        <KpiCard
          icon={CalendarDays}
          label="Term Remaining"
          value={daysRemaining == null ? "—" : `${daysRemaining} days`}
          detail={termEnd ? `Ends ${format(termEnd, "d MMM yyyy")}` : "No end date recorded"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Landmark className="h-4 w-4" /> Term command centre
                </CardTitle>
                <Badge variant="outline">{city.name}, {city.country ?? "Unknown country"}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>{termStart ? format(termStart, "d MMM yyyy") : "Term start unknown"}</span>
                  <span>{termEnd ? format(termEnd, "d MMM yyyy") : "Open-ended term"}</span>
                </div>
                <Progress value={termProgress} className="h-2" />
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <ActionCard
                  title="Treasury"
                  description="Review cash, commitments and historic city spending."
                  to={buildMayorOfficePath(city.id, "treasury")}
                />
                <ActionCard
                  title="Development"
                  description="Invest in upgrades that permanently change city ratings."
                  to={buildMayorOfficePath(city.id, "projects")}
                />
                <ActionCard
                  title="Policy"
                  description="Change taxes, permits, nightlife rules and music policy."
                  to={buildMayorOfficePath(city.id, "laws")}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">City development</CardTitle>
                <Button size="sm" variant="outline" asChild>
                  <Link to={buildMayorOfficePath(city.id, "services")}>View gameplay effects</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {development ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {OVERVIEW_RATINGS.map((key) => (
                    <DevelopmentRatingCard key={key} label={CITY_DEVELOPMENT_LABELS[key]} value={development[key]} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">City development ratings are being initialised.</p>
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <CityMetric icon={Users} label="Population" value={Number(city.population ?? 0).toLocaleString()} />
                <CityMetric icon={Building2} label="Venues" value={String(city.venues ?? 0)} />
                <CityMetric icon={Music} label="Legacy Music Scene" value={String(city.music_scene ?? 0)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Political calendar</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium">
                  {election ? `Election phase: ${election.status}` : "No active election phase"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {election
                    ? election.status === "nomination"
                      ? `Nominations close ${format(new Date(election.nomination_end), "d MMM yyyy")}`
                      : `Voting closes ${format(new Date(election.voting_end), "d MMM yyyy")}`
                    : "The annual election cycle will open nominations automatically on 1 October."}
                </div>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link to={buildMayorOfficePath(city.id, "elections")}>Open elections & term</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <MayorPoliticsSidebar politics={politics} />
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, detail }: { icon: any; label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}

function DevelopmentRatingCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/15 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Badge variant="outline">{value}</Badge>
      </div>
      <Progress value={value} className="my-2 h-1.5" />
      <div className="text-xs font-medium">{cityRatingBand(value)}</div>
    </div>
  );
}

function CityMetric({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function ActionCard({ title, description, to }: { title: string; description: string; to: string }) {
  return (
    <Link to={to} className="rounded-lg border bg-muted/15 p-3 transition-colors hover:bg-muted/35">
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </Link>
  );
}
