import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Building2, CalendarDays, CircleDollarSign, HeartPulse, Music, ShieldCheck, Train, Users } from "lucide-react";
import { useCityProjects } from "@/hooks/useCityProjects";
import { useCityDevelopment, useCityGameplayModifiers } from "@/hooks/useCityDevelopment";
import type { CityLaws } from "@/types/city-governance";
import type { MayorOfficeCitySummary } from "@/components/city/MayorOfficeOverview";
import { MayorFestivalPermitQueue } from "@/components/city/MayorFestivalPermitQueue";
import { CITY_DEVELOPMENT_LABELS, cityRatingBand, type CityDevelopmentRatingKey } from "@/types/city-development";

interface Props {
  city: MayorOfficeCitySummary;
  laws: CityLaws;
}

const RATINGS: CityDevelopmentRatingKey[] = [
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

const pct = (multiplier: number | undefined) => {
  if (multiplier == null) return "—";
  const delta = Math.round((multiplier - 1) * 100);
  return `${delta >= 0 ? "+" : ""}${delta}%`;
};

export function MayorCityServicesTab({ city, laws }: Props) {
  const { data: projects } = useCityProjects(city.id);
  const { data: development } = useCityDevelopment(city.id);
  const { data: modifiers } = useCityGameplayModifiers(city.id);
  const active = projects?.filter((project) => project.status === "in_progress") ?? [];
  const completed = projects?.filter((project) => project.status === "completed") ?? [];

  const activeByCategory = (category: string) => active.filter((project) => project.project_type?.category === category).length;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">City development & gameplay effects</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ratings run from 0 to 100, with 50 as the neutral baseline. Completed City Hall projects move these ratings permanently. Gameplay modifiers are deliberately bounded so city investment matters without replacing band, player or venue progression.
          </p>
        </CardContent>
      </Card>

      {development && (
        <Card>
          <CardHeader><CardTitle className="text-base">Development ratings</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {RATINGS.map((key) => (
                <RatingCard key={key} label={CITY_DEVELOPMENT_LABELS[key]} value={development[key]} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <MayorFestivalPermitQueue cityId={city.id} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ServiceCard
          icon={Train}
          title="Transport & access"
          metric={`Transport ${development?.transport ?? 50}`}
          details={[
            `${pct(modifiers?.travel_cost_multiplier)} travel cost modifier`,
            `${pct(modifiers?.travel_duration_multiplier)} travel duration modifier`,
            `$${Number(laws.travel_tax ?? 0).toLocaleString()} configured travel tax`,
            `${activeByCategory("infrastructure")} infrastructure project${activeByCategory("infrastructure") === 1 ? "" : "s"} in progress`,
          ]}
        />
        <ServiceCard
          icon={Music}
          title="Music, culture & demand"
          metric={`Music scene ${development?.music_scene ?? 50}`}
          details={[
            `${pct(modifiers?.audience_demand_multiplier)} live audience demand potential`,
            `${pct(modifiers?.festival_demand_multiplier)} festival demand potential`,
            `${laws.promoted_genres?.length ?? 0} promoted genre${laws.promoted_genres?.length === 1 ? "" : "s"}`,
          ]}
        />
        <ServiceCard
          icon={Building2}
          title="Infrastructure & logistics"
          metric={`Infrastructure ${development?.infrastructure ?? 50}`}
          details={[
            `${pct(modifiers?.logistics_multiplier)} logistics modifier`,
            `${city.venues ?? 0} city venues`,
            laws.max_concert_capacity ? `City capacity cap: ${Number(laws.max_concert_capacity).toLocaleString()}` : "No city-wide concert capacity cap",
          ]}
        />
        <ServiceCard
          icon={ShieldCheck}
          title="Public safety"
          metric={`Safety ${development?.public_safety ?? 50}`}
          details={[
            `${pct(modifiers?.incident_risk_multiplier)} event incident-risk modifier`,
            laws.noise_curfew_hour ? `Noise curfew: ${laws.noise_curfew_hour}:00` : "No noise curfew",
            laws.festival_permit_required ? "Festival permit required" : "Festival permit not required",
          ]}
        />
        <ServiceCard
          icon={HeartPulse}
          title="Healthcare & quality of life"
          metric={`Healthcare ${development?.healthcare ?? 50}`}
          details={[
            `${pct(modifiers?.recovery_multiplier)} recovery potential`,
            `Quality of life ${development?.quality_of_life ?? 50}`,
            `Population: ${Number(city.population ?? 0).toLocaleString()}`,
          ]}
        />
        <ServiceCard
          icon={CircleDollarSign}
          title="Economy & tax base"
          metric={`Economy ${development?.economy ?? 50}`}
          details={[
            `${pct(modifiers?.economy_revenue_multiplier)} local commercial revenue modifier`,
            `${pct(modifiers?.tax_base_multiplier)} tax-base potential`,
            `Income tax ${Number(laws.income_tax_rate ?? 0)}% · sales tax ${Number(laws.sales_tax_rate ?? 0)}%`,
          ]}
        />
        <ServiceCard
          icon={Users}
          title="Education & local talent"
          metric={`Education ${development?.education ?? 50}`}
          details={[
            `${pct(modifiers?.local_talent_multiplier)} local talent potential`,
            `Culture ${development?.culture ?? 50}`,
            `Community funding: $${Number(laws.community_events_funding ?? 0).toLocaleString()}`,
          ]}
        />
        <ServiceCard
          icon={CalendarDays}
          title="Development pipeline"
          metric={`${active.length} active project${active.length === 1 ? "" : "s"}`}
          details={[
            `${completed.length} project${completed.length === 1 ? "" : "s"} completed historically`,
            "Ratings update atomically when projects complete.",
            "Every development change is retained in city history.",
          ]}
        />
      </div>

      {active.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Services currently being improved</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {active.slice(0, 8).map((project) => (
              <div key={project.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div>
                  <div className="font-medium">{project.name}</div>
                  <div className="text-xs text-muted-foreground">{project.description}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{project.project_type?.category?.replace(/_/g, " ") ?? "project"}</Badge>
                  <Badge variant="secondary">${Number(project.cost).toLocaleString()}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RatingCard({ label, value }: { label: string; value: number }) {
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

function ServiceCard({ icon: Icon, title, metric, details }: { icon: any; title: string; metric: string; details: string[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><Icon className="h-4 w-4" /> {title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-2 text-lg font-semibold">{metric}</div>
        <div className="space-y-1 text-xs text-muted-foreground">
          {details.map((detail) => <div key={detail}>• {detail}</div>)}
        </div>
      </CardContent>
    </Card>
  );
}
