import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, DollarSign, TrendingUp, Award, MapPin, Calendar, Eye, EyeOff, Plane, Sparkles, Music, Building } from "lucide-react";
import { useMentorSessions } from "@/hooks/useMentorSessions";
import { formatFocusSkill } from "@/pages/admin/mentors.helpers";

export const MentorsTab = () => {
  const { 
    mentors, 
    profile, 
    skillProgress, 
    bookSession, 
    isBooking, 
    canBookSession,
    isMentorDiscovered,
    isAvailableToday,
    isInMentorCity,
    getDayName,
    discoveredCount,
    totalMentors,
  } = useMentorSessions();

  const [filter, setFilter] = useState<'all' | 'discovered' | 'available'>('discovered');

  const getSkillLevel = (skillSlug: string) => {
    return skillProgress?.find((s) => s.skill_slug === skillSlug)?.current_level || 0;
  };

  const getSkillProgress = (skillSlug: string) => {
    const skill = skillProgress?.find((s) => s.skill_slug === skillSlug);
    if (!skill) return 0;
    return Math.floor((skill.current_xp / skill.required_xp) * 100);
  };

  const filteredMentors = mentors?.filter(mentor => {
    const discovered = isMentorDiscovered(mentor.id);
    const inCity = isInMentorCity(mentor.city_id);
    const availableDay = isAvailableToday(mentor.available_day);

    if (filter === 'discovered') return discovered;
    if (filter === 'available') return discovered && inCity && availableDay;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Legendary Masters
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Discover and train with the world's greatest musicians. Each master resides in a specific city and teaches on certain days.
          </p>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1 self-start">
          <Eye className="h-3 w-3 mr-1" />
          {discoveredCount} / {totalMentors} Discovered
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
          <TabsTrigger value="discovered" className="gap-1">
            <Eye className="h-3 w-3" />
            Discovered ({discoveredCount})
          </TabsTrigger>
          <TabsTrigger value="available" className="gap-1">
            <MapPin className="h-3 w-3" />
            Available Now
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1">
            <EyeOff className="h-3 w-3" />
            All Masters
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredMentors?.map((mentor) => {
              const discovered = isMentorDiscovered(mentor.id);
              const { canBook, reason } = canBookSession(mentor.id);
              const skillLevel = getSkillLevel(mentor.focus_skill);
              const skillProgressPercent = getSkillProgress(mentor.focus_skill);
              const inCity = isInMentorCity(mentor.city_id);
              const availableDay = isAvailableToday(mentor.available_day);

              // Undiscovered masters show as silhouettes
              if (!discovered && filter === 'all') {
                return (
                  <Card key={mentor.id} className="flex flex-col opacity-60 bg-muted/30">
                    <CardHeader className="space-y-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg text-muted-foreground">??? Unknown Master</CardTitle>
                        <Badge variant="outline" className="text-xs">
                          <EyeOff className="h-3 w-3 mr-1" />
                          Undiscovered
                        </Badge>
                      </div>
                      <CardDescription className="italic">
                        {mentor.discovery_hint || (
                          mentor.discovery_type === 'venue_gig' 
                            ? "Play a legendary gig to catch this master's attention..."
                            : mentor.discovery_type === 'studio_session'
                            ? "Record at the right studio to discover this master..."
                            : "Explore cities and talk to NPCs to find this master..."
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-4">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>Location: ???</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>Available: ???</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {mentor.discovery_type === 'venue_gig' ? (
                            <Music className="h-4 w-4" />
                          ) : mentor.discovery_type === 'studio_session' ? (
                            <Building className="h-4 w-4" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          <span>
                            {mentor.discovery_type === 'venue_gig' 
                              ? "Discovered by playing a venue"
                              : mentor.discovery_type === 'studio_session'
                              ? "Discovered by using a studio"
                              : "Discovered by exploring"
                            }
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          <span>Teaches: {formatFocusSkill(mentor.focus_skill)}</span>
                        </div>
                      </div>
                      <Button className="w-full" variant="outline" disabled>
                        Discover to Unlock
                      </Button>
                    </CardContent>
                  </Card>
                );
              }

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
                {filter === 'discovered' ? (
                  <>
                    <EyeOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">You haven't discovered any masters yet.</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Explore cities, talk to NPCs, and complete achievements to discover legendary masters.
                    </p>
                  </>
                ) : filter === 'available' ? (
                  <>
                    <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No masters available in your current city today.</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Travel to other cities or check back on different days.
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">No masters available at the moment.</p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
