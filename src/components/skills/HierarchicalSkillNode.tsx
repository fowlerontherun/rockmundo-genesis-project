import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Lock, ChevronRight, TrendingUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { spendSkillXp } from "@/utils/progression";
import { toast } from "sonner";

interface SkillNodeProps {
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
  children?: React.ReactNode;
  isLocked?: boolean;
  xpBalance?: number;
  onTrain?: () => void;
}

const getTierColor = (tier: 'basic' | 'professional' | 'mastery') => {
  switch (tier) {
    case 'basic': return 'bg-green-500/10 text-green-700 border-green-500/30';
    case 'professional': return 'bg-blue-500/10 text-blue-700 border-blue-500/30';
    case 'mastery': return 'bg-purple-500/10 text-purple-700 border-purple-500/30';
  }
};

const getTrainingCost = (tier: 'basic' | 'professional' | 'mastery') => {
  switch (tier) {
    case 'basic': return 10;
    case 'professional': return 25;
    case 'mastery': return 50;
  }
};

export const HierarchicalSkillNode = ({ 
  skill, 
  progress, 
  tier, 
  children, 
  isLocked,
  xpBalance = 0,
  onTrain
}: SkillNodeProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const queryClient = useQueryClient();
  const hasChildren = !!children;
  
  const level = progress?.current_level || 0;
  const xp = progress?.current_xp || 0;
  const requiredXp = progress?.required_xp || 100;
  const progressPercent = (xp / requiredXp) * 100;
  
  const standardCost = getTrainingCost(tier);
  // Allow spending whatever XP they have left if less than standard cost
  const cost = xpBalance > 0 && xpBalance < standardCost ? xpBalance : standardCost;
  const canAfford = xpBalance > 0;
  const maxLevel = tier === 'basic' ? 10 : tier === 'professional' ? 20 : 30;
  const isMaxed = level >= maxLevel;

  const trainMutation = useMutation({
    mutationFn: () => spendSkillXp({
      skillSlug: skill.slug,
      amount: cost
    }),
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
    <div className="space-y-2">
      <Card 
        className={cn(
          "transition-all hover:shadow-md",
          isLocked && "opacity-60"
        )}
      >
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1">
                {hasChildren && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="hover:bg-accent rounded p-1 transition-colors"
                  >
                    <ChevronRight 
                      className={cn(
                        "h-4 w-4 transition-transform",
                        isExpanded && "rotate-90"
                      )} 
                    />
                  </button>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold">{skill.display_name}</h4>
                    {isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  {skill.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {skill.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={getTierColor(tier)} variant="outline">
                  {tier}
                </Badge>
                <Badge variant="secondary">
                  Lv {level}
                </Badge>
              </div>
            </div>

            {!isLocked && (
              <>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{xp} / {requiredXp} XP</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <Progress value={progressPercent} className="h-1.5" />
                
                <Button
                  onClick={() => trainMutation.mutate()}
                  disabled={!canAfford || isMaxed || trainMutation.isPending || isLocked}
                  className="w-full h-7 text-xs"
                  size="sm"
                >
                  {isMaxed ? "Maxed" : (
                    <>
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Train - {cost} XP
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {hasChildren && isExpanded && (
        <div className="ml-6 pl-4 border-l-2 border-border/50 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
};
