import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, Check, ChevronDown, ChevronUp, Zap, Shield, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STAGE_BEHAVIORS,
  getStarterBehaviors,
  getUnlockableBehaviors,
  type StageBehaviorDefinition,
} from "@/utils/stageBehaviors";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface StageBehaviorSelectorProps {
  currentBehavior: string;
  unlockedBehaviors: string[];
  onSelect: (behaviorKey: string) => void;
  isUpdating?: boolean;
}

function BehaviorCard({
  behavior,
  isSelected,
  isLocked,
  onSelect,
  isUpdating,
}: {
  behavior: StageBehaviorDefinition;
  isSelected: boolean;
  isLocked: boolean;
  onSelect: () => void;
  isUpdating?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className={cn(
        "relative transition-all duration-200 cursor-pointer border-2",
        isSelected
          ? "border-primary bg-primary/5 shadow-md"
          : isLocked
          ? "border-muted opacity-60 cursor-not-allowed"
          : "border-border hover:border-primary/50 hover:shadow-sm"
      )}
      onClick={() => !isLocked && !isUpdating && onSelect()}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl flex-shrink-0">{behavior.emoji}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-sm">{behavior.name}</h4>
                {isSelected && (
                  <Badge variant="default" className="text-xs px-1.5 py-0">
                    <Check className="h-3 w-3 mr-0.5" /> Active
                  </Badge>
                )}
                {isLocked && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    <Lock className="h-3 w-3 mr-0.5" /> Locked
                  </Badge>
                )}
                {!behavior.isStarter && !isLocked && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0 border-primary/50 text-primary">
                    <Zap className="h-3 w-3 mr-0.5" /> Unlocked
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {behavior.description}
              </p>
            </div>
          </div>
        </div>

        {/* Quick preview of key modifiers */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {behavior.modifiers.baseScoreBonus > 0 && (
            <Badge variant="outline" className="text-xs text-green-600 border-green-600/30">
              <TrendingUp className="h-3 w-3 mr-0.5" />+{behavior.modifiers.baseScoreBonus}% Score
            </Badge>
          )}
          {behavior.modifiers.baseScoreBonus < 0 && (
            <Badge variant="outline" className="text-xs text-red-500 border-red-500/30">
              <TrendingDown className="h-3 w-3 mr-0.5" />{behavior.modifiers.baseScoreBonus}% Score
            </Badge>
          )}
          {behavior.modifiers.fameMultiplier > 1.05 && (
            <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30">
              +{Math.round((behavior.modifiers.fameMultiplier - 1) * 100)}% Fame
            </Badge>
          )}
          {behavior.modifiers.chemistryEffect < 0.95 && (
            <Badge variant="outline" className="text-xs text-red-500 border-red-500/30">
              {Math.round((behavior.modifiers.chemistryEffect - 1) * 100)}% Chemistry
            </Badge>
          )}
          {behavior.modifiers.chemistryEffect > 1.05 && (
            <Badge variant="outline" className="text-xs text-green-600 border-green-600/30">
              +{Math.round((behavior.modifiers.chemistryEffect - 1) * 100)}% Chemistry
            </Badge>
          )}
          {behavior.modifiers.varianceMultiplier > 1.15 && (
            <Badge variant="outline" className="text-xs text-orange-500 border-orange-500/30">
              High Variance
            </Badge>
          )}
          {behavior.modifiers.varianceMultiplier < 0.85 && (
            <Badge variant="outline" className="text-xs text-blue-500 border-blue-500/30">
              <Shield className="h-3 w-3 mr-0.5" />Consistent
            </Badge>
          )}
        </div>

        {/* Expandable pros/cons */}
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger
            className="flex items-center gap-1 text-xs text-muted-foreground mt-2 hover:text-foreground transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Hide" : "Show"} details
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {behavior.pros.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-green-600 mb-1">Pros</p>
                <ul className="space-y-0.5">
                  {behavior.pros.map((pro, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                      <span className="text-green-500 mt-0.5">✓</span> {pro}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {behavior.cons.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-500 mb-1">Cons</p>
                <ul className="space-y-0.5">
                  {behavior.cons.map((con, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                      <span className="text-red-500 mt-0.5">✗</span> {con}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {isLocked && behavior.unlockRequirement && (
              <div className="p-2 rounded bg-muted/50 border border-border">
                <p className="text-xs font-medium flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Unlock Requirement
                </p>
                <p className="text-xs text-muted-foreground">{behavior.unlockRequirement.description}</p>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

export function StageBehaviorSelector({
  currentBehavior,
  unlockedBehaviors,
  onSelect,
  isUpdating,
}: StageBehaviorSelectorProps) {
  const starters = getStarterBehaviors();
  const unlockables = getUnlockableBehaviors();

  const isUnlocked = (key: string) =>
    STAGE_BEHAVIORS[key]?.isStarter || unlockedBehaviors.includes(key);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-5 w-5 text-primary" />
          Stage Behavior
        </CardTitle>
        <CardDescription className="text-xs">
          Choose how you perform on stage. Each style has unique pros and cons that affect your gig scores, fame gain, and crowd reactions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Starter behaviors */}
        <div>
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Base Behaviors
          </h5>
          <div className="grid gap-2 md:grid-cols-2">
            {starters.map((b) => (
              <BehaviorCard
                key={b.key}
                behavior={b}
                isSelected={currentBehavior === b.key}
                isLocked={false}
                onSelect={() => onSelect(b.key)}
                isUpdating={isUpdating}
              />
            ))}
          </div>
        </div>

        {/* Unlockable behaviors */}
        {unlockables.length > 0 && (
          <div>
            <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Advanced Behaviors
            </h5>
            <div className="grid gap-2 md:grid-cols-2">
              {unlockables.map((b) => (
                <BehaviorCard
                  key={b.key}
                  behavior={b}
                  isSelected={currentBehavior === b.key}
                  isLocked={!isUnlocked(b.key)}
                  onSelect={() => onSelect(b.key)}
                  isUpdating={isUpdating}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
