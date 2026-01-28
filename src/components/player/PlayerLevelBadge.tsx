import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Star, TrendingUp } from "lucide-react";
import { usePlayerLevel } from "@/hooks/usePlayerLevel";
import { useGameData } from "@/hooks/useGameData";

interface PlayerLevelBadgeProps {
  showProgress?: boolean;
  showTooltip?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const PlayerLevelBadge = ({ 
  showProgress = false, 
  showTooltip = true,
  size = "md",
  className = ""
}: PlayerLevelBadgeProps) => {
  const { profile, xpWallet, skills } = useGameData();
  
  const levelData = usePlayerLevel({
    xpWallet,
    skills,
    fame: profile?.fame ?? 0,
    attributeStars: 0, // Will integrate with attribute system later
  });

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-lg px-4 py-2",
  };

  const content = (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge 
        variant="outline" 
        className={`bg-primary/10 text-primary border-primary/30 ${sizeClasses[size]}`}
      >
        <Star className={`${size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4"} mr-1`} />
        Level {levelData.level}
      </Badge>
      
      {showProgress && levelData.level < 100 && (
        <div className="flex-1 min-w-[60px] max-w-[120px]">
          <Progress 
            value={levelData.levelProgress} 
            className="h-2 bg-muted"
          />
        </div>
      )}
    </div>
  );

  if (!showTooltip) {
    return content;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <TrendingUp className="h-4 w-4 text-primary" />
              Level {levelData.level} Progress
            </div>
            <div className="text-xs space-y-1 text-muted-foreground">
              <div className="flex justify-between">
                <span>Effective XP:</span>
                <span className="text-foreground">{levelData.effectiveXp.toLocaleString()}</span>
              </div>
              {levelData.level < 100 && (
                <>
                  <div className="flex justify-between">
                    <span>XP to Level {levelData.level + 1}:</span>
                    <span className="text-foreground">{levelData.xpToNextLevel.toLocaleString()}</span>
                  </div>
                  <Progress value={levelData.levelProgress} className="h-1.5 mt-1" />
                </>
              )}
              <div className="pt-1 border-t border-border mt-2">
                <div className="text-[10px] text-muted-foreground">
                  Level combines: Lifetime XP, Skills ({levelData.totalSkillLevels} total levels), and Fame
                </div>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
