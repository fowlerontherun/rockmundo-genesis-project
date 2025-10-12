import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Clock, DollarSign, TrendingUp, Users, Award } from "lucide-react";
import { useMentorSessions } from "@/hooks/useMentorSessions";
import { formatFocusSkill } from "@/pages/admin/mentors.helpers";

export const MentorsTab = () => {
  const { mentors, profile, skillProgress, bookSession, isBooking, canBookSession } = useMentorSessions();

  const getSkillLevel = (skillSlug: string) => {
    return skillProgress?.find((s) => s.skill_slug === skillSlug)?.current_level || 0;
  };

  const getSkillProgress = (skillSlug: string) => {
    const skill = skillProgress?.find((s) => s.skill_slug === skillSlug);
    if (!skill) return 0;
    return Math.floor((skill.current_xp / skill.required_xp) * 100);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Expert Mentors</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Book one-on-one sessions with industry professionals to accelerate your skill development.
        </p>
      </div>

      {profile && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Available Balance</p>
                  <p className="text-2xl font-bold">${profile.cash?.toLocaleString()}</p>
                </div>
                <div className="h-12 w-px bg-border" />
                <div>
                  <p className="text-sm text-muted-foreground">Total XP</p>
                  <p className="text-2xl font-bold">{profile.experience?.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {mentors?.map((mentor) => {
          const { canBook, reason } = canBookSession(mentor.id);
          const skillLevel = getSkillLevel(mentor.focus_skill);
          const skillProgressPercent = getSkillProgress(mentor.focus_skill);

          return (
            <Card key={mentor.id} className="flex flex-col">
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{mentor.name}</CardTitle>
                  <Badge variant={mentor.difficulty === 'beginner' ? 'secondary' : mentor.difficulty === 'intermediate' ? 'default' : 'destructive'}>
                    {mentor.difficulty}
                  </Badge>
                </div>
                <CardDescription>{mentor.specialty}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <p className="text-sm text-muted-foreground">{mentor.description}</p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Focus Skill</span>
                    <span className="font-medium">{formatFocusSkill(mentor.focus_skill as any)}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Your Level: {skillLevel}</span>
                      <span>{skillProgressPercent}%</span>
                    </div>
                    <Progress value={skillProgressPercent} className="h-2" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>${mentor.cost}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span>{mentor.base_xp} XP</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{mentor.cooldown_hours}h cooldown</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>Lvl {mentor.required_skill_value}+</span>
                  </div>
                </div>

                {mentor.attribute_keys && Array.isArray(mentor.attribute_keys) && mentor.attribute_keys.length > 0 && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold text-muted-foreground">Attribute Boosts</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{mentor.bonus_description}</p>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={() => bookSession(mentor.id)}
                  disabled={!canBook || isBooking}
                >
                  {isBooking ? "Booking..." : canBook ? "Book Session" : reason}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(!mentors || mentors.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No mentors available at the moment.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
