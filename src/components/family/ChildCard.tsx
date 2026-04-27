import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Baby, Sparkles, ChevronRight } from "lucide-react";
import { ScoreGauge } from "@/components/social/ScoreGauge";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import type { PlayerChild } from "@/hooks/useChildPlanning";

interface ChildCardProps {
  child: PlayerChild;
  className?: string;
}

const PLAYABILITY_CONFIG: Record<string, { label: string; color: string }> = {
  npc: { label: "NPC (0-5)", color: "bg-muted text-muted-foreground border-border" },
  guided: { label: "Guided (6-15)", color: "bg-social-chemistry/20 text-social-chemistry border-social-chemistry/30" },
  playable: { label: "Playable (16+)", color: "bg-social-love/20 text-social-love border-social-love/30" },
};

export function ChildCard({ child, className }: ChildCardProps) {
  const navigate = useNavigate();
  const playability = PLAYABILITY_CONFIG[child.playability_state] ?? PLAYABILITY_CONFIG.npc;
  const topPotentials = Object.entries(child.inherited_potentials)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <Card
      onClick={() => navigate(`/family/child/${child.id}`)}
      className={cn("border-border/50 hover:border-social-loyalty/40 transition-all cursor-pointer group", className)}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Baby className="h-4 w-4 text-social-loyalty" />
            <div>
              <p className="text-sm font-semibold">{child.name} {child.surname}</p>
              <p className="text-xs text-muted-foreground">Age {child.current_age}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={cn("text-[10px]", playability.color)}>
              {playability.label}
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {topPotentials.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Top Potentials
            </p>
            <div className="grid grid-cols-3 gap-2">
              {topPotentials.map(([skill, value]) => (
                <ScoreGauge
                  key={skill}
                  label={skill.charAt(0).toUpperCase() + skill.slice(1)}
                  value={value}
                  max={20}
                  color="social-chemistry"
                  variant="bar"
                  size="sm"
                />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <ScoreGauge label="Stability" value={child.emotional_stability} max={100} color="social-trust" variant="bar" size="sm" />
          <ScoreGauge label="Bond A" value={child.bond_parent_a} max={100} color="social-love" variant="bar" size="sm" />
          <ScoreGauge label="Bond B" value={child.bond_parent_b} max={100} color="social-loyalty" variant="bar" size="sm" />
        </div>
      </CardContent>
    </Card>
  );
}
