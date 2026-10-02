import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, DollarSign, TrendingUp, Award, MapPin, Calendar, Plane, Sparkles } from "lucide-react";
import { useMentorSessions } from "@/hooks/useMentorSessions";
import { formatFocusSkill } from "@/pages/admin/mentors.helpers";
import { isHigherTierSkill, useSkillTierAccess } from "../hooks/useSkillTierAccess";

export const MentorsTab = () => {
  const { 
    mentors, 
    profile, 
    skillProgress, 
    bookSession, 
    isBooking, 
    canBookSession,
    isAvailableToday,
    isInMentorCity,
    getDayName,
    totalMentors,
  } = useMentorSessions();

  const [filter, setFilter] = useState<'all' | 'available'>('all');
  const tierAccess = useSkillTierAccess(profile?.id, (mentors ?? []).map((mentor) => mentor.focus_skill));
  const accessBySkill = tierAccess.data ?? new Map<string, boolean>();

  const getSkillLevel = (skillSlug: string) => {
    return skillProgress?.find((s) => s.skill_slug === skillSlug)?.current_level || 0;
  };

  const getSkillProgress = (skillSlug: string) => {
    const skill = skillProgress?.find((s) => s.skill_slug === skillSlug);
    if (!skill) return 0;
    return Math.floor((skill.current_xp / skill.required_xp) * 100);
  };

  const filteredMentors = mentors?.filter(mentor => {
    const inCity = isInMentorCity(mentor.city_id);
    const availableDay = isAvailableToday(mentor.available_day);
    const locked = isHigherTierSkill(mentor.focus_skill) && accessBySkill.get(mentor.focus_skill) === false;

    if (locked) return false;
    if (filter === 'available') return inCity && availableDay;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Mentors
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Find a mentor for the skill you want to learn. Professional and Mastery mentors appear here as soon as their skill tier is unlocked.
          </p>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1 self-start">
          {totalMentors} mentors
        </Badge>
      </div>

      {/* Player Info */}
      {profile && (
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Available Balance</p>
                  <p className="text-xl font-bold">${profile.cash?.toLocaleString()}</p>
                </div>
                <div className="h-10 w-px bg-border" />
                <div>
                  <p className="text-xs text-muted-foreground">Total XP</p>
                  <p className="text-xl font-bold">{profile.experience?.toLocaleString()}</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                💡 Masters cost $15,000 - $250,000+ per session
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="available" className="gap-1">
            <MapPin className="h-3 w-3" />
            Available Now
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1">
            All Mentors
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredMentors?.map((mentor) => {
              const { canBook, reason } = canBookSession(mentor.id);
              const skillLevel = getSkillLevel(mentor.focus_skill);
              const skillProgressPercent = getSkillProgress(mentor.focus_skill);
              const inCity = isInMentorCity(mentor.city_id);
              const availableDay = isAvailableToday(mentor.available_day);

              return (
                <Card key={mentor.id} className="flex flex-col">
                  <CardHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg">{mentor.name}</CardTitle>
                      <div className="flex gap-1 flex-wrap justify-end">
                        {mentor.city && (
                          <Badge variant={inCity ? "default" : "outline"} className="text-xs">
                            <MapPin className="h-3 w-3 mr-1" />
                            {mentor.city.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription>{mentor.specialty}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4">
                    {mentor.lore_biography && (
                      <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                        {mentor.lore_biography}
                      </p>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Focus Skill</span>
                        <span className="font-medium">{formatFocusSkill(mentor.focus_skill)}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Your Level: {skillLevel}</span>
                          <span>{skillProgressPercent}%</span>
                        </div>
                        <Progress value={skillProgressPercent} className="h-2" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <span className="font-semibold">${mentor.cost.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <span>{mentor.base_xp} XP</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{mentor.cooldown_hours}h cooldown</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className={`h-4 w-4 ${availableDay ? 'text-primary' : 'text-warning'}`} />
                        <span className={availableDay ? 'text-primary' : 'text-warning'}>
                          {getDayName(mentor.available_day)}s
                        </span>
                      </div>
                    </div>

                    {mentor.attribute_keys && Array.isArray(mentor.attribute_keys) && mentor.attribute_keys.length > 0 && (
                      <div className="rounded-lg bg-muted/50 p-2">
                        <div className="flex items-center gap-2 mb-1">
                          <Award className="h-3 w-3 text-primary" />
                          <span className="text-xs font-semibold text-muted-foreground">Attribute Boosts</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{mentor.bonus_description}</p>
                      </div>
                    )}

                    {/* Action button based on state */}
                    {!inCity && mentor.city_id ? (
                      <Button className="w-full" variant="outline" disabled>
                        <Plane className="h-4 w-4 mr-2" />
                        Travel to {mentor.city?.name || 'City'}
                      </Button>
                    ) : !availableDay ? (
                      <Button className="w-full" variant="outline" disabled>
                        <Calendar className="h-4 w-4 mr-2" />
                        Returns on {getDayName(mentor.available_day)}
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => bookSession(mentor.id)}
                        disabled={!canBook || isBooking}
                      >
                        {isBooking ? "Booking..." : canBook ? `Train ($${mentor.cost.toLocaleString()})` : reason}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {(!filteredMentors || filteredMentors.length === 0) && (
            <Card>
              <CardContent className="py-12 text-center">
                {filter === 'available' ? (
                  <>
                    <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No mentors are available in your current city today.</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Choose All Mentors to see every learning option.
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">No mentors are available at the moment.</p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

