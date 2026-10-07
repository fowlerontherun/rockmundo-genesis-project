import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock3, Gift, Music2, UserRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Welcome = {
  referred: boolean;
  bound_at?: string;
  source?: string;
  qualified?: boolean;
  referrer?: { profile_id?: string | null; name?: string | null };
  band?: { band_id?: string | null; name?: string | null };
  qualification?: {
    email_confirmed: boolean;
    account_age_met: boolean;
    activity_met: boolean;
    hours_played: number;
    experience: number;
    level: number;
  };
};

export function ReferralWelcomeCard({ profileId }: { profileId?: string | null }) {
  const { data } = useQuery({
    queryKey: ["referral-welcome", profileId],
    enabled: !!profileId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_my_referral_welcome", { p_profile_id: profileId });
      if (error) throw error;
      return data as Welcome;
    },
  });

  if (!data?.referred) return null;
  const q = data.qualification;
  const completed = [q?.email_confirmed, q?.account_age_met, q?.activity_met].filter(Boolean).length;
  const progress = data.qualified ? 100 : Math.round((completed / 3) * 100);
  const activityProgress = Math.max(
    Math.min(100, Math.round(((q?.hours_played ?? 0) / 1) * 100)),
    Math.min(100, Math.round(((q?.experience ?? 0) / 100) * 100)),
    Math.min(100, Math.round((((q?.level ?? 1) - 1) / 1) * 100)),
  );
  const checks = [
    ["Confirm your account email", q?.email_confirmed],
    ["Keep the account for at least 24 hours", q?.account_age_met],
    ["Start playing: reach level 2, 100 XP, or 1 hour played", q?.activity_met],
  ] as const;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Gift className="h-4 w-4 text-primary" />Welcome through a RockMundo invite</CardTitle>
            <CardDescription>
              {data.referrer?.name ? <>{data.referrer.name} invited you into the RockMundo scene.</> : <>You joined through another player's referral.</>}
              {" "}Build your musician normally and your progress will qualify the referral automatically.
            </CardDescription>
          </div>
          <Badge variant={data.qualified ? "default" : "secondary"}>{data.qualified ? "Referral qualified" : "Activation in progress"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs"><span className="font-medium">Recruit activation</span><span className="text-muted-foreground">{progress}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
        </div>
        {data.band?.band_id && data.band?.name ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-card/70 p-3"><div className="flex items-center gap-2"><Music2 className="h-4 w-4 text-primary" /><div><p className="text-sm font-medium">Recruited for {data.band.name}</p><p className="text-xs text-muted-foreground">Your referral is linked to this band. Joining still uses the normal band invitation and acceptance flow.</p></div></div><Button asChild size="sm" variant="outline"><Link to={`/band/${data.band.band_id}`}>View band</Link></Button></div> : null}
        <div className="grid gap-2 sm:grid-cols-3">
          {checks.map(([label, complete]) => (
            <div key={label} className="flex gap-2 rounded border bg-card/70 p-3 text-xs">
              {complete ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span>{label}</span>
            </div>
          ))}
        </div>
        {!q?.activity_met ? <div className="rounded-lg border bg-card/70 p-3"><div className="flex items-center justify-between gap-3 text-xs"><span className="font-medium">Play activity</span><span className="text-muted-foreground">{activityProgress}% to the easiest current threshold</span></div><p className="mt-1 text-xs text-muted-foreground">Current: level {q?.level ?? 1} · {q?.experience ?? 0}/100 XP · {(q?.hours_played ?? 0).toFixed(1)}/1 hour. Any one of these activity targets completes this step.</p><div className="mt-2 flex flex-wrap gap-2"><Button asChild size="sm"><Link to="/booking/songwriting">Write your first song</Link></Button><Button asChild size="sm" variant="outline"><Link to="/schedule">Open schedule</Link></Button></div></div> : null}
        <div className="flex flex-wrap items-center gap-2">
          {!data.qualified ? <Button asChild size="sm"><Link to="/home"><UserRound className="mr-2 h-4 w-4" />Continue your first steps</Link></Button> : null}
          {data.referrer?.profile_id ? <Button asChild size="sm" variant="outline"><Link to={`/player/${data.referrer.profile_id}`}>View your referrer</Link></Button> : null}
          <p className="text-xs text-muted-foreground">No reward is triggered by registration alone; qualification requires genuine account age and play activity.</p>
        </div>
      </CardContent>
    </Card>
  );
}
