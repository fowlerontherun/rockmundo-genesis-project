import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, MapPin, Music2, Sparkles, Ticket, Wristband } from "lucide-react";
import { festivalRoutes } from "@/features/festivals/routes";
import { useAuth } from "@/hooks/use-auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FestivalModeRewards } from "../attendance/FestivalModeRewards";
import { useMyFestivalAttendance } from "../attendance/useFestivalAttendance";
import { usePublicFestivalDirectory } from "../application/useFestivalLaunch";
import { formatFestivalLaunchMoney } from "../domain/festivalLaunch";

const attendanceLabel = (status: string) => {
  switch (status) {
    case "attending":
      return "At Festival now";
    case "ready_to_check_in":
      return "Ready to check in";
    case "ticketed":
      return "Ticket booked";
    case "completed":
      return "Attended";
    case "left_early":
      return "Attendance ended";
    default:
      return status.replaceAll("_", " ");
  }
};

const hasFestivalStory = (status: string) => ["completed", "left_early"].includes(status);

export default function PublicFestivalDirectory() {
  const { user } = useAuth();
  const { data = [], isLoading, isError } = usePublicFestivalDirectory();
  const { data: attendance = [] } = useMyFestivalAttendance(Boolean(user));
  const [storyAttendanceId, setStoryAttendanceId] = useState<string | null>(null);

  const activeAttendance = useMemo(
    () =>
      attendance
        .filter((item) => !["cancelled", "refunded"].includes(item.status))
        .sort((left, right) => {
          const priority = (status: string) => {
            if (status === "attending") return 0;
            if (["ready_to_check_in", "ticketed"].includes(status)) return 1;
            if (status === "completed") return 2;
            if (status === "left_early") return 3;
            return 4;
          };
          return priority(left.status) - priority(right.status);
        }),
    [attendance],
  );

  const storyAttendance = activeAttendance.find((item) => item.id === storyAttendanceId) ?? null;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header className="rounded-3xl bg-gradient-to-br from-violet-950 via-slate-950 to-fuchsia-950 p-6 text-white md:p-8">
        <Badge className="mb-3">World festivals</Badge>
        <h1 className="text-4xl font-black tracking-tight md:text-6xl">Find your next Festival</h1>
        <p className="mt-3 max-w-2xl text-violet-100">
          Browse real company-run Festivals, see the line-up, buy an admission ticket and turn up as your active character.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link to="/festival-opportunities">
              <Music2 className="mr-2 h-4 w-4" /> Apply to perform
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
            <Link to="/festivals/history">Festival history</Link>
          </Button>
        </div>
      </header>

      {user && activeAttendance.length > 0 ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wristband className="h-5 w-5" /> My Festivals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {activeAttendance.map((item) => {
                const storyAvailable = hasFestivalStory(item.status);
                const storyOpen = storyAttendanceId === item.id;
                return (
                  <div key={item.id} className="rounded-lg border bg-background p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="font-medium">{item.festivalName}</span>
                        <Badge variant="secondary" className="ml-2 capitalize">
                          {attendanceLabel(item.status)}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to={festivalRoutes.publicCompany(item.festivalSlug)}>
                          {item.status === "attending" ? "Return to Festival" : "Festival details"}
                        </Link>
                      </Button>
                      {storyAvailable ? (
                        <Button
                          size="sm"
                          variant={storyOpen ? "secondary" : "default"}
                          onClick={() => setStoryAttendanceId(storyOpen ? null : item.id)}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          {storyOpen ? "Hide story" : "View my Festival story"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {storyAttendance ? (
        <section aria-label={`Festival story for ${storyAttendance.festivalName}`} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Permanent attendee recap</p>
              <h2 className="text-2xl font-bold">{storyAttendance.festivalName}</h2>
            </div>
            <Button variant="ghost" onClick={() => setStoryAttendanceId(null)}>Close story</Button>
          </div>
          <FestivalModeRewards attendance={storyAttendance} />
        </section>
      ) : null}

      {isLoading && <p role="status">Loading launched Festivals…</p>}
      {isError && <p role="alert">The Festival directory is temporarily unavailable.</p>}
      {!isLoading && !isError && data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No public Festivals are currently on sale or announced.
          </CardContent>
        </Card>
      ) : null}

      <section aria-label="Festival directory" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.map((festival) => {
          const lowest = festival.ticketProducts
            .filter((product) => product.productClass === "admission" && product.availableQuantity > 0)
            .sort((left, right) => left.totalMinor - right.totalMinor)[0];
          const myAttendance = activeAttendance.find(
            (item) => item.festivalLaunchId === festival.id,
          );
          const days = Math.max(
            0,
            Math.ceil((Date.parse(festival.startsAt) - Date.now()) / 86_400_000),
          );
          const announcedArtists = Array.from(
            new Set(festival.timetable.map((entry) => entry.artistName).filter(Boolean)),
          );
          const lineupPreview = announcedArtists.slice(0, 3);
          const remainingArtists = Math.max(0, announcedArtists.length - lineupPreview.length);

          return (
            <Link
              key={festival.id}
              to={festivalRoutes.publicCompany(festival.slug)}
              className="group rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <Card className="h-full overflow-hidden transition group-hover:-translate-y-1 group-hover:border-primary">
                <div
                  className="h-40 bg-gradient-to-br from-violet-700 to-fuchsia-600 bg-cover bg-center"
                  style={festival.heroImageReference ? { backgroundImage: `url(${festival.heroImageReference})` } : undefined}
                />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{festival.name}</CardTitle>
                      {festival.tagline ? (
                        <p className="mt-1 text-sm text-muted-foreground">{festival.tagline}</p>
                      ) : null}
                    </div>
                    <Badge variant={festival.soldOut ? "destructive" : "secondary"}>
                      {festival.soldOut ? "Sold out" : festival.launchStatus.replaceAll("_", " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {myAttendance ? (
                    <div className="mb-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2">
                      <span className="font-medium">{attendanceLabel(myAttendance.status)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {hasFestivalStory(myAttendance.status)
                          ? "Your permanent Festival story is available in My Festivals above."
                          : "Open the Festival for tickets, check-in and your attendee experience."}
                      </span>
                    </div>
                  ) : null}
                  <p className="flex items-center gap-2">
                    <MapPin size={16} /> {festival.city}, {festival.country}
                  </p>
                  <p className="flex items-center gap-2">
                    <CalendarDays size={16} />
                    {new Date(festival.startsAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {days > 0 ? ` · ${days} day${days === 1 ? "" : "s"} to go` : ""}
                  </p>
                  {lineupPreview.length > 0 ? (
                    <div className="rounded-lg border bg-muted/30 p-2.5">
                      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <Music2 size={14} /> Announced line-up
                      </p>
                      <p className="font-semibold">
                        {lineupPreview.join(" · ")}
                        {remainingArtists > 0 ? ` · +${remainingArtists} more` : ""}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Line-up announcements coming soon.</p>
                  )}
                  <p className="flex items-center gap-2 font-semibold">
                    <Ticket size={16} />
                    {lowest
                      ? `From ${formatFestivalLaunchMoney(lowest.totalMinor, lowest.currency)}`
                      : festival.soldOut
                        ? "Admission sold out"
                        : "Sales opening soon"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {announcedArtists.length} announced act{announcedArtists.length === 1 ? "" : "s"} · {festival.stages.length} stage{festival.stages.length === 1 ? "" : "s"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
