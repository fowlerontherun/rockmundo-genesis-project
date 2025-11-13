import { awardShows } from "@/data/awardShows";
import { useGameData } from "@/hooks/useGameData";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Award as AwardIcon, CalendarDays, MapPin, Star, Users } from "lucide-react";

const scheduleLabels: Record<keyof (typeof awardShows)[number]["schedule"], string> = {
  nominationsOpen: "Nominations",
  shortlistAnnounced: "Shortlist Reveal",
  votingWindow: "Voting",
  rehearsalDay: "Rehearsal",
  ceremony: "Ceremony",
};

export default function AwardShows() {
  const { profile } = useGameData();
  const stageIdentity =
    (profile as any)?.stage_name || profile?.display_name || profile?.username || "your project";

  return (
    <div className="container mx-auto space-y-12 px-4 py-10">
      <header className="space-y-4 text-center md:text-left">
        <Badge variant="secondary" className="text-sm uppercase tracking-wide">
          Awards Network Preview
        </Badge>
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">London Award Shows</h1>
          <p className="mx-auto max-w-3xl text-muted-foreground md:mx-0 md:text-base">
            Rockmundo is mapping the capital&apos;s prestige circuits so {stageIdentity} can plan nomination campaigns,
            voting pushes, and performance narratives ahead of the live data feeds. Each showcase below outlines
            rehearsal windows, category sourcing, and the exact fame boosts tied to attendance and wins.
          </p>
        </div>
        <div className="grid gap-4 rounded-lg border border-dashed border-primary/40 bg-muted/10 p-6 md:grid-cols-2">
          <div className="space-y-2 text-left">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <AwardIcon className="h-5 w-5 text-primary" />
              Why prep now?
            </h2>
            <p className="text-sm text-muted-foreground">
              Build momentum by aligning release cadences and tour stops with the nomination sourcing windows. These
              placeholders will later sync to real ticketing, stream deltas, and influencer reach metrics.
            </p>
          </div>
          <div className="space-y-2 text-left">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Star className="h-5 w-5 text-primary" />
              Fame acceleration
            </h2>
            <p className="text-sm text-muted-foreground">
              Attendance and wins layer onto your fame ledger. Plan for the ceremonies that best fit your sonic identity
              and performance capacity to maximize the reputation lift.
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-8 lg:grid-cols-2">
        {awardShows.map((show) => (
          <Card key={show.id} className="flex flex-col justify-between">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="uppercase tracking-wide">
                  {show.year}
                </Badge>
                <Badge variant="outline" className="border-dashed">
                  {show.schedule.ceremony}
                </Badge>
              </div>
              <div className="space-y-2">
                <CardTitle className="text-2xl">{show.show_name}</CardTitle>
                <CardDescription>{show.overview}</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  {show.district}
                </span>
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  {show.schedule.rehearsalDay}
                </span>
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  {show.broadcastPartners.join(" • ")}
                </span>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Categories preview
                </h3>
                <div className="flex flex-wrap gap-2">
                  {show.categories.map((category) => (
                    <Badge key={`${show.id}-${category.name}`} variant="secondary" className="whitespace-nowrap">
                      {category.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <section className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Timeline windows
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(show.schedule).map(([key, value]) => (
                    <div
                      key={`${show.id}-${key}`}
                      className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground"
                    >
                      <p className="font-semibold text-foreground">{scheduleLabels[key as keyof typeof scheduleLabels]}</p>
                      <p>{value}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Nomination sourcing
                </h4>
                <div className="space-y-3 text-sm text-muted-foreground">
                  {show.categories.map((category) => (
                    <div key={`${show.id}-${category.name}-source`} className="rounded-lg border border-border/60 p-4">
                      <p className="text-sm font-semibold text-foreground">{category.name}</p>
                      <p className="text-xs uppercase tracking-wide text-primary/80">Focus: {category.focus}</p>
                      <p className="mt-2">{category.nominationSource}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{category.description}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Voting breakdown
                </h4>
                <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 text-sm text-muted-foreground">
                  <div className="flex flex-wrap gap-6 text-foreground">
                    <span className="font-semibold">Player influence: {(show.voting.playerWeight * 100).toFixed(0)}%</span>
                    <span className="font-semibold">NPC guilds: {(show.voting.npcWeight * 100).toFixed(0)}%</span>
                    <span className="font-semibold">Industry jury: {(show.voting.industryJuryWeight * 100).toFixed(0)}%</span>
                  </div>
                  <p className="mt-2">{show.voting.notes}</p>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Attendance & winner rewards
                </h4>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                    <p className="text-sm font-semibold text-foreground">Ceremony attendance</p>
                    <p>{show.rewards.attendanceFameBoost}</p>
                    <p className="mt-2 text-xs uppercase tracking-wide text-primary/80">Plan: Ensure check-in scans complete.</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                    <p className="text-sm font-semibold text-foreground">Award victory</p>
                    <p>{show.rewards.winnerFameBoost}</p>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                      {show.rewards.additionalPerks.map((perk) => (
                        <li key={`${show.id}-${perk}`}>{perk}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Performance roster (4 slots · 2 songs each)
                </h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Slot</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Performer</TableHead>
                      <TableHead>Songs</TableHead>
                      <TableHead className="hidden md:table-cell">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {show.performanceSlots.map((slot) => (
                      <TableRow key={`${show.id}-${slot.slotLabel}`}>
                        <TableCell className="font-medium">{slot.slotLabel}</TableCell>
                        <TableCell>{slot.stage}</TableCell>
                        <TableCell>{slot.performer}</TableCell>
                        <TableCell>{slot.songs.join(" • ")}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">{slot.notes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {show.performanceSlots.length !== 4 && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                    Placeholder roster must maintain exactly four bands with two-song sets.
                  </p>
                )}
              </section>
            </CardContent>
          </Card>
        ))}
      </section>

      <footer className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
        These award profiles will evolve as Rockmundo ingests live partner data, unlocking automatic applications,
        campaign reminders, and real-time voting analytics. Until then, use these scaffolds to map out your London
        award season strategy and coordinate your crew.
      </footer>
    </div>
  );
}
