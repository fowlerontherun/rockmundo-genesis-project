import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollText, Lock, Unlock } from "lucide-react";
import type { MayorPoliticsState } from "@/hooks/useMayorPolitics";
import { POLITICS_THRESHOLDS } from "@/types/city-projects";

const SKILL_LABELS: Record<string, string> = {
  basic_public_speaking: 'Public Speaking',
  basic_negotiation: 'Negotiation',
  basic_governance: 'Governance',
  professional_diplomacy: 'Diplomacy',
  professional_campaign_strategy: 'Campaign Strategy',
  master_statecraft: 'Statecraft',
};

export function MayorPoliticsSidebar({ politics }: { politics: MayorPoliticsState | undefined }) {
  if (!politics) return null;
  const cap = POLITICS_THRESHOLDS.MASTER;

  const unlockRows: Array<{ label: string; on: boolean }> = [
    { label: 'Propose projects', on: politics.unlocks.proposeProjects },
    { label: 'Advanced projects', on: politics.unlocks.advancedProjects },
    { label: 'Press conferences', on: politics.unlocks.pressConferences },
    { label: 'Trade deals', on: politics.unlocks.tradeDeals },
    { label: 'Emergency decrees', on: politics.unlocks.decrees },
    { label: 'Referendums', on: politics.unlocks.referendums },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ScrollText className="h-4 w-4" /> Politics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {Object.entries(SKILL_LABELS).map(([slug, label]) => {
            const v = (politics.levels as Record<string, number>)[slug] ?? 0;
            return (
              <div key={slug}>
                <div className="flex justify-between text-xs">
                  <span>{label}</span>
                  <span className="text-muted-foreground">{v}</span>
                </div>
                <Progress value={(v / cap) * 100} className="h-1" />
              </div>
            );
          })}
        </div>

        <div className="pt-2 border-t space-y-1">
          {unlockRows.map(r => (
            <div key={r.label} className="flex items-center gap-2 text-xs">
              {r.on ? <Unlock className="h-3 w-3 text-success" /> : <Lock className="h-3 w-3 text-muted-foreground" />}
              <span className={r.on ? '' : 'text-muted-foreground'}>{r.label}</span>
            </div>
          ))}
        </div>

        {politics.unlocks.projectDiscount > 0 && (
          <Badge variant="secondary" className="w-full justify-center">
            Project discount: {politics.unlocks.projectDiscount}%
          </Badge>
        )}
        {politics.unlocks.campaignBoost > 0 && (
          <Badge variant="secondary" className="w-full justify-center">
            Vote boost: +{politics.unlocks.campaignBoost}%
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
