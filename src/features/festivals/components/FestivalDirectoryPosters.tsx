import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, Music2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  listFestivalDirectoryCards,
  type FestivalDirectoryCard,
} from "@/features/festivals/directoryService";

const POSTER_THEMES = [
  "from-fuchsia-950 via-purple-900 to-amber-500",
  "from-cyan-950 via-blue-900 to-lime-500",
  "from-rose-950 via-red-900 to-orange-400",
  "from-emerald-950 via-teal-900 to-yellow-400",
  "from-indigo-950 via-violet-900 to-pink-500",
  "from-slate-950 via-zinc-800 to-red-500",
] as const;

function themeForFestival(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0;
  }
  return POSTER_THEMES[Math.abs(hash) % POSTER_THEMES.length];
}

function formatFestivalDates(startsOn: string, endsOn: string) {
  const start = new Date(`${startsOn}T12:00:00`);
  const end = new Date(`${endsOn}T12:00:00`);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const sameDay = startsOn === endsOn;

  if (sameDay) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(start);
  }

  if (sameMonth) {
    const monthYear = new Intl.DateTimeFormat("en-GB", {
      month: "short",
      year: "numeric",
    }).format(end);
    return `${start.getDate()}–${end.getDate()} ${monthYear}`;
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  });
  return `${formatter.format(start)} – ${formatter.format(end)} ${end.getFullYear()}`;
}

function FestivalPosterCard({ festival }: { festival: FestivalDirectoryCard }) {
  const theme = themeForFestival(festival.festivalEditionId);
  const artists = festival.confirmedArtists;

  return (
    <Card className="overflow-hidden border-0 bg-transparent shadow-xl">
      <CardContent className={`relative min-h-[360px] overflow-hidden bg-gradient-to-br ${theme} p-0 text-white`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_32%),linear-gradient(to_bottom,transparent,rgba(0,0,0,0.45))]" />
        <div className="absolute -right-10 -top-8 rotate-12 text-[7rem] font-black uppercase tracking-tighter text-white/10">
          LIVE
        </div>

        <div className="relative flex min-h-[360px] flex-col justify-between p-6 sm:p-7">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.35em] text-white/75">RockMundo Festival</p>
                <h2 className="mt-2 max-w-xl text-4xl font-black uppercase leading-none tracking-tight sm:text-5xl">
                  {festival.festivalName}
                </h2>
                {festival.tagline ? (
                  <p className="mt-2 max-w-xl text-sm font-semibold text-white/85">{festival.tagline}</p>
                ) : null}
              </div>
              <Badge className="border border-white/35 bg-black/25 text-white backdrop-blur-sm hover:bg-black/25">
                {festival.status.replaceAll("_", " ")}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-white/90">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                {formatFestivalDates(festival.startsOn, festival.endsOn)}
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {festival.cityName ?? "City TBA"}
              </span>
              {festival.expectedCapacity ? (
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {festival.expectedCapacity.toLocaleString("en-GB")} capacity
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-white/20 bg-black/20 p-5 backdrop-blur-sm">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-white/70">
              <Music2 className="h-4 w-4" />
              Confirmed artists
            </div>
            {artists.length ? (
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                {artists.map((artist, index) => (
                  <span key={artist.id} className={index === 0 ? "text-2xl font-black uppercase" : "text-lg font-extrabold uppercase"}>
                    {artist.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm font-semibold text-white/70">Line-up announcements coming soon.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FestivalDirectoryPosters() {
  const directory = useQuery({
    queryKey: ["festival-directory-cards"],
    queryFn: listFestivalDirectoryCards,
    staleTime: 60_000,
  });

  if (directory.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading festival line-up…</p>;
  }

  if (directory.isError) {
    return <p className="text-sm text-destructive">Festival listings could not be loaded.</p>;
  }

  if (!directory.data?.length) {
    return <p className="text-sm text-muted-foreground">No upcoming festivals are currently listed.</p>;
  }

  return (
    <section className="space-y-3" aria-label="Festival listings">
      <div>
        <h2 className="text-lg font-semibold">Upcoming festivals</h2>
        <p className="text-sm text-muted-foreground">Dates, city and confirmed artists from each festival organiser.</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {directory.data.map((festival) => (
          <FestivalPosterCard key={festival.festivalEditionId} festival={festival} />
        ))}
      </div>
    </section>
  );
}
