import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Zap, Star } from "lucide-react";
import { format } from "date-fns";

export const PlayerGainsNews = () => {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: xpGains } = useQuery({
    queryKey: ["news-xp-gains", user?.id, today],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("experience_ledger")
        .select("xp_amount, activity_type, created_at")
        .eq("user_id", user.id)
        .gte("created_at", `${today}T00:00:00`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: skillGains } = useQuery({
    queryKey: ["news-skill-gains", user?.id, today],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("skill_improvements")
        .select("skill_name, previous_value, new_value, improvement_amount, improved_at")
        .eq("user_id", user.id)
        .gte("improved_at", `${today}T00:00:00`)
        .order("improved_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const totalXp = xpGains?.reduce((sum, g) => sum + (g.xp_amount || 0), 0) || 0;

  if (totalXp === 0 && (!skillGains || skillGains.length === 0)) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Your Progress Today
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {totalXp > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-warning" />
              <span className="font-semibold">XP Earned: +{totalXp.toLocaleString()} XP</span>
            </div>
            <div className="space-y-1 pl-6">
              {xpGains?.slice(0, 5).map((gain, index) => (
                <div key={index} className="text-sm text-muted-foreground flex justify-between">
                  <span className="capitalize">{gain.activity_type?.replace(/_/g, " ")}</span>
                  <Badge variant="outline" className="text-xs">+{gain.xp_amount}</Badge>
                </div>
              ))}
              {(xpGains?.length || 0) > 5 && (
                <p className="text-xs text-muted-foreground">
                  +{(xpGains?.length || 0) - 5} more activities...
                </p>
              )}
            </div>
          </div>
        )}

        {skillGains && skillGains.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-primary" />
              <span className="font-semibold">Skills Improved</span>
            </div>
            <div className="space-y-1 pl-6">
              {skillGains.map((skill, index) => (
                <div key={index} className="text-sm flex justify-between items-center">
                  <span className="capitalize">{skill.skill_name?.replace(/_/g, " ")}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {skill.previous_value} → {skill.new_value}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      +{skill.improvement_amount}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
