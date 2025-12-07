import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/lib/supabase-types';
import { useGameData } from '@/hooks/useGameData';
import { Star, Music, Users, Mic, Zap } from 'lucide-react';
import { HierarchicalSkillNode } from './skills/HierarchicalSkillNode';

type SkillDefinition = Database['public']['Tables']['skill_definitions']['Row'];
type SkillProgress = Database['public']['Tables']['skill_progress']['Row'];

interface SkillCategory {
  name: string;
  icon: React.ReactNode;
  skills: SkillDefinition[];
}

interface SkillTreeProps {
  xpBalance?: number;
  onXpSpent?: () => void;
}

const getSkillTier = (slug: string): 'basic' | 'professional' | 'mastery' => {
  if (slug.startsWith('basic_')) return 'basic';
  if (slug.startsWith('professional_') || slug.includes('professional')) return 'professional';
  return 'mastery';
};

export const SkillTree: React.FC<SkillTreeProps> = ({ xpBalance = 0, onXpSpent }) => {
  const { profile } = useGameData();
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [progress, setProgress] = useState<SkillProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('songwriting');
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = async () => {
    try {
      const { data: skillsData, error: skillsError } = await supabase
        .from('skill_definitions')
        .select('*')
        .order('display_name');

      if (skillsError) throw skillsError;

      setSkills(skillsData ?? []);

      if (profile) {
        const { data: progressData, error: progressError } = await supabase
          .from('skill_progress')
          .select('*')
          .eq('profile_id', profile.id);

        if (progressError) throw progressError;
        setProgress(progressData ?? []);
      }
    } catch (error) {
      console.error('Error fetching skills:', error);
      toast.error('Failed to load skills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile, refreshKey]);

  const handleSkillTrained = () => {
    setRefreshKey(prev => prev + 1);
    onXpSpent?.();
  };

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
          skill.slug.includes('woodwind') ||
          skill.slug.includes('electronic_instruments') ||
          skill.slug.includes('string_instruments') ||
          skill.slug.includes('advanced_strings') ||
          skill.slug.includes('modern_bass') ||
          skill.slug.includes('keyboard_piano') ||
          skill.slug.includes('synths_keys') ||
          skill.slug.includes('percussion_drums') ||
          skill.slug.includes('electronic_percussion') ||
          skill.slug.includes('wind_instruments') ||
          skill.slug.includes('brass_instruments') ||
          skill.slug.includes('world_folk') ||
          skill.slug.includes('dj_live') ||
          skill.slug.includes('electronic_sampling') ||
          skill.slug.includes('vocal_performance') ||
          skill.slug.includes('vocal_fx') ||
          skill.slug.includes('hybrid_experimental') ||
          skill.slug.includes('orchestral_cinematic') ||
          skill.slug.includes('digital_music_tools') ||
          skill.slug.includes('sound_engineering') ||
          skill.slug.includes('songwriting_arrangement') ||
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

  // Group skills by tier within each category
  const groupSkillsByTier = (skills: SkillDefinition[]) => {
    const basic = skills.filter(s => getSkillTier(s.slug) === 'basic');
    const professional = skills.filter(s => getSkillTier(s.slug) === 'professional');
    const mastery = skills.filter(s => getSkillTier(s.slug) === 'mastery');
    return { basic, professional, mastery };
  };

  const categories = categorizeSkills();
  const selectedCategoryData = categories.find(cat => 
    cat.name.toLowerCase().includes(selectedCategory)
  ) || categories[0];

  const { basic, professional, mastery } = groupSkillsByTier(selectedCategoryData.skills);

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
        <h2 className="text-2xl font-bold">Skill Hierarchy</h2>
        
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

      <div className="space-y-4">
        {/* Basic Skills */}
        {basic.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-green-700">Basic Skills</h3>
            {basic.map((skill) => {
              const skillProgress = getSkillProgress(skill.slug);
              return (
                <HierarchicalSkillNode
                  key={skill.id}
                  skill={skill}
                  progress={skillProgress ? {
                    current_level: skillProgress.current_level || 0,
                    current_xp: skillProgress.current_xp || 0,
                    required_xp: skillProgress.required_xp || 100
                  } : null}
                  tier="basic"
                  xpBalance={xpBalance}
                  onTrain={handleSkillTrained}
                >
                  {/* Professional skills that build on this basic skill */}
                  {professional
                    .filter(prof => prof.slug.includes(skill.slug.replace('basic_', '')))
                    .map(profSkill => {
                      const profProgress = getSkillProgress(profSkill.slug);
                      return (
                        <HierarchicalSkillNode
                          key={profSkill.id}
                          skill={profSkill}
                          progress={profProgress ? {
                            current_level: profProgress.current_level || 0,
                            current_xp: profProgress.current_xp || 0,
                            required_xp: profProgress.required_xp || 100
                          } : null}
                          tier="professional"
                          isLocked={!skillProgress || (skillProgress.current_level || 0) < 5}
                          xpBalance={xpBalance}
                          onTrain={handleSkillTrained}
                        >
                          {/* Mastery skills that build on this professional skill */}
                          {mastery
                            .filter(mast => mast.slug.includes(profSkill.slug.replace('professional_', '')))
                            .map(mastSkill => {
                              const mastProgress = getSkillProgress(mastSkill.slug);
                              return (
                                <HierarchicalSkillNode
                                  key={mastSkill.id}
                                  skill={mastSkill}
                                  progress={mastProgress ? {
                                    current_level: mastProgress.current_level || 0,
                                    current_xp: mastProgress.current_xp || 0,
                                    required_xp: mastProgress.required_xp || 100
                                  } : null}
                                  tier="mastery"
                                  isLocked={!profProgress || (profProgress.current_level || 0) < 10}
                                  xpBalance={xpBalance}
                                  onTrain={handleSkillTrained}
                                />
                              );
                            })}
                        </HierarchicalSkillNode>
                      );
                    })}
                </HierarchicalSkillNode>
              );
            })}
          </div>
        )}

        {/* Standalone Professional Skills */}
        {professional.filter(prof => !basic.some(b => prof.slug.includes(b.slug.replace('basic_', '')))).length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-blue-700">Professional Skills</h3>
            {professional
              .filter(prof => !basic.some(b => prof.slug.includes(b.slug.replace('basic_', ''))))
              .map((skill) => {
                const skillProgress = getSkillProgress(skill.slug);
                return (
                  <HierarchicalSkillNode
                    key={skill.id}
                    skill={skill}
                    progress={skillProgress ? {
                      current_level: skillProgress.current_level || 0,
                      current_xp: skillProgress.current_xp || 0,
                      required_xp: skillProgress.required_xp || 100
                    } : null}
                    tier="professional"
                    xpBalance={xpBalance}
                    onTrain={handleSkillTrained}
                  />
                );
              })}
          </div>
        )}

        {/* Standalone Mastery Skills */}
        {mastery.filter(mast => 
          !professional.some(prof => mast.slug.includes(prof.slug.replace('professional_', ''))) &&
          !basic.some(b => mast.slug.includes(b.slug.replace('basic_', '')))
        ).length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-purple-700">Mastery Skills</h3>
            {mastery
              .filter(mast => 
                !professional.some(prof => mast.slug.includes(prof.slug.replace('professional_', ''))) &&
                !basic.some(b => mast.slug.includes(b.slug.replace('basic_', '')))
              )
              .map((skill) => {
                const skillProgress = getSkillProgress(skill.slug);
                return (
                  <HierarchicalSkillNode
                    key={skill.id}
                    skill={skill}
                    progress={skillProgress ? {
                      current_level: skillProgress.current_level || 0,
                      current_xp: skillProgress.current_xp || 0,
                      required_xp: skillProgress.required_xp || 100
                    } : null}
                    tier="mastery"
                    xpBalance={xpBalance}
                    onTrain={handleSkillTrained}
                  />
                );
              })}
          </div>
        )}
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
