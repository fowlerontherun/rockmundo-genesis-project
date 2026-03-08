import { useState } from "react";
import { SkillSystemProvider } from "@/hooks/SkillSystemProvider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Music2, DollarSign, Star, TrendingUp, Award, Headphones, BarChart3, Settings } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useProducerProfile, useCreateProducerProfile, useUpdateProducerProfile, useProducerSessionHistory } from "@/hooks/useProducerCareer";
import { useSkillSystem } from "@/hooks/useSkillSystem";
import { calculateProducerQualityStats, MIN_PRODUCTION_SKILL, type ProducerSkillLevels } from "@/utils/producerQuality";
import { MUSIC_GENRES } from "@/data/genres";

function getSkillLevel(progress: any[] | undefined, slug: string): number {
  if (!progress) return 0;
  const entry = progress.find((p: any) => p.skill_slug === slug);
  return entry?.current_level ?? 0;
}

export default function ProducerCareer() {
  const { t } = useTranslation();
  const { data: profile, isLoading: profileLoading } = useProducerProfile();
  const createProfile = useCreateProducerProfile();
  const updateProfile = useUpdateProducerProfile();
  const { data: sessionHistory } = useProducerSessionHistory();
  const { progress } = useSkillSystem();

  const [displayName, setDisplayName] = useState("");
  const [costPerHour, setCostPerHour] = useState("50");
  const [genre, setGenre] = useState("Rock");
  const [bio, setBio] = useState("");

  const skillLevels: ProducerSkillLevels = {
    basicProduction: getSkillLevel(progress, 'songwriting_basic_record_production'),
    proProduction: getSkillLevel(progress, 'songwriting_professional_record_production'),
    masteryProduction: getSkillLevel(progress, 'songwriting_mastery_record_production'),
    mixingLevel: getSkillLevel(progress, 'songwriting_basic_mixing'),
    dawLevel: getSkillLevel(progress, 'songwriting_basic_daw'),
    composingLevel: getSkillLevel(progress, 'songwriting_basic_composing'),
    musicTheoryLevel: getSkillLevel(progress, 'theory_basic_harmony'),
  };

  const stats = calculateProducerQualityStats(skillLevels);
  const hasMinSkill = skillLevels.basicProduction >= MIN_PRODUCTION_SKILL;

  const handleCreate = () => {
    if (!displayName.trim()) return;
    createProfile.mutate({
      display_name: displayName.trim(),
      cost_per_hour: Math.max(10, parseInt(costPerHour) || 50),
      specialty_genre: genre,
      bio: bio.trim() || undefined,
      quality_bonus: stats.qualityBonus,
      mixing_skill: stats.mixingSkill,
      arrangement_skill: stats.arrangementSkill,
    });
  };

  const handleUpdateAvailability = (available: boolean) => {
    updateProfile.mutate({ is_available: available });
  };

  const handleUpdateRate = () => {
    updateProfile.mutate({
      cost_per_hour: Math.max(10, parseInt(costPerHour) || 50),
      quality_bonus: stats.qualityBonus,
      mixing_skill: stats.mixingSkill,
      arrangement_skill: stats.arrangementSkill,
    });
  };

  if (profileLoading) {
    return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  }

  // No profile yet — registration screen
  if (!profile) {
    return (
      <div className="container max-w-2xl mx-auto p-6 space-y-6">
        <div className="text-center space-y-2">
          <Headphones className="h-12 w-12 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">Become a Producer</h1>
          <p className="text-muted-foreground">
            Register as a record producer and earn cash + XP by producing for other artists.
          </p>
        </div>

        {!hasMinSkill ? (
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <Badge variant="destructive">Skill Required</Badge>
              <p className="text-muted-foreground">
                You need Basic Record Production skill at level {MIN_PRODUCTION_SKILL}+ to register.
                Current: {skillLevels.basicProduction}
              </p>
              <p className="text-sm text-muted-foreground">
                Train at the Education center or practice songwriting to improve.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Set Up Your Producer Profile</CardTitle>
              <CardDescription>Other players will see this when hiring you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Producer Name</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your producer alias" />
              </div>

              <div className="space-y-2">
                <Label>Hourly Rate ($)</Label>
                <Input type="number" min={10} value={costPerHour} onChange={(e) => setCostPerHour(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Specialty Genre</Label>
                <Select value={genre} onValueChange={setGenre}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {MUSIC_GENRES.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Bio (optional)</Label>
                <Input value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short pitch about your style" />
              </div>

              <Card className="bg-muted/50">
                <CardContent className="p-4 space-y-2">
                  <p className="text-sm font-semibold">Your Skill-Based Stats</p>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Quality Bonus</span>
                      <p className="font-bold text-primary">+{stats.qualityBonus}%</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Mixing</span>
                      <p className="font-bold">{stats.mixingSkill}/100</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Arrangement</span>
                      <p className="font-bold">{stats.arrangementSkill}/100</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button onClick={handleCreate} disabled={!displayName.trim() || createProfile.isPending} className="w-full">
                {createProfile.isPending ? 'Creating...' : 'Register as Producer'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Has profile — dashboard
  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Headphones className="h-6 w-6 text-primary" />
            Producer Career
          </h1>
          <p className="text-muted-foreground">{profile.display_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="availability">Available</Label>
          <Switch
            id="availability"
            checked={profile.is_available}
            onCheckedChange={handleUpdateAvailability}
          />
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{profile.total_sessions}</p>
            <p className="text-xs text-muted-foreground">Sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">${Number(profile.total_earnings).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Earned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{profile.xp_earned}</p>
            <p className="text-xs text-muted-foreground">XP Earned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{Number(profile.rating).toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Rating</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1" /> Settings</TabsTrigger>
          <TabsTrigger value="skills"><Award className="h-4 w-4 mr-1" /> Skills</TabsTrigger>
          <TabsTrigger value="history"><Music2 className="h-4 w-4 mr-1" /> History</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hourly Rate ($)</Label>
                  <Input
                    type="number"
                    min={10}
                    value={costPerHour}
                    onChange={(e) => setCostPerHour(e.target.value)}
                    onBlur={handleUpdateRate}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Specialty Genre</Label>
                  <Select
                    value={profile.specialty_genre}
                    onValueChange={(v) => updateProfile.mutate({ specialty_genre: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {MUSIC_GENRES.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skills" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground">Your skills directly affect recording quality for clients.</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Quality Bonus</p>
                  <p className="text-xl font-bold text-primary">+{stats.qualityBonus}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Max: 25%</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Mixing</p>
                  <p className="text-xl font-bold">{stats.mixingSkill}</p>
                  <p className="text-xs text-muted-foreground mt-1">Max: 100</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Arrangement</p>
                  <p className="text-xl font-bold">{stats.arrangementSkill}</p>
                  <p className="text-xs text-muted-foreground mt-1">Max: 100</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Improve via: Record Production, Mixing, DAW, Composing, and Music Theory skills in the Skill Tree.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {(!sessionHistory || sessionHistory.length === 0) ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No producing sessions yet. Make yourself available and wait for clients!
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {sessionHistory.map((s: any) => (
                <Card key={s.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{s.songs?.title || 'Unknown Song'}</p>
                      <p className="text-xs text-muted-foreground">{s.songs?.genre} · {s.duration_hours}hr</p>
                    </div>
                    <Badge variant={s.status === 'completed' ? 'default' : 'secondary'}>
                      {s.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
