import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { TrendingUp, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { spendSkillXp } from "@/utils/progression";
import { toast } from "sonner";
import { EducationSourceBadge, type EducationSource } from "./EducationSourceBadge";

interface CompactSkillRowProps {
  skill: {
    id: string;
    slug: string;
    display_name: string;
    description?: string | null;
  };
  progress: {
    current_level: number;
    current_xp: number;
    required_xp: number;
  } | null;
  tier: 'basic' | 'professional' | 'mastery';
  isLocked?: boolean;
  xpBalance?: number;
  educationSources?: EducationSource[];
  onTrain?: () => void;
}

const getTierColor = (tier: 'basic' | 'professional' | 'mastery') => {
  switch (tier) {
    case 'basic': return 'bg-green-500/10 text-green-700 border-green-500/30';
    case 'professional': return 'bg-blue-500/10 text-blue-700 border-blue-500/30';
    case 'mastery': return 'bg-purple-500/10 text-purple-700 border-purple-500/30';
  }
};

const getTrainingCost = (level: number) => Math.max(10, level * 10);

export const CompactSkillRow = ({
  skill,
  progress,
  tier,
  isLocked,
  xpBalance = 0,
  educationSources = [],
  onTrain
}: CompactSkillRowProps) => {
  const queryClient = useQueryClient();
  
  const level = progress?.current_level || 0;
  const xp = progress?.current_xp || 0;
  const requiredXp = progress?.required_xp || 100;
  const progressPercent = (xp / requiredXp) * 100;
  
  const standardCost = getTrainingCost(level);
  const cost = xpBalance > 0 && xpBalance < standardCost ? xpBalance : standardCost;
  const canAfford = xpBalance >= cost;
  const maxLevel = tier === 'basic' ? 10 : tier === 'professional' ? 20 : 30;
  const isMaxed = level >= maxLevel;
  const hasProgress = level > 0 || xp > 0;

  const trainMutation = useMutation({
    mutationFn: () => spendSkillXp({ skillSlug: skill.slug, amount: cost }),
    onSuccess: () => {
      toast.success(`${skill.display_name} trained!`);
      queryClient.invalidateQueries({ queryKey: ["gameData"] });
      onTrain?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to train skill");
    }
  });

  return (
    <div 
      className={cn(
        "flex items-center gap-3 p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors",
        isLocked && "opacity-60",
        !hasProgress && "opacity-70"
      )}
    >
      {/* Skill name and tier */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{skill.display_name}</span>
          {isLocked && <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
          <Badge className={cn("text-xs px-1.5", getTierColor(tier))} variant="outline">
            {tier.charAt(0).toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Education sources */}
      {educationSources.length > 0 && (
        <div className="flex gap-1 flex-shrink-0">
          {educationSources.slice(0, 3).map((source, i) => (
            <EducationSourceBadge key={`${source}-${i}`} source={source} />
          ))}
        </div>
      )}

      {/* Level */}
      <Badge variant="secondary" className="min-w-[50px] justify-center text-xs">
        Lv {level}
      </Badge>

      {/* XP Progress */}
      {!isLocked && (
        <div className="w-24 flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-0.5">
            <span>{xp}/{requiredXp}</span>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      )}

      {/* Train button */}
      {!isLocked && (
        <Button
          onClick={() => trainMutation.mutate()}
          disabled={!canAfford || isMaxed || trainMutation.isPending}
          size="sm"
          variant="outline"
          className="h-7 text-xs px-2 flex-shrink-0"
        >
          {isMaxed ? "Max" : (
            <>
              <TrendingUp className="w-3 h-3 mr-1" />
              {cost}
            </>
          )}
        </Button>
      )}
    </div>
  );
};
