import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Film, DollarSign, Star, Clapperboard, Users, Calendar, Building2 } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { FMPageSkeleton } from "@/components/fm/FMPageSkeleton";

interface FilmProductionRow {
  id: string;
  title: string;
  film_type: string | null;
  genre: string | null;
  description: string | null;
  min_fame_required: number | null;
  compensation_min: number | null;
  compensation_max: number | null;
  fame_boost: number | null;
  fan_boost: number | null;
  filming_duration_days: number | null;
  is_available: boolean | null;
  studio_id: string | null;
  film_studios?: { id: string; name: string | null } | null;
}

const formatCompensation = (min: number | null, max: number | null) => {
  if (!min && !max) return "TBD";
  const formatNum = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
  };
  if (min && max) return `${formatNum(min)} - ${formatNum(max)}`;
  if (min) return `From ${formatNum(min)}`;
  if (max) return `Up to ${formatNum(max)}`;
  return "TBD";
};

const FilmDetail = () => {
  const { id } = useParams<{ id: string }>();

  const { data: film, isLoading } = useQuery({
    queryKey: ["film-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("film_productions")
        .select("*, film_studios(id, name)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as FilmProductionRow | null;
    },
  });

  if (isLoading) {
    return (
      <FMPageScaffold
        title="Film Production"
        subtitle="Loading details…"
        icon={Film}
        backTo="/media/films"
        backLabel="Back to Films"
      >
        <FMPageSkeleton kpiCount={3} actionCount={1} bodyBlocks={2} />
      </FMPageScaffold>
    );
  }

  if (!film) {
    return (
      <FMPageScaffold
        title="Film Not Found"
        subtitle="This production no longer exists"
        icon={Film}
        backTo="/media/films"
        backLabel="Back to Films"
      >
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Film className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>The requested film production could not be loaded.</p>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  const statusBadge = (
    <Badge variant={film.is_available ? "default" : "secondary"}>
      {film.is_available ? "Available" : "Unavailable"}
    </Badge>
  );

  return (
    <FMPageScaffold
      title={film.title}
      subtitle={film.film_type ? film.film_type.replace(/_/g, " ") : "Film production"}
      icon={Film}
      backTo="/media/films"
      backLabel="Back to Films"
      headerActions={statusBadge}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" /> Compensation
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {formatCompensation(film.compensation_min, film.compensation_max)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-muted-foreground" /> Minimum Fame
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{film.min_fame_required ?? 0}</CardContent>
        </Card>

        {film.filming_duration_days != null && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" /> Filming Duration
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{film.filming_duration_days} days</CardContent>
          </Card>
        )}

        {(film.fame_boost || film.fan_boost) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" /> Rewards
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              {film.fame_boost ? <div className="text-green-600">+{film.fame_boost} fame</div> : null}
              {film.fan_boost ? <div className="text-green-600">+{film.fan_boost} fans</div> : null}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clapperboard className="h-4 w-4 text-muted-foreground" /> Production Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            {film.genre && <Badge variant="outline">{film.genre}</Badge>}
            {film.film_type && <Badge variant="outline">{film.film_type.replace(/_/g, " ")}</Badge>}
          </div>
          {film.film_studios?.name && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>Studio: {film.film_studios.name}</span>
            </div>
          )}
          {film.description ? (
            <p className="text-muted-foreground whitespace-pre-line">{film.description}</p>
          ) : (
            <p className="text-muted-foreground italic">No description provided.</p>
          )}
        </CardContent>
      </Card>
    </FMPageScaffold>
  );
};

export default FilmDetail;
