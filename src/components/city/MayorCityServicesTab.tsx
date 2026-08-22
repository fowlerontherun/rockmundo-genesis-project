import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, CalendarDays, CircleDollarSign, Music, Train, Users } from "lucide-react";
import { useCityProjects } from "@/hooks/useCityProjects";
import type { CityLaws } from "@/types/city-governance";
import type { MayorOfficeCitySummary } from "@/components/city/MayorOfficeOverview";

interface Props {
  city: MayorOfficeCitySummary;
  laws: CityLaws;
}

export function MayorCityServicesTab({ city, laws }: Props) {
  const { data: projects } = useCityProjects(city.id);
  const active = projects?.filter((project) => project.status === "in_progress") ?? [];
  const completed = projects?.filter((project) => project.status === "completed") ?? [];

  const activeByCategory = (category: string) => active.filter((project) => project.project_type?.category === category).length;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">City services & operating environment</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This view brings together the authoritative city attributes, current policy settings and investments that influence day-to-day life. It deliberately shows only metrics the city currently stores rather than inventing hidden service scores.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ServiceCard
          icon={Train}
          title="Transport & access"
          metric={`$${Number(laws.travel_tax ?? 0).toLocaleString()} travel tax`}
          details={[
            `${activeByCategory("infrastructure")} infrastructure project${activeByCategory("infrastructure") === 1 ? "" : "s"} in progress`,
            "Transport upgrades can improve the city's development attributes when completed.",
          ]}
        />
        <ServiceCard
          icon={Music}
          title="Music & culture"
          metric={`Music scene ${city.music_scene ?? 0}`}
          details={[
            `${laws.promoted_genres?.length ?? 0} promoted genre${laws.promoted_genres?.length === 1 ? "" : "s"}`,
            `${laws.prohibited_genres?.length ?? 0} prohibited genre${laws.prohibited_genres?.length === 1 ? "" : "s"}`,
          ]}
        />
        <ServiceCard
          icon={Building2}
          title="Venues & live events"
          metric={`${city.venues ?? 0} city venues`}
          details={[
            laws.max_concert_capacity ? `City capacity cap: ${Number(laws.max_concert_capacity).toLocaleString()}` : "No city-wide concert capacity cap",
            laws.festival_permit_required ? "Festival permit required" : "Festival permit not required",
          ]}
        />
        <ServiceCard
          icon={Users}
          title="Community"
          metric={`Local bonus ${city.local_bonus ?? 0}`}
          details={[
            `Population: ${Number(city.population ?? 0).toLocaleString()}`,
            `Community events funding: $${Number(laws.community_events_funding ?? 0).toLocaleString()}`,
          ]}
        />
        <ServiceCard
          icon={CircleDollarSign}
          title="Permits & local costs"
          metric={`$${Number(laws.venue_permit_cost ?? 0).toLocaleString()} venue permit`}
          details={[
            `Busking licence: $${Number(laws.busking_license_fee ?? 0).toLocaleString()}`,
            `Sales tax: ${Number(laws.sales_tax_rate ?? 0)}%`,
          ]}
        />
        <ServiceCard
          icon={CalendarDays}
          title="Development pipeline"
          metric={`${active.length} active project${active.length === 1 ? "" : "s"}`}
          details={[
            `${completed.length} project${completed.length === 1 ? "" : "s"} completed historically`,
            "Projects are settled automatically when their timers finish.",
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
