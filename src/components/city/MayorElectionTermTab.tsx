import { Link } from "react-router-dom";
import { differenceInCalendarDays, format } from "date-fns";
import { CalendarDays, CheckCircle2, Crown, Users, Vote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useCityElection, useCityElectionHistory, useElectionCandidates } from "@/hooks/useCityElections";

interface Props {
  cityId: string;
  mayor: any;
}

export function MayorElectionTermTab({ cityId, mayor }: Props) {
  const { data: election } = useCityElection(cityId);
  const { data: history } = useCityElectionHistory(cityId);
  const { data: candidates } = useElectionCandidates(election?.id);

  const start = mayor?.term_start ? new Date(mayor.term_start) : null;
  const end = mayor?.term_end ? new Date(mayor.term_end) : null;
  const totalDays = start && end ? Math.max(1, differenceInCalendarDays(end, start)) : null;
  const elapsedDays = start ? Math.max(0, differenceInCalendarDays(new Date(), start)) : 0;
  const progress = totalDays ? Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100)) : 0;
  const remaining = end ? Math.max(0, differenceInCalendarDays(end, new Date())) : null;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Crown className="h-4 w-4" /> Current term</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <TermMetric label="Term began" value={start ? format(start, "d MMM yyyy") : "Unknown"} />
              <TermMetric label="Term ends" value={end ? format(end, "d MMM yyyy") : "Open ended"} />
              <TermMetric label="Remaining" value={remaining == null ? "—" : `${remaining} days`} />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Term progress</span><span>{progress.toFixed(0)}%</span></div>
              <Progress value={progress} className="h-2.5" />
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">Approval {Number(mayor?.approval_rating ?? 50).toFixed(0)}%</Badge>
              <Badge variant="outline">Policies {Number(mayor?.policies_enacted ?? 0)}</Badge>
              <Badge variant="outline">Projects {Number(mayor?.projects_completed ?? 0)}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" /> Annual election cycle</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <TimelineRow month="1 Oct" label="Nominations open" />
            <TimelineRow month="1 Dec" label="Voting opens" />
            <TimelineRow month="1 Jan" label="Election completes & winner takes office" />
            <p className="pt-1 text-xs text-muted-foreground">The governance worker now creates and advances this lifecycle automatically.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base"><Vote className="h-4 w-4" /> Current election</CardTitle>
            <Button size="sm" variant="outline" asChild><Link to={`/cities/${cityId}/election`}>Open public election page</Link></Button>
          </div>
        </CardHeader>
        <CardContent>
          {!election ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No nomination or voting phase is active right now.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge className="capitalize">{election.status}</Badge>
                <Badge variant="outline">Election year {election.election_year}</Badge>
                <Badge variant="outline">{election.total_votes ?? 0} votes</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <TermMetric label="Nominations close" value={format(new Date(election.nomination_end), "d MMM yyyy")} />
                <TermMetric label="Voting closes" value={format(new Date(election.voting_end), "d MMM yyyy")} />
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Users className="h-4 w-4" /> Candidates</div>
                {!candidates?.length ? (
                  <p className="text-sm text-muted-foreground">No approved candidates yet.</p>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {candidates.map((candidate) => (
                      <div key={candidate.id} className="rounded-lg border p-3">
                        <div className="font-medium">{candidate.profile?.stage_name ?? "Candidate"}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{candidate.campaign_slogan || "No campaign slogan"}</div>
                        {election.status === "voting" && <Badge variant="secondary" className="mt-2">{candidate.vote_count ?? 0} votes</Badge>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4" /> Election history</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!history?.length ? (
            <p className="text-sm text-muted-foreground">No election history recorded yet.</p>
          ) : history.slice(0, 8).map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              <div>
                <div className="font-medium">{row.election_year} election</div>
                <div className="text-xs text-muted-foreground">{format(new Date(row.voting_start), "d MMM yyyy")} – {format(new Date(row.voting_end), "d MMM yyyy")}</div>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="capitalize">{row.status}</Badge>
                <Badge variant="secondary">{row.total_votes ?? 0} votes</Badge>
                {row.voter_turnout_pct != null && <Badge variant="secondary">{Number(row.voter_turnout_pct).toFixed(1)}% turnout</Badge>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function TermMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-muted/15 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-semibold">{value}</div></div>;
}

function TimelineRow({ month, label }: { month: string; label: string }) {
  return <div className="flex items-center gap-3"><Badge variant="outline" className="w-16 justify-center">{month}</Badge><span>{label}</span></div>;
}
