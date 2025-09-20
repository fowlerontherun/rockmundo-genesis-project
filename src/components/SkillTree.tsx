import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useGameData } from '@/hooks/useGameData';
import { Lock, Star, Trophy, Music, Users, Mic, Zap } from 'lucide-react';

interface SkillDefinition {
  id: string;
  slug: string;
  display_name: string;
  description: string;
  tier_caps: any;
}

interface SkillProgress {
  id: string;
  profile_id: string;
  skill_slug: string;
  current_level: number;
  current_xp: number;
  required_xp: number;
}

interface SkillCategory {
  name: string;
  icon: React.ReactNode;
  skills: SkillDefinition[];
}

const getSkillIcon = (category: string) => {
  if (category.includes('songwriting') || category.includes('production')) return <Music className="h-4 w-4" />;
  if (category.includes('genre')) return <Star className="h-4 w-4" />;
  if (category.includes('instrument') || category.includes('performance')) return <Mic className="h-4 w-4" />;
  if (category.includes('stage') || category.includes('showmanship')) return <Users className="h-4 w-4" />;
  return <Zap className="h-4 w-4" />;
};

const getSkillTier = (slug: string): 'basic' | 'professional' | 'mastery' => {
  if (slug.startsWith('basic_')) return 'basic';
  if (slug.startsWith('professional_') || slug.includes('professional')) return 'professional';
  return 'mastery';
};

const getTierColor = (tier: 'basic' | 'professional' | 'mastery') => {
  switch (tier) {
    case 'basic': return 'bg-green-500/20 text-green-700 border-green-500/40';
    case 'professional': return 'bg-blue-500/20 text-blue-700 border-blue-500/40';
    case 'mastery': return 'bg-purple-500/20 text-purple-700 border-purple-500/40';
  }
};

