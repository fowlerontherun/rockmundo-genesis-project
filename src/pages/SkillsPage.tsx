import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkillTree } from "@/components/SkillTree";
import { useGameData } from "@/hooks/useGameData";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Target, Award, Zap, Clock } from "lucide-react";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useScheduledActivities } from "@/hooks/useScheduledActivities";
import { useAuth } from "@/hooks/use-auth-context";

const SkillsPage = () => {
  const { user } = useAuth();
  const { skillProgress, attributes, loading } = useGameData();
  const queryClient = useQueryClient();
  const [practicingSkills, setPracticingSkills] = useState<Set<string>>(new Set());
  
  // Get today's scheduled activities to check if player is already booked
  const today = new Date();
  const { data: scheduledActivities } = useScheduledActivities(today, user?.id);
  const hasActiveBooking = useMemo(() => {
    return scheduledActivities?.some(activity => 
      activity.status === 'scheduled' || activity.status === 'in_progress'
    ) || false;
  }, [scheduledActivities]);

  const totalXP = skillProgress?.reduce((sum, skill) => sum + (skill.current_xp || 0), 0) || 0;
  const skillCount = skillProgress?.length || 0;
  const avgLevel = skillProgress?.reduce((sum, skill) => sum + (skill.current_level || 0), 0) / (skillCount || 1);

  // Track cooldowns in local storage
  const getSkillCooldown = (skillSlug: string): number | null => {
    const cooldowns = JSON.parse(localStorage.getItem('skillPracticeCooldowns') || '{}');
    const cooldownTime = cooldowns[skillSlug];
    if (!cooldownTime) return null;
    
    const timeSince = Date.now() - cooldownTime;
    const oneHour = 60 * 60 * 1000;
    
    if (timeSince >= oneHour) {
      // Cooldown expired, remove it
      delete cooldowns[skillSlug];
      localStorage.setItem('skillPracticeCooldowns', JSON.stringify(cooldowns));
      return null;
    }
    
    return oneHour - timeSince;
  };

  const setSkillCooldown = (skillSlug: string) => {
    const cooldowns = JSON.parse(localStorage.getItem('skillPracticeCooldowns') || '{}');
    cooldowns[skillSlug] = Date.now();
    localStorage.setItem('skillPracticeCooldowns', JSON.stringify(cooldowns));
  };

  const handlePractice = async (skillSlug: string) => {
    setPracticingSkills(prev => new Set(prev).add(skillSlug));
    
    try {
      // Call progression function to award XP
      const { data, error } = await supabase.functions.invoke('progression', {
        body: {
          action: 'spend_skill_xp',
          skill_slug: skillSlug,
          xp: 5, // Small amount for practice
          metadata: {
            activity: 'practice',
            source: 'skills_page'
          }
        }
      });

      if (error) throw error;

      setSkillCooldown(skillSlug);
      queryClient.invalidateQueries({ queryKey: ['gameData'] });
      queryClient.invalidateQueries({ queryKey: ['skillProgress'] });
      
      toast.success(`Practiced ${skillSlug.replace(/_/g, ' ')}!`, {
        description: 'Gained 5 XP. Practice again in 1 hour.'
      });
    } catch (error: any) {
      toast.error('Practice failed', {
        description: error.message
      });
    } finally {
      setPracticingSkills(prev => {
        const newSet = new Set(prev);
        newSet.delete(skillSlug);
        return newSet;
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Skills & Progression</h1>
        <p className="text-muted-foreground">Master your craft and unlock new abilities</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Total XP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalXP.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              Skills Tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{skillCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Average Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgLevel.toFixed(1)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="h-4 w-4 text-purple-500" />
              Top Skill
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium truncate">
              {skillProgress?.[0]?.skill_slug.replace(/_/g, ' ') || 'None yet'}
            </div>
            <div className="text-xs text-muted-foreground">
              Level {skillProgress?.[0]?.current_level || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Skill Tree */}
      <Tabs defaultValue="tree" className="w-full">
        <TabsList>
          <TabsTrigger value="tree">Skill Tree</TabsTrigger>
          <TabsTrigger value="list">All Skills</TabsTrigger>
        </TabsList>

        <TabsContent value="tree" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Skill Tree</CardTitle>
              <CardDescription>
                Visualize your skill progression and unlock new abilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SkillTree />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>All Skills</CardTitle>
              <CardDescription>Practice your skills to gain experience (once per hour)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {skillProgress?.filter(skill => skill.current_xp > 0).map(skill => {
                  const cooldown = getSkillCooldown(skill.skill_slug);
                  const isPracticing = practicingSkills.has(skill.skill_slug);
                  const canPractice = !hasActiveBooking && !cooldown && !isPracticing;
                  
                  return (
                    <div key={skill.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{skill.skill_slug.replace(/_/g, ' ')}</span>
                          <Badge variant="outline">Level {skill.current_level}</Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">
                            {skill.current_xp} / {skill.required_xp} XP
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canPractice}
                            onClick={() => handlePractice(skill.skill_slug)}
                          >
                            {isPracticing ? (
                              "Practicing..."
                            ) : cooldown ? (
                              <>
                                <Clock className="h-3 w-3 mr-1" />
                                {Math.ceil(cooldown / 60000)}m
                              </>
                            ) : hasActiveBooking ? (
                              "Booked"
                            ) : (
                              "Practise"
                            )}
                          </Button>
                        </div>
                      </div>
                      <Progress 
                        value={(skill.current_xp / (skill.required_xp || 1)) * 100}
                        className="h-2"
                      />
                    </div>
                  );
                })}
                
                {(!skillProgress || skillProgress.filter(s => s.current_xp > 0).length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    Start practicing to develop your skills!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SkillsPage;
