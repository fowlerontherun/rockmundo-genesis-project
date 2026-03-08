import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ReactNode } from "react";

interface MemberInfo {
  name: string;
  instrumentRole: string;
  vocalRole?: string | null;
  performanceScore?: number;
  skillContribution?: number;
}

interface TopDownMemberPopoverProps {
  member: MemberInfo;
  children: ReactNode;
}

export const TopDownMemberPopover = ({ member, children }: TopDownMemberPopoverProps) => {
  const score = member.performanceScore || 0;
  const scoreColor = score >= 18
    ? 'text-green-400'
    : score >= 12
      ? 'text-yellow-400'
      : 'text-red-400';

  const energyState = score >= 20 ? '🔥 On Fire' : score >= 16 ? '⚡ Focused' : score >= 10 ? '🎵 Playing' : '😓 Struggling';

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-56 bg-black/90 border-primary/30 text-white p-3" side="top">
        <div className="space-y-2">
          <p className="font-bold text-sm truncate">{member.name}</p>
          <div className="flex items-center gap-1 flex-wrap">
            <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
              {member.instrumentRole}
            </Badge>
            {member.vocalRole && (
              <Badge variant="outline" className="text-[10px] border-accent/40 text-accent">
                {member.vocalRole}
              </Badge>
            )}
          </div>

          {/* Energy state */}
          <div className="text-[11px] text-muted-foreground">{energyState}</div>

          {member.performanceScore !== undefined && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Score</span>
                <span className={scoreColor}>{member.performanceScore.toFixed(1)}</span>
              </div>
              {/* Score bar */}
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${score >= 18 ? 'bg-green-500' : score >= 12 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, (score / 25) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {member.skillContribution !== undefined && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Skill Contribution</span>
                <span>{member.skillContribution}%</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, member.skillContribution)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