export const SkillTree: React.FC = () => {
  const { profile } = useGameData();
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [progress, setProgress] = useState<SkillProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('songwriting');

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const { data: skillsData, error: skillsError } = await supabase
          .from('skill_definitions')
          .select('*')
          .order('display_name');

        if (skillsError) throw skillsError;

        setSkills((skillsData || []) as SkillDefinition[]);

        if (profile) {
          const { data: progressData, error: progressError } = await supabase
            .from('skill_progress')
            .select('*')
            .eq('profile_id', profile.id);

          if (progressError) throw progressError;
          setProgress(progressData || []);
        }
      } catch (error) {
        console.error('Error fetching skills:', error);
        toast.error('Failed to load skills');
      } finally {
        setLoading(false);
      }
    };

    fetchSkills();
  }, [profile]);

  const categorizeSkills = (): SkillCategory[] => {
    const categories: SkillCategory[] = [
      {
        name: 'Songwriting & Production',
        icon: <Music className="h-5 w-5" />,
        skills: skills.filter(skill => 
          skill.slug.includes('composing') || 
          skill.slug.includes('lyrics') || 
          skill.slug.includes('production') ||
          skill.slug.includes('daw') ||
          skill.slug.includes('beatmaking') ||
          skill.slug.includes('sampling') ||
          skill.slug.includes('sound_design') ||
          skill.slug.includes('mixing') ||
          skill.slug.includes('vocal') ||
          skill.slug.includes('ai_music')
        )
      },
      {
        name: 'Genres',
        icon: <Star className="h-5 w-5" />,
        skills: skills.filter(skill => 
          skill.slug.includes('rock') ||
          skill.slug.includes('pop') ||
          skill.slug.includes('hip_hop') ||
          skill.slug.includes('jazz') ||
          skill.slug.includes('blues') ||
          skill.slug.includes('edm') ||
          skill.slug.includes('trap') ||
          skill.slug.includes('country') ||
          skill.slug.includes('reggae') ||
          skill.slug.includes('metal') ||
          skill.slug.includes('classical') ||
          skill.slug.includes('latin') ||
          skill.slug.includes('rnb') ||
          skill.slug.includes('punk') ||
          skill.slug.includes('flamenco') ||
          skill.slug.includes('african') ||
          skill.slug.includes('drill') ||
          skill.slug.includes('lofi') ||
          skill.slug.includes('kpop') ||
          skill.slug.includes('afrobeats') ||
          skill.slug.includes('synthwave') ||
          skill.slug.includes('indie') ||
          skill.slug.includes('hyperpop') ||
          skill.slug.includes('metalcore') ||
          skill.slug.includes('alt_rnb')
        )
      },
      {
        name: 'Instruments & Performance',
        icon: <Mic className="h-5 w-5" />,
        skills: skills.filter(skill => 
          skill.slug.includes('singing') ||
          skill.slug.includes('rapping') ||
          skill.slug.includes('brass') ||
          skill.slug.includes('keyboard') ||
          skill.slug.includes('percussions') ||
          skill.slug.includes('strings') ||
          skill.slug.includes('woodwinds') ||
          skill.slug.includes('electronic_instruments') ||
          skill.slug.includes('dj') ||
          skill.slug.includes('midi') ||
          skill.slug.includes('piano') ||
          skill.slug.includes('drums') ||
          skill.slug.includes('guitar')
        )
      },
      {
        name: 'Stage & Showmanship',
        icon: <Users className="h-5 w-5" />,
        skills: skills.filter(skill => 
          skill.slug.includes('showmanship') ||
          skill.slug.includes('stage_tech') ||
          skill.slug.includes('visual') ||
          skill.slug.includes('social_media') ||
          skill.slug.includes('streaming') ||
          skill.slug.includes('crowd')
        )
      }
    ];

    return categories;
  };

  const getSkillProgress = (skillSlug: string): SkillProgress | null => {
    return progress.find(p => p.skill_slug === skillSlug) || null;
  };

  const practiceSkill = async (skillSlug: string) => {
    if (!profile) {
      toast.error('Please select a character first');
      return;
    }

    try {
      const existingProgress = getSkillProgress(skillSlug);
      const newXp = (existingProgress?.current_xp || 0) + 10;
      const newLevel = Math.floor(newXp / 100);

      const { error } = await supabase
        .from('skill_progress')
        .upsert({
          profile_id: profile.id,
          skill_slug: skillSlug,
          current_level: newLevel,
          current_xp: newXp,
          required_xp: (newLevel + 1) * 100,
        }, { onConflict: 'profile_id,skill_slug' });

      if (error) throw error;

      // Refresh progress
      const { data: progressData } = await supabase
        .from('skill_progress')
        .select('*')
        .eq('profile_id', profile.id);

      setProgress(progressData || []);
      toast.success(`Practiced ${skillSlug.replace(/_/g, ' ')}! +10 XP`);
    } catch (error) {
      console.error('Error practicing skill:', error);
      toast.error('Failed to practice skill');
    }
  };

  const categories = categorizeSkills();
  const selectedCategoryData = categories.find(cat => 
    cat.name.toLowerCase().includes(selectedCategory)
  ) || categories[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold">Skills Tree</h2>
        
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Button
              key={category.name}
              variant={selectedCategory === category.name.toLowerCase().split(' ')[0] ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category.name.toLowerCase().split(' ')[0])}
              className="flex items-center gap-2"
            >
              {category.icon}
              {category.name}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {selectedCategoryData.skills.map((skill) => {
          const skillProgress = getSkillProgress(skill.slug);
          const tier = getSkillTier(skill.slug);
          const level = skillProgress?.current_level || 0;
          const xp = skillProgress?.current_xp || 0;
          const requiredXp = skillProgress?.required_xp || 100;
          const progressPercent = (xp / requiredXp) * 100;

          return (
            <Card key={skill.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getSkillIcon(skill.slug)}
                    <CardTitle className="text-sm font-medium">
                      {skill.display_name}
                    </CardTitle>
                  </div>
                  <Badge className={getTierColor(tier)} variant="outline">
                    {tier}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {skill.description}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Level {level}</span>
                  <span>{xp}/{requiredXp} XP</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
                <Button
                  size="sm"
                  onClick={() => practiceSkill(skill.slug)}
                  className="w-full"
                  variant="outline"
                >
                  Practice (+10 XP)
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedCategoryData.skills.length === 0 && (
        <div className="text-center p-8">
          <p className="text-muted-foreground">No skills found in this category.</p>
        </div>
      )}
    </div>
  );
};

export default SkillTree;