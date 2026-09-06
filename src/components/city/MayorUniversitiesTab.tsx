import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Loader2, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";

interface Props {
  cityId: string;
}

type University = {
  id: string;
  name: string;
  city: string | null;
  prestige: number | null;
  quality_of_learning: number | null;
  academic_cost_modifier: number | string | null;
  mayor_fee_modifier: number | string | null;
  course_cost_modifier: number | string | null;
  quality_investment_total: number | string | null;
  last_quality_upgrade_at: string | null;
  last_prestige_upgrade_at: string | null;
};

const UPGRADE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const ERROR_MESSAGES: Record<string, string> = {
  university_management_auth_required: "You must be logged in to manage a university.",
  university_management_profile_forbidden: "That character does not belong to your account.",
  university_management_not_found: "That university could not be found.",
  university_management_mayor_required: "Only the current mayor can manage universities in this city.",
  university_management_quality_max: "Teaching quality is already at the maximum rating.",
  university_management_prestige_max: "Prestige is already at the maximum rating.",
  university_management_quality_cooldown: "Teaching quality can only be upgraded once every 7 days.",
  university_management_prestige_cooldown: "Prestige can only be upgraded once every 7 days.",
  university_management_insufficient_treasury: "The city treasury does not have enough available funds.",
  university_management_fee_out_of_range: "Course-fee policy must be between 80% and 120%.",
  university_management_fee_step_invalid: "Course-fee policy must move in 5% steps.",
};

function friendlyError(error: unknown) {
  const raw = error instanceof Error ? error.message : String((error as any)?.message ?? error ?? "Unknown error");
  const key = Object.keys(ERROR_MESSAGES).find((candidate) => raw.includes(candidate));
  return key ? ERROR_MESSAGES[key] : raw;
}

function qualityUpgradeCost(quality: number) {
  return Math.round(5000 + quality ** 2 * 3);
}

function prestigeUpgradeCost(prestige: number) {
  return Math.round(8000 + prestige ** 2 * 4);
}

