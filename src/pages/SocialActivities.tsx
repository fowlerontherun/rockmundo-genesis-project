import { Link } from "react-router-dom";
import { CalendarPlus, Coffee, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SOCIAL_ACTIVITY_CATALOG } from "@/features/social-activities/catalog";

export default function SocialActivities() {
  const suggested = SOCIAL_ACTIVITY_CATALOG.filter((a) => ["coffee", "team_dinner", "tour_downtime", "conflict_resolution", "quiet_catch_up", "gig_afterparty"].includes(a.activity_type));
  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-2xl font-semibold">Social activities</h2><p className="text-muted-foreground">Arrange hangouts, meals, celebrations and band-bonding time that uses the shared invitation and schedule systems.</p></div>
      <Button asChild><Link to="/social/activities/new"><CalendarPlus className="mr-2 h-4 w-4" />Create activity</Link></Button>
    </div>
    <div className="grid gap-3 md:grid-cols-3" aria-label="Social activity sections">
      {["Upcoming", "Invitations", "Hosting", "Completed", "Band activities", "Recent memories"].map((section) => <Card key={section}><CardHeader className="pb-2"><CardTitle className="text-base">{section}</CardTitle><CardDescription>Private participant details only.</CardDescription></CardHeader><CardContent><p className="text-sm text-muted-foreground">No {section.toLowerCase()} yet.</p></CardContent></Card>)}
    </div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />Suggested activities</CardTitle><CardDescription>Explainable prompts based on band tension, new members, tours, releases and morale can appear here.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">
      {suggested.map((activity) => <div key={activity.activity_type} className="rounded-lg border p-3"><div className="flex items-center justify-between gap-2"><h3 className="font-medium">{activity.display_name}</h3><Badge variant="outline">{activity.duration_options.join("/")} min</Badge></div><p className="mt-1 text-sm text-muted-foreground">{activity.description}</p><div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground"><span><Users className="mr-1 inline h-3 w-3" />{activity.minimum_participants}-{activity.maximum_participants}</span><span><Coffee className="mr-1 inline h-3 w-3" />{activity.location_type.join(", ")}</span><span>Mood {activity.mood_effect >= 0 ? "+" : ""}{activity.mood_effect}</span><span>Stress {activity.stress_effect}</span></div></div>)}
    </CardContent></Card>
  </div>;
}
