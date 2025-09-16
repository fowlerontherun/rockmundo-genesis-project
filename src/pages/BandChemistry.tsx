import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Heart,
  AlertTriangle,
  MessageSquare,
  Star,
  Coffee
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";

type BandRelationRow = Database["public"]["Tables"]["band_relations"]["Row"];
type BandConflictRow = Database["public"]["Tables"]["band_conflicts"]["Row"];

type BandMember = Omit<BandRelationRow, "strengths" | "issues"> & {
  strengths: string[];
  issues: string[];
};

type TeamEvent = {
  id: number;
  name: string;
  cost: number;
  moraleBenefit: number;
  chemistryBenefit: number;
  duration: string;
  description: string;
};

const teamEvents: TeamEvent[] = [
  {
    id: 1,
    name: "Band Dinner",
    cost: 200,
    moraleBenefit: 15,
    chemistryBenefit: 10,
    duration: "2 hours",
    description: "Casual dinner to bond and discuss music"
  },
  {
    id: 2,
    name: "Studio Jam Session",
    cost: 500,
    moraleBenefit: 20,
    chemistryBenefit: 25,
    duration: "4 hours",
    description: "Free-form creative session to build musical chemistry"
  },
  {
    id: 3,
    name: "Team Building Retreat",
    cost: 2000,
    moraleBenefit: 35,
    chemistryBenefit: 40,
    duration: "2 days",
    description: "Weekend retreat focused on communication and collaboration"
  }
];

const getMoodColor = (mood: string) => {
  switch (mood) {
    case "Motivated":
      return "text-green-400";
    case "Excited":
      return "text-blue-400";
    case "Content":
      return "text-yellow-400";
    case "Frustrated":
      return "text-red-400";
    default:
      return "text-gray-400";
  }
};

const getChemistryColor = (chemistry: number) => {
  if (chemistry >= 80) return "text-green-400";
  if (chemistry >= 60) return "text-yellow-400";
  if (chemistry >= 40) return "text-orange-400";
  return "text-red-400";
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "High":
      return "bg-red-500";
    case "Medium":
      return "bg-yellow-500";
    case "Low":
      return "bg-blue-500";
    default:
      return "bg-gray-500";
  }
};

const formatTimeAgo = (dateString: string | null) => {
  if (!dateString) return "Unknown";
  const created = new Date(dateString);
  const diff = Date.now() - created.getTime();
  const diffHours = Math.floor(diff / (1000 * 60 * 60));

  if (diffHours < 1) {
    const diffMinutes = Math.floor(diff / (1000 * 60));
    return diffMinutes <= 1 ? "Just now" : `${diffMinutes} minutes ago`;
  }

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) {
    return `${diffWeeks} week${diffWeeks === 1 ? "" : "s"} ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} year${diffYears === 1 ? "" : "s"} ago`;
};

const normalizeBandMember = (member: BandRelationRow): BandMember => ({
  ...member,
  strengths: Array.isArray(member.strengths) ? member.strengths : [],
  issues: Array.isArray(member.issues) ? member.issues : [],
});

