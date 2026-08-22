import { Link, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Crown, Landmark, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useCityMayor, useIsCurrentMayor } from "@/hooks/useMayorDashboard";
import { useCityLaws } from "@/hooks/useCityLaws";
import { useMayorPolitics } from "@/hooks/useMayorPolitics";
import { MayorBudgetTab } from "@/components/city/MayorBudgetTab";
import { MayorProjectsTab } from "@/components/city/MayorProjectsTab";
import { MayorPublicRelationsTab } from "@/components/city/MayorPublicRelationsTab";
import { MayorPromiseTracker } from "@/components/city/MayorPromiseTracker";
import { MayorOfficeOverview } from "@/components/city/MayorOfficeOverview";
import { MayorLawPolicyEditor } from "@/components/city/MayorLawPolicyEditor";
import { MayorCityServicesTab } from "@/components/city/MayorCityServicesTab";
import { MayorPublicOpinionTab } from "@/components/city/MayorPublicOpinionTab";
import { MayorElectionTermTab } from "@/components/city/MayorElectionTermTab";
import { MayorHistoryTab } from "@/components/city/MayorHistoryTab";
import {
  getMayorOfficeSection,
  MAYOR_OFFICE_SECTION_DESCRIPTIONS,
  MAYOR_OFFICE_SECTION_TITLES,
} from "@/config/mayorOfficeNavigation";

export default function MayorDashboard() {
  const { cityId } = useParams<{ cityId: string }>();
  const { search } = useLocation();
  const { profileId } = useActiveProfile();
  const section = getMayorOfficeSection(search);

  const { data: city, isLoading: cityLoading } = useQuery({
    queryKey: ["city", cityId, "mayor-office"],
    queryFn: async () => {
      if (!cityId) return null;
      const { data, error } = await supabase
        .from("cities")
        .select("id, name, country, population, music_scene, local_bonus, venues")
        .eq("id", cityId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!cityId,
  });

  const { data: isMayor, isLoading: mayorCheckLoading } = useIsCurrentMayor(cityId);
  const { data: mayor, isLoading: mayorLoading } = useCityMayor(cityId);
  const { data: currentLaws, isLoading: lawsLoading } = useCityLaws(cityId);
  const { data: politics } = useMayorPolitics(profileId);

  const loading = cityLoading || mayorCheckLoading || mayorLoading || lawsLoading;

  if (loading) {
    return (
      <FMPageScaffold title="City Hall" subtitle="Loading the Mayor's Office" icon={Crown} backTo={`/cities/${cityId}`} backLabel="Back to City">
        <div className="space-y-3 animate-pulse">
          <div className="h-20 rounded-lg bg-muted" />
          <div className="grid gap-3 md:grid-cols-4">
            <div className="h-28 rounded-lg bg-muted" />
            <div className="h-28 rounded-lg bg-muted" />
            <div className="h-28 rounded-lg bg-muted" />
            <div className="h-28 rounded-lg bg-muted" />
          </div>
          <div className="h-64 rounded-lg bg-muted" />
        </div>
      </FMPageScaffold>
    );
  }

  if (!cityId || !city || !isMayor || !mayor) {
    return (
      <FMPageScaffold title="City Hall" subtitle="Mayor access required" icon={Crown} backTo={cityId ? `/cities/${cityId}` : "/cities"} backLabel="Back to City">
        <Card className="py-12 text-center">
          <CardContent>
            <Crown className="mx-auto mb-4 h-16 w-16 text-muted-foreground opacity-40" />
            <h2 className="mb-2 text-xl font-semibold">Mayor's Office unavailable</h2>
            <p className="mx-auto max-w-xl text-muted-foreground">
              This management area is reserved for the current mayor of the city. You can still view the city's public governance, election and law information from the city page.
            </p>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  return (
    <FMPageScaffold
      title={`City Hall — ${city.name}`}
      subtitle="Mayor's Office"
      icon={Crown}
      backTo={`/cities/${cityId}`}
      backLabel={`Public ${city.name} page`}
      className="max-w-[1500px]"
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            <TrendingUp className="mr-1 h-3 w-3" /> {Number(mayor.approval_rating ?? 50).toFixed(0)}% approval
          </Badge>
          <Button size="sm" variant="outline" asChild>
            <Link to={`/cities/${cityId}/election`}>Election</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/world-parliament"><Landmark className="mr-1 h-3.5 w-3.5" /> Parliament</Link>
          </Button>
        </div>
      }
    >
      <div className="mb-5 rounded-lg border bg-muted/15 px-4 py-3">
        <div className="text-lg font-semibold">{MAYOR_OFFICE_SECTION_TITLES[section]}</div>
        <div className="mt-0.5 text-sm text-muted-foreground">{MAYOR_OFFICE_SECTION_DESCRIPTIONS[section]}</div>
      </div>

      {section === "overview" && <MayorOfficeOverview city={city} mayor={mayor} politics={politics} />}

      {section === "treasury" && (
        <MayorBudgetTab
          cityId={cityId}
          mayorSalary={Number((mayor as any).salary_per_week ?? 1000)}
          corruptionScore={Number((mayor as any).corruption_score ?? 0)}
        />
      )}

      {section === "projects" && <MayorProjectsTab cityId={cityId} politics={politics} />}

      {section === "laws" && currentLaws && <MayorLawPolicyEditor cityId={cityId} currentLaws={currentLaws} />}

      {section === "services" && currentLaws && <MayorCityServicesTab city={city} laws={currentLaws} />}

      {section === "opinion" && <MayorPublicOpinionTab cityId={cityId} mayor={mayor} />}

      {section === "promises" && <MayorPromiseTracker cityId={cityId} />}

      {section === "communications" && (
        <MayorPublicRelationsTab cityId={cityId} mayorId={mayor.id ?? null} politics={politics} />
      )}

      {section === "elections" && <MayorElectionTermTab cityId={cityId} mayor={mayor} />}

      {section === "history" && <MayorHistoryTab cityId={cityId} />}
    </FMPageScaffold>
  );
}
