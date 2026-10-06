import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock3, Gift, UserRound } from "lucide-react";
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
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          {checks.map(([label, complete]) => (
            <div key={label} className="flex gap-2 rounded border bg-card/70 p-3 text-xs">
              {complete ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!data.qualified ? <Button asChild size="sm"><Link to="/home"><UserRound className="mr-2 h-4 w-4" />Continue your first steps</Link></Button> : null}
          {data.referrer?.profile_id ? <Button asChild size="sm" variant="outline"><Link to={`/player/${data.referrer.profile_id}`}>View your referrer</Link></Button> : null}
          <p className="text-xs text-muted-foreground">No reward is triggered by registration alone; qualification requires genuine account age and play activity.</p>
        </div>
      </CardContent>
    </Card>
  );
}
