import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Lock, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

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
}

const getTierColor = (tier: 'basic' | 'professional' | 'mastery') => {
  switch (tier) {
    case 'basic': return 'bg-green-500/10 text-green-700 border-green-500/30';
    case 'professional': return 'bg-blue-500/10 text-blue-700 border-blue-500/30';
    case 'mastery': return 'bg-purple-500/10 text-purple-700 border-purple-500/30';
  }
};

export const HierarchicalSkillNode = ({ skill, progress, tier, children, isLocked }: SkillNodeProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = !!children;
  
  const level = progress?.current_level || 0;
  const xp = progress?.current_xp || 0;
  const requiredXp = progress?.required_xp || 100;
  const progressPercent = (xp / requiredXp) * 100;

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