function cooldownInfo(lastUpgradeAt: string | null) {
  if (!lastUpgradeAt) return { active: false, nextAt: null as Date | null, label: null as string | null };

  const nextAt = new Date(new Date(lastUpgradeAt).getTime() + UPGRADE_COOLDOWN_MS);
  const remainingMs = nextAt.getTime() - Date.now();
  if (remainingMs <= 0) return { active: false, nextAt, label: null as string | null };

  const totalHours = Math.ceil(remainingMs / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const remaining = days > 0 ? `${days}d ${hours}h` : `${hours}h`;

  return {
    active: true,
    nextAt,
    label: `Available in ${remaining} (${nextAt.toLocaleString()})`,
  };
}

export function MayorUniversitiesTab({ cityId }: Props) {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  const { data: universities = [], isLoading } = useQuery({
    queryKey: ["mayor-universities", cityId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("universities")
        .select("id,name,city,prestige,quality_of_learning,academic_cost_modifier,mayor_fee_modifier,course_cost_modifier,quality_investment_total,last_quality_upgrade_at,last_prestige_upgrade_at")
        .eq("city_id", cityId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as University[];
    },
    enabled: Boolean(cityId),
  });

  const { data: treasury } = useQuery({
    queryKey: ["city-treasury", cityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("city_treasury")
        .select("balance,pending_commitments")
        .eq("city_id", cityId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(cityId),
  });

  const availableTreasury = useMemo(
    () => Number(treasury?.balance ?? 0) - Number(treasury?.pending_commitments ?? 0),
    [treasury],
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["mayor-universities", cityId] });
    queryClient.invalidateQueries({ queryKey: ["city-treasury", cityId] });
    queryClient.invalidateQueries({ queryKey: ["mayor-actions-log", cityId] });
  };

  const upgradeQuality = useMutation({
    mutationFn: async (universityId: string) => {
      if (!profileId) throw new Error("You must select a character first.");
      const { data, error } = await (supabase as any).rpc("upgrade_university_quality", {
        p_university_id: universityId,
        p_profile_id: profileId,
      });
      if (error) throw new Error(friendlyError(error));
      return data;
    },
    onSuccess: () => {
      refresh();
      toast.success("University teaching quality upgraded. This upgrade is now on a 7-day cooldown.");
    },
    onError: (error: Error) => toast.error(friendlyError(error)),
  });

  const upgradePrestige = useMutation({
    mutationFn: async (universityId: string) => {
      if (!profileId) throw new Error("You must select a character first.");
      const { data, error } = await (supabase as any).rpc("upgrade_university_prestige", {
        p_university_id: universityId,
        p_profile_id: profileId,
      });
      if (error) throw new Error(friendlyError(error));
      return data;
    },
    onSuccess: () => {
      refresh();
      toast.success("University prestige upgraded. This upgrade is now on a 7-day cooldown.");
    },
    onError: (error: Error) => toast.error(friendlyError(error)),
  });

  const setFee = useMutation({
    mutationFn: async ({ universityId, modifier }: { universityId: string; modifier: number }) => {
      if (!profileId) throw new Error("You must select a character first.");
      const { data, error } = await (supabase as any).rpc("set_university_course_fee", {
        p_university_id: universityId,
        p_profile_id: profileId,
        p_fee_modifier: modifier,
      });
      if (error) throw new Error(friendlyError(error));
      return data;
    },
    onSuccess: () => {
      refresh();
      toast.success("University course-fee policy updated.");
    },
    onError: (error: Error) => toast.error(friendlyError(error)),
  });

  if (isLoading) {
    return <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading city universities…</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><GraduationCap className="h-5 w-5" /> University Investment</CardTitle>
          <CardDescription>
            Use city funds to improve local university teaching quality and prestige. Each upgrade type has its own 7-day cooldown.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          Available treasury: <span className="font-semibold">${Math.max(0, Math.round(availableTreasury)).toLocaleString()}</span>
        </CardContent>
      </Card>

      {universities.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">This city has no university linked to City Hall yet.</CardContent></Card>
      ) : universities.map((university) => {
        const quality = Number(university.quality_of_learning ?? 50);
        const prestige = Number(university.prestige ?? 50);
        const qualityCost = qualityUpgradeCost(quality);
        const prestigeCost = prestigeUpgradeCost(prestige);
        const busy = upgradeQuality.isPending || upgradePrestige.isPending || setFee.isPending;
        const fee = Number(university.mayor_fee_modifier ?? 1);
        const qualityCooldown = cooldownInfo(university.last_quality_upgrade_at);
        const prestigeCooldown = cooldownInfo(university.last_prestige_upgrade_at);

        return (
          <Card key={university.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">{university.name}</CardTitle>
                  <CardDescription>{university.city}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">Quality {quality}/100</Badge>
                  <Badge variant="secondary">Prestige {prestige}/100</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <div className="mb-1 flex items-center gap-2 font-medium"><Sparkles className="h-4 w-4" /> Teaching quality</div>
                  <p className="mb-3 text-xs text-muted-foreground">Invest in staff, facilities and teaching resources. Each investment adds +1 quality, up to 100.</p>
                  {qualityCooldown.active && <p className="mb-2 text-xs font-medium text-amber-600 dark:text-amber-400">{qualityCooldown.label}</p>}
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={busy || quality >= 100 || availableTreasury < qualityCost || qualityCooldown.active}
                    onClick={() => upgradeQuality.mutate(university.id)}
                  >
                    {quality >= 100 ? "Maximum quality" : qualityCooldown.active ? "Quality upgrade on cooldown" : `Upgrade to ${quality + 1} — $${qualityCost.toLocaleString()}`}
                  </Button>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="mb-1 flex items-center gap-2 font-medium"><Star className="h-4 w-4" /> Prestige</div>
                  <p className="mb-3 text-xs text-muted-foreground">Fund showcases, partnerships and reputation-building. Each investment adds +1 prestige, up to 100.</p>
                  {prestigeCooldown.active && <p className="mb-2 text-xs font-medium text-amber-600 dark:text-amber-400">{prestigeCooldown.label}</p>}
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={busy || prestige >= 100 || availableTreasury < prestigeCost || prestigeCooldown.active}
                    onClick={() => upgradePrestige.mutate(university.id)}
                  >
                    {prestige >= 100 ? "Maximum prestige" : prestigeCooldown.active ? "Prestige upgrade on cooldown" : `Upgrade to ${prestige + 1} — $${prestigeCost.toLocaleString()}`}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="mb-2 font-medium">Course-fee policy</div>
                <p className="mb-3 text-xs text-muted-foreground">Set the mayor-controlled tuition multiplier. This changes fees, not academic quality or prestige.</p>
                <div className="flex flex-wrap gap-2">
                  {[0.8, 0.9, 1, 1.1, 1.2].map((modifier) => (
                    <Button
                      key={modifier}
                      size="sm"
                      variant={Math.abs(fee - modifier) < 0.001 ? "default" : "outline"}
                      disabled={busy || Math.abs(fee - modifier) < 0.001}
                      onClick={() => setFee.mutate({ universityId: university.id, modifier })}
                    >
                      {Math.round(modifier * 100)}%
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
