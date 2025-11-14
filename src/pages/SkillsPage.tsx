import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkillTree } from "@/components/SkillTree";
import { useGameData } from "@/hooks/useGameData";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, Target, Award, Zap, Calendar, AlertCircle } from "lucide-react";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth-context";
import { useSkillPracticeRestrictions } from "@/hooks/useSkillPractice";
import { SchedulePracticeDialog } from "@/components/skills/SchedulePracticeDialog";

const SkillsPage = () => {
  const { user } = useAuth();
  const { skillProgress, attributes, loading } = useGameData();
  const [selectedSkill, setSelectedSkill] = useState<{ slug: string; name: string } | null>(null);
  
  // Get practice restrictions for current date
  const today = new Date();
  const { data: restrictions } = useSkillPracticeRestrictions(user?.id, today);

  const totalXP = skillProgress?.reduce((sum, skill) => sum + (skill.current_xp || 0), 0) || 0;
  const skillCount = skillProgress?.length || 0;
  const avgLevel = skillProgress?.reduce((sum, skill) => sum + (skill.current_level || 0), 0) / (skillCount || 1);

  // Filter skills that can be practiced (level 1 or higher)
  const practiceableSkills = useMemo(() => {
    return skillProgress?.filter(skill => skill.current_level >= 1) || [];
  }, [skillProgress]);

  const handleOpenPracticeDialog = (skillSlug: string, skillName: string) => {
    setSelectedSkill({ slug: skillSlug, name: skillName });
  };


  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Skills & Progression</h1>
        <p className="text-muted-foreground">Master your craft and unlock new abilities</p>
      </div>

      {/* Practice Restrictions Alert */}
      {restrictions && !restrictions.canPractice && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{restrictions.reason}</AlertDescription>
        </Alert>
      )}

      {/* Practice Status */}
      {restrictions && restrictions.canPractice && (
        <Alert>
          <Target className="h-4 w-4" />
          <AlertDescription>
            Practice sessions today: {restrictions.todaysPracticeCount}/5
            {restrictions.todaysPracticeCount < 5 && 
              ` - You can practice ${5 - restrictions.todaysPracticeCount} more time${5 - restrictions.todaysPracticeCount === 1 ? '' : 's'} today`
            }
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total XP</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalXP.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Skills Unlocked</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{skillCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Level</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgLevel.toFixed(1)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Can Practice</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{practiceableSkills.length}</div>
            <p className="text-xs text-muted-foreground">Level 1+ skills</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tree" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tree">Skill Tree</TabsTrigger>
          <TabsTrigger value="list">Practice Skills</TabsTrigger>
        </TabsList>

        <TabsContent value="tree" className="mt-6">
          <SkillTree />
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Practice Skills</CardTitle>
              <CardDescription>
                Schedule practice sessions to gain XP. Must be level 1+ to practice. 
                Each session takes 1 hour and grants 5 XP. Maximum 5 sessions per day.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {practiceableSkills.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No skills available to practice yet.</p>
                  <p className="text-sm mt-2">Level up skills to at least level 1 through education, gigs, or other activities.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {practiceableSkills.map(skill => {
                    const requiredXP = Math.floor(100 * Math.pow(1.5, skill.current_level - 1));
                    const progressPercent = (skill.current_xp / requiredXP) * 100;
                    const canPracticeThisSkill = restrictions?.canPractice || false;

                    return (
                      <div key={skill.skill_slug} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold capitalize">
                                {skill.skill_slug.replace(/_/g, ' ')}
                              </h4>
                              <Badge variant="outline">Level {skill.current_level}</Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{skill.current_xp}/{requiredXP} XP</span>
                            </div>
                          </div>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canPracticeThisSkill}
                            onClick={() => handleOpenPracticeDialog(
                              skill.skill_slug, 
                              skill.skill_slug.replace(/_/g, ' ')
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            Schedule Practice
                          </Button>
                        </div>
                        <Progress value={progressPercent} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Attributes Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Attributes</CardTitle>
          <CardDescription>Core stats that influence your performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {attributes && Object.entries(attributes).map(([key, value]) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="font-bold">{value}</span>
                </div>
                <Progress value={(value / 100) * 100} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Schedule Practice Dialog */}
      {selectedSkill && (
        <SchedulePracticeDialog
          open={!!selectedSkill}
          onOpenChange={(open) => !open && setSelectedSkill(null)}
          skillSlug={selectedSkill.slug}
          skillName={selectedSkill.name}
        />
      )}
    </div>
  );
};

export default SkillsPage;
