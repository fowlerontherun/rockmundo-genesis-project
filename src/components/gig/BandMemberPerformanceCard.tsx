import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, Star, Music } from "lucide-react";

interface BandMember {
  id: string;
  instrument_role: string;
  vocal_role: string | null;
  profile_id: string | null;
  profile_name?: string;
  skill_level: number;
  skill_contribution: number | null;
}

interface BandMemberPerformanceCardProps {
  bandId: string | null;
  overallRating: number;
}

const ROLE_EMOJIS: Record<string, string> = {
  lead_guitar: '🎸',
  rhythm_guitar: '🎸',
  bass: '🎸',
  drums: '🥁',
  vocals: '🎤',
  keyboards: '🎹',
  keys: '🎹',
  saxophone: '🎷',
  trumpet: '🎺',
  violin: '🎻',
  other: '🎵',
};

export const BandMemberPerformanceCard = ({ bandId, overallRating }: BandMemberPerformanceCardProps) => {
  const [members, setMembers] = useState<BandMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bandId) return;

    const load = async () => {
      const { data } = await supabase
        .from('band_members')
        .select('id, instrument_role, vocal_role, profile_id, skill_contribution')
        .eq('band_id', bandId)
        .eq('member_status', 'active');

      if (!data) { setLoading(false); return; }

      // Fetch profile names separately
      const profileIds = data.filter(m => m.profile_id).map(m => m.profile_id!);
      const { data: profiles } = profileIds.length > 0 
        ? await supabase.from('profiles').select('id, stage_name').in('id', profileIds)
        : { data: [] };
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.stage_name]));

      {
        // For each member, fetch their primary skill level
        const enriched = await Promise.all(data.map(async (m: any) => {
          let skillLevel = 50;
          if (m.profile_id) {
            const { data: skills } = await (supabase as any)
              .from('skill_progress')
              .select('current_level')
              .eq('profile_id', m.profile_id)
              .eq('skill_name', m.instrument_role === 'vocals' ? 'vocals' : m.instrument_role)
              .maybeSingle();
            skillLevel = skills?.current_level || 50;
          }

          // Calculate individual performance rating based on skill + randomized contribution
          // Base: skill contribution proportional to overall, with individual variance
          const baseContrib = m.skill_contribution || 50;
          const variance = (Math.random() - 0.5) * 4; // ±2 points of 25
          const memberRating = Math.min(25, Math.max(1, overallRating * (baseContrib / 60) + variance));

          return {
            id: m.id,
            instrument_role: m.instrument_role,
            vocal_role: m.vocal_role,
            profile_id: m.profile_id,
            profile_name: m.profiles?.stage_name || `Member`,
            skill_level: skillLevel,
            skill_contribution: baseContrib,
            performance_rating: memberRating,
          };
        }));

        setMembers(enriched);
      }
      setLoading(false);
    };

    load();
  }, [bandId, overallRating]);

  if (loading || members.length === 0) return null;

  const getRatingLabel = (rating: number) => {
    if (rating >= 20) return { label: 'Outstanding', color: 'bg-green-500' };
    if (rating >= 16) return { label: 'Great', color: 'bg-blue-500' };
    if (rating >= 12) return { label: 'Good', color: 'bg-primary' };
    if (rating >= 8) return { label: 'Average', color: 'bg-yellow-500' };
    return { label: 'Poor', color: 'bg-red-500' };
  };

  const formatRole = (role: string) =>
    role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Band Member Performances
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {members.map((member: any) => {
            const rating = member.performance_rating || overallRating;
            const info = getRatingLabel(rating);
            const emoji = ROLE_EMOJIS[member.instrument_role] || '🎵';

            return (
              <div key={member.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{emoji}</span>
                    <div>
                      <p className="font-semibold text-sm">{member.profile_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatRole(member.instrument_role)}
                        {member.vocal_role && ` / ${formatRole(member.vocal_role)}`}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {info.label}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Performance Rating</span>
                    <span className="font-medium">{rating.toFixed(1)}/25</span>
                  </div>
                  <Progress value={(rating / 25) * 100} className="h-1.5" />
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Skill Level: {member.skill_level}</span>
                  <span>Contribution: {member.skill_contribution}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
