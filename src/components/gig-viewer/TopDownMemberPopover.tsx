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
  const scoreColor = (member.performanceScore || 0) >= 18 
    ? 'text-green-400' 
    : (member.performanceScore || 0) >= 12 
      ? 'text-yellow-400' 
      : 'text-red-400';

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-52 bg-black/90 border-primary/30 text-white p-3" side="top">
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
          {member.performanceScore !== undefined && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Score</span>
              <span className={scoreColor}>{member.performanceScore.toFixed(1)}</span>
            </div>
          )}
          {member.skillContribution !== undefined && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Skill</span>
              <span>{member.skillContribution}%</span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
