import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBandChemistry } from "@/hooks/useBandChemistry";
import { Heart, TrendingUp, TrendingDown, Users, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

export default function BandChemistry() {
  const { bandId } = useParams<{ bandId: string }>();
  const [userBandId, setUserBandId] = useState<string | null>(null);

  useEffect(() => {
    if (bandId) {
      setUserBandId(bandId);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;

      supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", data.user.id)
        .limit(1)
        .single()
        .then(({ data: member }) => {
          if (member) setUserBandId(member.band_id);
        });
    });
  }, [bandId]);

  const { band, events, members, chemistryBreakdown, latestSnapshot, isLoading } = useBandChemistry(userBandId || undefined);

  if (isLoading) {
    return (
      <FMPageScaffold title="Band Chemistry" icon={Heart} backTo="/hub/band">
        <p className="text-muted-foreground">Loading band chemistry data...</p>
      </FMPageScaffold>
    );
  }

  if (!band) {
    return (
      <FMPageScaffold title="Band Chemistry" icon={Heart} backTo="/hub/band">
        <Card>
          <CardHeader>
            <CardTitle>Band Chemistry</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Join or create a band to view chemistry metrics.</p>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  const chemistryLevel = latestSnapshot?.cohesion ?? band.chemistry_level ?? 0;
  const cohesionScore = latestSnapshot?.cohesion ?? band.cohesion_score ?? 0;
  const creativeSync = latestSnapshot?.creative_sync ?? 0;
  const liveSync = latestSnapshot?.live_sync ?? 0;
  const trust = latestSnapshot?.trust ?? 50;
  const reliability = latestSnapshot?.reliability ?? 50;
  const conflict = latestSnapshot?.conflict ?? 0;
  const daysTogether = band.days_together || 0;

  return (
    <FMPageScaffold
      title="Band Chemistry"
      subtitle="Monitor group dynamics, member contributions, and chemistry trends."
      icon={Heart}
      backTo="/hub/band"
    >

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Chemistry Level</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{chemistryLevel.toFixed(0)}/100</div>
            <Progress value={chemistryLevel} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {chemistryLevel >= 80 ? "Excellent harmony" : chemistryLevel >= 60 ? "Good synergy" : chemistryLevel >= 40 ? "Moderate chemistry" : "Needs work"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cohesion Score</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cohesionScore.toFixed(1)}</div>
            <Progress value={cohesionScore} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">Overall team unity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Days Together</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{daysTogether}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {daysTogether < 30 ? "New formation" : daysTogether < 90 ? "Building chemistry" : daysTogether < 180 ? "Established unit" : "Veteran group"}
            </p>
          </CardContent>
        </Card>
      </div>


      <div className="grid gap-4 md:grid-cols-5">
        {[
          ["Performance chemistry", liveSync, "Live timing and stage consistency"],
          ["Creative chemistry", creativeSync, "Writing and improvisation fit"],
          ["Trust", trust, "Confidence in commitments"],
          ["Reliability", reliability, "Attendance and role follow-through"],
          ["Conflict", conflict, conflict >= 50 ? "Tension may affect rehearsals" : "Calm working conditions"],
        ].map(([label, value, helper]) => (
          <Card key={label as string}>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{label}</CardTitle></CardHeader>
            <CardContent>
              <div className="text-xl font-semibold">{Number(value).toFixed(0)}/100</div>
              <Progress value={Number(value)} className="mt-2" aria-label={`${label} descriptive score`} />
              <p className="mt-2 text-xs text-muted-foreground">{helper}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events">Recent Events</TabsTrigger>
          <TabsTrigger value="members">Member Contributions</TabsTrigger>
          <TabsTrigger value="breakdown">Chemistry Breakdown</TabsTrigger>
          <TabsTrigger value="actions">Suggested Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Chemistry Events</CardTitle>
              <CardDescription>Recent interactions and their impact on band chemistry</CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No chemistry events yet. Start rehearsing or performing together!</p>
              ) : (
                <div className="space-y-3">
                  {events.map((event) => (
                    <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className="mt-1">
                        {event.chemistry_change > 0 ? (
                          <TrendingUp className="h-5 w-5 text-green-500" />
                        ) : event.chemistry_change < 0 ? (
                          <TrendingDown className="h-5 w-5 text-red-500" />
                        ) : (
                          <Heart className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium capitalize">{event.event_type.replace(/_/g, " ")}</p>
                          <Badge variant={event.chemistry_change > 0 ? "default" : event.chemistry_change < 0 ? "destructive" : "secondary"}>
                            {event.chemistry_change > 0 ? "+" : ""}{event.chemistry_change}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Member Contributions</CardTitle>
              <CardDescription>Individual chemistry contributions and leadership potential</CardDescription>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No band members found.</p>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center gap-4 p-3 rounded-lg border">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{member.instrument_role}</p>
                          {member.vocal_role && <Badge variant="outline">{member.vocal_role}</Badge>}
                          {member.can_be_leader && <Badge variant="secondary">Leadership Ready</Badge>}
                          {member.is_touring_member && <Badge>Touring</Badge>}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span>Chemistry: {member.chemistry_contribution || 0}</span>
                          <span>Votes: {member.leadership_votes || 0}</span>
                          <Badge variant="outline" className="text-xs">{member.member_status}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Chemistry Breakdown</CardTitle>
              <CardDescription>Distribution of chemistry events by impact</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-green-500/20 bg-green-500/5">
                  <span className="font-medium text-green-600 dark:text-green-400">Excellent (+5 or more)</span>
                  <Badge variant="default">{chemistryBreakdown.excellent}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
                  <span className="font-medium text-blue-600 dark:text-blue-400">Good (+1 to +5)</span>
                  <Badge variant="secondary">{chemistryBreakdown.good}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <span className="font-medium text-muted-foreground">Neutral (0)</span>
                  <Badge variant="outline">{chemistryBreakdown.neutral}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-orange-500/20 bg-orange-500/5">
                  <span className="font-medium text-orange-600 dark:text-orange-400">Poor (-1 to -5)</span>
                  <Badge variant="secondary">{chemistryBreakdown.poor}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                  <span className="font-medium text-red-600 dark:text-red-400">Terrible (-5 or less)</span>
                  <Badge variant="destructive">{chemistryBreakdown.terrible}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Suggested actions</CardTitle>
              <CardDescription>Improve chemistry through varied, server-authoritative collaboration instead of repeated trivial activity.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {["Schedule a focused rehearsal", "Start a jam session", "Co-write a song", "Review attendance concerns", "Hold a band meeting", "Resolve an agreement dispute"].map((action) => (
                <button key={action} className="rounded-lg border p-3 text-left text-sm hover:bg-muted" aria-label={action}>{action}</button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </FMPageScaffold>
  );
}
