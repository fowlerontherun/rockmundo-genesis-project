import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkillTree } from "@/components/SkillTree";
import { useGameData } from "@/hooks/useGameData";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Target, Award, Zap } from "lucide-react";

const SkillsPage = () => {
  const { skillProgress, attributes, loading } = useGameData();

  const totalXP = skillProgress?.reduce((sum, skill) => sum + (skill.current_xp || 0), 0) || 0;
  const skillCount = skillProgress?.length || 0;
  const avgLevel = skillProgress?.reduce((sum, skill) => sum + (skill.current_level || 0), 0) / (skillCount || 1);

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
              {skillProgress?.[0]?.skill_slug || 'None yet'}
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
              <CardDescription>Complete list of your skills and their progress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {skillProgress?.map(skill => (
                  <div key={skill.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{skill.skill_slug}</span>
                        <Badge variant="outline">Level {skill.current_level}</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {skill.current_xp} / {skill.required_xp} XP
                      </span>
                    </div>
                    <Progress 
                      value={(skill.current_xp / (skill.required_xp || 1)) * 100}
                      className="h-2"
                    />
                  </div>
                ))}
                
                {(!skillProgress || skillProgress.length === 0) && (
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