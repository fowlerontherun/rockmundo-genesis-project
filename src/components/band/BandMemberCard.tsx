import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Crown, Bot, Music } from 'lucide-react';

interface BandMemberCardProps {
  member: any;
  isLeader: boolean;
  canManage: boolean;
  onRemove?: () => void;
}

export function BandMemberCard({ member, isLeader, canManage, onRemove }: BandMemberCardProps) {
  const displayName = member.is_touring_member 
    ? `${member.role} (AI)`
    : (member.profiles?.display_name || member.profiles?.username || 'Unknown');

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{displayName}</h3>
              {isLeader && <Crown className="h-4 w-4 text-yellow-500" />}
              {member.is_touring_member && <Bot className="h-4 w-4 text-blue-500" />}
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                <Music className="h-3 w-3 mr-1" />
                {member.instrument_role}
              </Badge>
              {member.vocal_role && (
                <Badge variant="outline" className="text-xs">
                  {member.vocal_role}
                </Badge>
              )}
            </div>

            <div className="text-sm text-muted-foreground space-y-1">
              <div>Skill Contribution: {member.skill_contribution || 0}</div>
              <div>Chemistry: {member.chemistry_contribution || 0}</div>
              {member.is_touring_member && member.touring_member_cost && (
                <div className="font-medium text-primary">
                  Weekly Cost: ${member.touring_member_cost}
                </div>
              )}
            </div>
          </div>

          {canManage && !isLeader && onRemove && (
            <Button variant="destructive" size="sm" onClick={onRemove}>
              Remove
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