const BandChemistry = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [bandId, setBandId] = useState<string | null>(null);
  const [bandMembers, setBandMembers] = useState<BandMember[]>([]);
  const [bandConflicts, setBandConflicts] = useState<BandConflictRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);
  const [eventActionId, setEventActionId] = useState<number | null>(null);
  const [resolvingConflictId, setResolvingConflictId] = useState<string | null>(null);

  const determineBandId = useCallback(async (): Promise<string | null> => {
    if (!userId) return null;

    const { data: leaderBands, error: leaderError } = await supabase
      .from("bands")
      .select("id")
      .eq("leader_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (leaderError) {
      console.error("Error fetching leader band:", leaderError);
    }

    if (leaderBands && leaderBands.length > 0) {
      return leaderBands[0].id;
    }

    const { data: memberBands, error: memberError } = await supabase
      .from("band_members")
      .select("band_id")
      .eq("user_id", userId)
      .limit(1);

    if (memberError) {
      console.error("Error fetching member bands:", memberError);
      return null;
    }

    if (memberBands && memberBands.length > 0) {
      return memberBands[0].band_id;
    }

    return null;
  }, [userId]);

  const loadBandData = useCallback(async (targetBandId: string) => {
    const [relationsResponse, conflictsResponse] = await Promise.all([
      supabase
        .from("band_relations")
        .select("*")
        .eq("band_id", targetBandId)
        .order("member_name", { ascending: true }),
      supabase
        .from("band_conflicts")
        .select("*")
        .eq("band_id", targetBandId)
        .order("created_at", { ascending: false })
    ]);

    if (relationsResponse.error) {
      throw relationsResponse.error;
    }

    if (conflictsResponse.error) {
      throw conflictsResponse.error;
    }

    setBandMembers((relationsResponse.data ?? []).map(normalizeBandMember));
    setBandConflicts(conflictsResponse.data ?? []);
  }, []);

  useEffect(() => {
    if (!userId) {
      setBandId(null);
      setBandMembers([]);
      setBandConflicts([]);
      setLoading(false);
      return;
    }

    const initialize = async () => {
      setLoading(true);
      setInitialError(null);

      try {
        const resolvedBandId = await determineBandId();
        setBandId(resolvedBandId);

        if (resolvedBandId) {
          await loadBandData(resolvedBandId);
        } else {
          setBandMembers([]);
          setBandConflicts([]);
        }
      } catch (error) {
        console.error("Error loading band chemistry data:", error);
        setInitialError("Failed to load band chemistry data. Try refreshing the page.");
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load band chemistry data."
        });
      } finally {
        setLoading(false);
      }
    };

    void initialize();
  }, [userId, determineBandId, loadBandData, toast]);

  const bandMorale = useMemo(() => {
    if (bandMembers.length === 0) return 0;
    const total = bandMembers.reduce((sum, member) => sum + member.morale, 0);
    return Math.round(total / bandMembers.length);
  }, [bandMembers]);

  const averageChemistry = useMemo(() => {
    if (bandMembers.length === 0) return 0;
    const total = bandMembers.reduce((sum, member) => sum + member.chemistry, 0);
    return Math.round(total / bandMembers.length);
  }, [bandMembers]);

  const activeConflicts = useMemo(
    () => bandConflicts.filter(conflict => !conflict.resolved),
    [bandConflicts]
  );

  const updateMember = async (
    member: BandMember,
    updates: Partial<Pick<BandRelationRow, "chemistry" | "morale" | "mood" | "energy" | "loyalty" | "skill_rating" | "issues" | "strengths">>
  ) => {
    const { error } = await supabase
      .from("band_relations")
      .update(updates)
      .eq("id", member.id);

    if (error) {
      throw error;
    }

    setBandMembers(prev =>
      prev.map(item => (item.id === member.id ? { ...item, ...updates } : item))
    );
  };

  const handleTalk = async (member: BandMember) => {
    setMemberActionId(member.id);
    try {
      const updatedChemistry = Math.min(100, member.chemistry + 5);
      const updatedMorale = Math.min(100, member.morale + 4);

      await updateMember(member, {
        chemistry: updatedChemistry,
        morale: updatedMorale,
        mood: "Motivated"
      });

      toast({
        title: `Talked with ${member.member_name}`,
        description: "Chemistry improved slightly."
      });
    } catch (error) {
      console.error("Error talking with band member:", error);
      toast({
        variant: "destructive",
        title: "Action failed",
        description: "Could not update the member's mood."
      });
    } finally {
      setMemberActionId(null);
    }
  };

  const handleHangOut = async (member: BandMember) => {
    setMemberActionId(member.id);
    try {
      const updatedChemistry = Math.min(100, member.chemistry + 3);
      const updatedMorale = Math.min(100, member.morale + 6);
      const updatedEnergy = Math.min(100, member.energy + 8);

      await updateMember(member, {
        chemistry: updatedChemistry,
        morale: updatedMorale,
        energy: updatedEnergy,
        mood: "Excited"
      });

      toast({
        title: `Hung out with ${member.member_name}`,
        description: "Morale and energy received a boost."
      });
    } catch (error) {
      console.error("Error hanging out with band member:", error);
      toast({
        variant: "destructive",
        title: "Action failed",
        description: "Could not update the member's stats."
      });
    } finally {
      setMemberActionId(null);
    }
  };

  const handleTeamEvent = async (event: TeamEvent) => {
    if (!bandId || bandMembers.length === 0) {
      toast({
        variant: "destructive",
        title: "No band members",
        description: "You need band members to schedule an event."
      });
      return;
    }

    setEventActionId(event.id);

    try {
      const responses = await Promise.all(
        bandMembers.map(member => {
          const updatedChemistry = Math.min(100, member.chemistry + event.chemistryBenefit);
          const updatedMorale = Math.min(100, member.morale + event.moraleBenefit);
          const updatedMood = event.chemistryBenefit >= 20 ? "Excited" : "Motivated";

          return supabase
            .from("band_relations")
            .update({
              chemistry: updatedChemistry,
              morale: updatedMorale,
              mood: updatedMood
            })
            .eq("id", member.id);
        })
      );

      const errorResponse = responses.find(response => response.error);
      if (errorResponse && errorResponse.error) {
        throw errorResponse.error;
      }

      setBandMembers(prev =>
        prev.map(member => {
          const updatedChemistry = Math.min(100, member.chemistry + event.chemistryBenefit);
          const updatedMorale = Math.min(100, member.morale + event.moraleBenefit);
          const updatedMood = event.chemistryBenefit >= 20 ? "Excited" : "Motivated";

          return {
            ...member,
            chemistry: updatedChemistry,
            morale: updatedMorale,
            mood: updatedMood
          };
        })
      );

      toast({
        title: "Team Event Scheduled!",
        description: `${event.name} will improve band chemistry and morale.`,
      });
    } catch (error) {
      console.error("Error scheduling team event:", error);
      toast({
        variant: "destructive",
        title: "Unable to schedule event",
        description: "Please try again later."
      });
    } finally {
      setEventActionId(null);
    }
  };

  const handleResolveConflict = async (conflictId: string) => {
    const conflict = bandConflicts.find(item => item.id === conflictId);
    if (!conflict) return;

    const resolutionTimestamp = new Date().toISOString();
    setResolvingConflictId(conflictId);

    try {
      const { error: conflictError } = await supabase
        .from("band_conflicts")
        .update({
          resolved: true,
          resolved_at: resolutionTimestamp
        })
        .eq("id", conflictId);

      if (conflictError) {
        throw conflictError;
      }

      if (Array.isArray(conflict.involved_member_ids) && conflict.involved_member_ids.length > 0) {
        const updates = await Promise.all(
          conflict.involved_member_ids.map(async memberId => {
            const relation = bandMembers.find(member => member.member_id === memberId);
            if (!relation) return null;

            const filteredIssues = relation.issues.filter(issue =>
              issue !== conflict.conflict_type && issue !== conflict.description
            );

            const { error: relationError } = await supabase
              .from("band_relations")
              .update({ issues: filteredIssues })
              .eq("id", relation.id);

            if (relationError) {
              throw relationError;
            }

            return { id: relation.id, issues: filteredIssues };
          })
        );

        const validUpdates = updates.filter(Boolean) as { id: string; issues: string[] }[];
        if (validUpdates.length > 0) {
          setBandMembers(prev =>
            prev.map(member => {
              const update = validUpdates.find(item => item.id === member.id);
              return update ? { ...member, issues: update.issues } : member;
            })
          );
        }
      }

      setBandConflicts(prev =>
        prev.map(item =>
          item.id === conflictId
            ? { ...item, resolved: true, resolved_at: resolutionTimestamp }
            : item
        )
      );

      toast({
        title: "Conflict Resolved!",
        description: "The band conflict has been successfully mediated.",
      });
    } catch (error) {
      console.error("Error resolving conflict:", error);
      toast({
        variant: "destructive",
        title: "Unable to resolve conflict",
        description: "Please try again later."
      });
    } finally {
      setResolvingConflictId(null);
    }
  };

  const getConflictMembers = (conflict: BandConflictRow) => {
    if (!Array.isArray(conflict.involved_member_ids) || conflict.involved_member_ids.length === 0) {
      return [];
    }

    return conflict.involved_member_ids
      .map(memberId => bandMembers.find(member => member.member_id === memberId)?.member_name)
      .filter((name): name is string => Boolean(name));
  };

  const bandMoraleDisplay = bandMembers.length > 0 ? `${bandMorale}` : "--";
  const averageChemistryDisplay = bandMembers.length > 0 ? `${averageChemistry}%` : "--";

  return (
    <div className="min-h-screen bg-gradient-primary p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bebas text-cream tracking-wider">
            BAND CHEMISTRY
          </h1>
          <p className="text-xl text-cream/80 font-oswald">
            Manage relationships and keep the band together
          </p>
          <div className="flex justify-center items-center gap-4">
            <div className="flex items-center gap-2 text-cream">
              <Heart className="h-6 w-6" />
              <span className="text-lg">Band Morale: {bandMoraleDisplay}/100</span>
            </div>
          </div>
          {initialError && (
            <p className="text-sm text-red-300">{initialError}</p>
          )}
        </div>

        <Tabs defaultValue="members" className="space-y-6">
          <TabsList className="grid w-full max-w-lg mx-auto grid-cols-4">
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
            <TabsTrigger value="events">Team Events</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-6">
            {loading ? (
              <Card className="bg-card/80 border-accent">
                <CardContent className="py-10 text-center text-cream/70">
                  Loading band members...
                </CardContent>
              </Card>
            ) : bandMembers.length === 0 ? (
              <Card className="bg-card/80 border-accent">
                <CardContent className="py-10 text-center text-cream/70">
                  {bandId
                    ? "No band relations found. Add members to start tracking chemistry."
                    : "Join or create a band to view member chemistry."}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {bandMembers.map(member => (
                  <Card key={member.id} className="bg-card/80 border-accent">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-3xl">{member.avatar_icon ?? "🎶"}</div>
                          <div>
                            <CardTitle className="text-cream">{member.member_name}</CardTitle>
                            <CardDescription>{member.instrument}</CardDescription>
                          </div>
                        </div>
                        <div className="text-right">
                          {member.personality && (
                            <Badge variant="outline" className="mb-1">
                              {member.personality}
                            </Badge>
                          )}
                          <p className={`text-sm font-semibold ${getMoodColor(member.mood)}`}>
                            {member.mood}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-cream/60 text-sm">Chemistry</span>
                              <span className={`font-bold ${getChemistryColor(member.chemistry)}`}>
                                {member.chemistry}%
                              </span>
                            </div>
                            <Progress value={member.chemistry} className="h-2" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-cream/60 text-sm">Skill</span>
                              <span className="text-accent font-bold">{member.skill_rating}%</span>
                            </div>
                            <Progress value={member.skill_rating} className="h-2" />
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-cream/60 text-sm">Loyalty</span>
                              <span className="text-accent font-bold">{member.loyalty}%</span>
                            </div>
                            <Progress value={member.loyalty} className="h-2" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-cream/60 text-sm">Energy</span>
                              <span className="text-accent font-bold">{member.energy}%</span>
                            </div>
                            <Progress value={member.energy} className="h-2" />
                          </div>
                        </div>
                      </div>

                      {member.issues.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-cream/60 text-sm flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4" />
                            Current Issues
                          </p>
                          <div className="space-y-1">
                            {member.issues.map((issue, index) => (
                              <Badge key={index} variant="destructive" className="text-xs mr-1">
                                {issue}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {member.strengths.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-cream/60 text-sm flex items-center gap-1">
                            <Star className="h-4 w-4" />
                            Strengths
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {member.strengths.map((strength, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {strength}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-accent hover:bg-accent/80 text-background"
                          onClick={() => handleTalk(member)}
                          disabled={memberActionId === member.id}
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Talk
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-accent text-accent hover:bg-accent/10"
                          onClick={() => handleHangOut(member)}
                          disabled={memberActionId === member.id}
                        >
                          <Coffee className="h-4 w-4 mr-1" />
                          Hang Out
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="conflicts" className="space-y-6">
            {loading ? (
              <Card className="bg-card/80 border-accent">
                <CardContent className="py-10 text-center text-cream/70">
                  Loading conflicts...
                </CardContent>
              </Card>
            ) : activeConflicts.length > 0 ? (
              <div className="space-y-4">
                {activeConflicts.map(conflict => {
                  const members = getConflictMembers(conflict);
                  return (
                    <Card key={conflict.id} className="bg-card/80 border-accent">
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold text-cream">{conflict.conflict_type}</h3>
                              <Badge className={`${getSeverityColor(conflict.severity)} text-white`}>
                                {conflict.severity}
                              </Badge>
                            </div>
                            {conflict.description && (
                              <p className="text-cream/80">{conflict.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-sm text-cream/60">
                              <span>
                                Members: {members.length > 0 ? members.join(", ") : "TBD"}
                              </span>
                              <span>{formatTimeAgo(conflict.created_at)}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleResolveConflict(conflict.id)}
                              size="sm"
                              className="bg-accent hover:bg-accent/80 text-background"
                              disabled={resolvingConflictId === conflict.id}
                            >
                              Mediate
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-accent text-accent hover:bg-accent/10"
                              disabled={resolvingConflictId === conflict.id}
                            >
                              Investigate
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="bg-card/80 border-accent">
                <CardContent className="pt-6 text-center">
                  <Heart className="h-12 w-12 text-accent mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-cream mb-2">All Good!</h3>
                  <p className="text-cream/80">
                    No current conflicts in the band. Keep up the great chemistry!
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="events" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {teamEvents.map(event => (
                <Card key={event.id} className="bg-card/80 border-accent">
                  <CardHeader>
                    <CardTitle className="text-cream">{event.name}</CardTitle>
                    <CardDescription>{event.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-cream/60 text-sm">Cost</p>
                        <p className="text-lg font-bold text-accent">
                          ${event.cost.toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-cream/60 text-sm">Duration</p>
                        <p className="text-cream">{event.duration}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-cream/60 text-sm">Benefits</p>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">
                          +{event.moraleBenefit} Morale
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          +{event.chemistryBenefit} Chemistry
                        </Badge>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleTeamEvent(event)}
                      className="w-full bg-accent hover:bg-accent/80 text-background"
                      disabled={eventActionId === event.id || bandMembers.length === 0}
                    >
                      Schedule Event
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm">Average Chemistry</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">
                    {averageChemistryDisplay}
                  </div>
                  <p className="text-cream/60 text-sm">Good harmony</p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm">Active Conflicts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">{activeConflicts.length}</div>
                  <p className="text-cream/60 text-sm">Need attention</p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm">Team Events</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">12</div>
                  <p className="text-cream/60 text-sm">This month</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card/80 border-accent">
              <CardHeader>
                <CardTitle className="text-cream">Member Performance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                {bandMembers.length === 0 ? (
                  <p className="text-cream/70">No band members to analyze yet.</p>
                ) : (
                  <div className="space-y-4">
                    {bandMembers.map(member => (
                      <div key={member.id} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{member.avatar_icon ?? "🎶"}</span>
                            <span className="text-cream font-semibold">{member.member_name}</span>
                          </div>
                          <div className="text-right">
                            <span className={`font-bold ${getChemistryColor(member.chemistry)}`}>
                              {member.chemistry}% Chemistry
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-cream/60">Skill: </span>
                            <span className="text-accent">{member.skill_rating}%</span>
                          </div>
                          <div>
                            <span className="text-cream/60">Loyalty: </span>
                            <span className="text-accent">{member.loyalty}%</span>
                          </div>
                          <div>
                            <span className="text-cream/60">Energy: </span>
                            <span className="text-accent">{member.energy}%</span>
                          </div>
                          <div>
                            <span className="text-cream/60">Issues: </span>
                            <span className={member.issues.length > 0 ? "text-red-400" : "text-green-400"}>
                              {member.issues.length}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BandChemistry;
