import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/lib/supabase-types';
import { useGameData } from '@/hooks/useGameData';
import { Star, Music, Users, Mic, Lock, ChevronDown, ChevronUp, LayoutGrid, List, Filter, GraduationCap } from 'lucide-react';
import { HierarchicalSkillNode } from './skills/HierarchicalSkillNode';
import { CompactSkillRow } from './skills/CompactSkillRow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { type EducationSource, getSourceFromActivityType } from './skills/EducationSourceBadge';

type SkillDefinition = Database['public']['Tables']['skill_definitions']['Row'];
type SkillProgress = Database['public']['Tables']['skill_progress']['Row'];

interface SkillCategory {
  key: string;
  name: string;
  icon: React.ReactNode;
  patterns: string[];
}

interface SkillTreeProps {
  xpBalance?: number;
  onXpSpent?: () => void;
}

type ViewMode = 'card' | 'list';
type FilterMode = 'all' | 'learned' | 'education' | 'unlearned';

const SKILL_CATEGORIES: SkillCategory[] = [
  {
    key: 'songwriting',
    name: 'Songwriting & Production',
    icon: <Music className="h-5 w-5" />,
    patterns: ['songwriting', 'composing', 'lyrics', 'production', 'daw', 'beatmaking', 'sampling', 'sound_design', 'mixing', 'vocal', 'ai_music', 'live_looping']
  },
  {
    key: 'genres',
    name: 'Genres',
    icon: <Star className="h-5 w-5" />,
    patterns: ['genres_', 'rock', 'pop', 'hip_hop', 'jazz', 'blues', 'edm', 'trap', 'country', 'reggae', 'metal', 'classical', 'latin', 'rnb', 'punk', 'flamenco', 'african', 'drill', 'lofi', 'kpop', 'afrobeats', 'synthwave', 'indie', 'hyperpop', 'metalcore', 'alt_rnb', 'funk', 'soul', 'gospel', 'folk', 'ska', 'grunge', 'ambient', 'house', 'techno', 'trance', 'dubstep']
  },
  {
    key: 'instruments',
    name: 'Instruments & Performance',
    icon: <Mic className="h-5 w-5" />,
    patterns: ['instruments_', 'singing', 'rapping', 'brass', 'keyboard', 'percussions', 'strings', 'woodwind', 'electronic_instruments', 'modern_bass', 'synths', 'percussion_drums', 'dj', 'midi', 'piano', 'drums', 'guitar', 'bass', 'vocals', 'violin', 'cello', 'saxophone', 'trumpet', 'harmonica']
  },
  {
    key: 'stage',
    name: 'Stage & Showmanship',
    icon: <Users className="h-5 w-5" />,
    patterns: ['showmanship', 'stage', 'visual', 'social_media', 'streaming', 'crowd', 'performance']
  }
];

const getSkillTier = (slug: string): 'basic' | 'professional' | 'mastery' => {
  if (slug.includes('_basic_') || slug.startsWith('basic_')) return 'basic';
  if (slug.includes('_professional_') || slug.startsWith('professional_') || slug.includes('professional')) return 'professional';
  if (slug.includes('_mastery') || slug.includes('mastery_')) return 'mastery';
  // Default simple slugs (vocals, guitar, etc) to basic
  return 'basic';
};

const matchesCategory = (slug: string, category: SkillCategory): boolean => {
  const lowerSlug = slug.toLowerCase();
  return category.patterns.some(pattern => lowerSlug.includes(pattern));
};

export const SkillTree: React.FC<SkillTreeProps> = ({ xpBalance = 0, onXpSpent }) => {
  const { profile } = useGameData();
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [progress, setProgress] = useState<SkillProgress[]>([]);
  const [educationSources, setEducationSources] = useState<Record<string, EducationSource[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [showUnlocked, setShowUnlocked] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filterMode, setFilterMode] = useState<FilterMode>('learned');

  const fetchData = useCallback(async () => {
    try {
      const { data: skillsData, error: skillsError } = await supabase
        .from('skill_definitions')
        .select('*')
        .order('display_name');

      if (skillsError) throw skillsError;
      setSkills(skillsData ?? []);

      if (profile) {
        // Fetch progress
        const { data: progressData, error: progressError } = await supabase
          .from('skill_progress')
          .select('*')
          .eq('profile_id', profile.id);

        if (progressError) throw progressError;
        setProgress(progressData ?? []);

        // Fetch education sources from experience_ledger
        const { data: ledgerData } = await supabase
          .from('experience_ledger')
          .select('skill_slug, activity_type')
          .eq('profile_id', profile.id)
          .not('skill_slug', 'is', null);

        if (ledgerData) {
          const sourcesMap: Record<string, Set<EducationSource>> = {};
          ledgerData.forEach(entry => {
            if (!entry.skill_slug) return;
            const source = getSourceFromActivityType(entry.activity_type);
            if (source) {
              if (!sourcesMap[entry.skill_slug]) {
                sourcesMap[entry.skill_slug] = new Set();
              }
              sourcesMap[entry.skill_slug].add(source);
            }
          });
          
          const formatted: Record<string, EducationSource[]> = {};
          Object.entries(sourcesMap).forEach(([slug, sources]) => {
            formatted[slug] = Array.from(sources);
          });
          setEducationSources(formatted);
        }
      }
    } catch (error) {
      console.error('Error fetching skills:', error);
      toast.error('Failed to load skills');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const handleSkillTrained = () => {
    setRefreshKey(prev => prev + 1);
    onXpSpent?.();
  };

  const getSkillProgress = (skillSlug: string): SkillProgress | null => {
    return progress.find(p => p.skill_slug === skillSlug) || null;
  };

  // Get set of learned skill slugs
  const learnedSlugs = useMemo(() => new Set(progress.map(p => p.skill_slug)), [progress]);
  
  // Education skill slugs
  const educationSlugs = useMemo(() => new Set(Object.keys(educationSources)), [educationSources]);

  // Filter and categorize skills
  const filteredSkills = useMemo(() => {
    let filtered = [...skills];
    
    // Also include skills from progress that might not be in definitions
    const progressSlugs = progress.map(p => p.skill_slug);
    const missingFromDefs = progressSlugs.filter(slug => !skills.some(s => s.slug === slug));
    
    // Add placeholder definitions for missing skills
    missingFromDefs.forEach(slug => {
      filtered.push({
        id: slug,
        slug,
        display_name: slug.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        description: 'Skill from education or training',
        tier_caps: null,
        created_at: null,
        updated_at: null
      });
    });

    // Apply category filter
    if (selectedCategory !== 'all') {
      const category = SKILL_CATEGORIES.find(c => c.key === selectedCategory);
      if (category) {
        filtered = filtered.filter(skill => matchesCategory(skill.slug, category));
      }
    }

    // Apply filter mode
    switch (filterMode) {
      case 'learned':
        filtered = filtered.filter(skill => learnedSlugs.has(skill.slug));
        break;
      case 'education':
        filtered = filtered.filter(skill => educationSlugs.has(skill.slug));
        break;
      case 'unlearned':
        filtered = filtered.filter(skill => !learnedSlugs.has(skill.slug));
        break;
    }

    // Sort by tier then name
    filtered.sort((a, b) => {
      const tierOrder = { basic: 0, professional: 1, mastery: 2 };
      const tierDiff = tierOrder[getSkillTier(a.slug)] - tierOrder[getSkillTier(b.slug)];
      if (tierDiff !== 0) return tierDiff;
      return a.display_name.localeCompare(b.display_name);
    });

    return filtered;
  }, [skills, progress, selectedCategory, filterMode, learnedSlugs, educationSlugs]);

  // Count skills per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: learnedSlugs.size };
    SKILL_CATEGORIES.forEach(cat => {
      counts[cat.key] = [...learnedSlugs].filter(slug => matchesCategory(slug, cat)).length;
    });
    return counts;
  }, [learnedSlugs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with controls */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">Skills</h2>
            <Badge variant="secondary">{learnedSlugs.size} learned</Badge>
            {educationSlugs.size > 0 && (
              <Badge variant="outline" className="gap-1">
                <GraduationCap className="h-3 w-3" />
                {educationSlugs.size} from education
              </Badge>
            )}
          </div>
          
          {/* View mode toggle */}
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as ViewMode)}>
            <ToggleGroupItem value="list" aria-label="List view" size="sm">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="card" aria-label="Card view" size="sm">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        
        {/* Category tabs */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('all')}
          >
            All
            <Badge variant="secondary" className="ml-1.5 text-xs">{categoryCounts.all}</Badge>
          </Button>
          {SKILL_CATEGORIES.map((category) => (
            <Button
              key={category.key}
              variant={selectedCategory === category.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category.key)}
              className="flex items-center gap-1.5"
            >
              {category.icon}
              <span className="hidden sm:inline">{category.name}</span>
              <span className="sm:hidden">{category.key.charAt(0).toUpperCase() + category.key.slice(1)}</span>
              <Badge variant="secondary" className="ml-1 text-xs">{categoryCounts[category.key] || 0}</Badge>
            </Button>
          ))}
        </div>

        {/* Filter mode */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <ToggleGroup type="single" value={filterMode} onValueChange={(v) => v && setFilterMode(v as FilterMode)}>
            <ToggleGroupItem value="learned" size="sm">Learned</ToggleGroupItem>
            <ToggleGroupItem value="education" size="sm">
              <GraduationCap className="h-3 w-3 mr-1" />
              Education
            </ToggleGroupItem>
            <ToggleGroupItem value="all" size="sm">All</ToggleGroupItem>
            <ToggleGroupItem value="unlearned" size="sm">Unlearned</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Skills display */}
      <ScrollArea className="h-[500px] rounded-md border p-3">
        {filteredSkills.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No skills found matching your filters.</p>
            <p className="text-sm mt-1">Try changing the category or filter.</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-1.5">
            {filteredSkills.map((skill) => {
              const skillProgress = getSkillProgress(skill.slug);
              const tier = getSkillTier(skill.slug);
              return (
                <CompactSkillRow
                  key={skill.id}
                  skill={skill}
                  progress={skillProgress ? {
                    current_level: skillProgress.current_level || 0,
                    current_xp: skillProgress.current_xp || 0,
                    required_xp: skillProgress.required_xp || 100
                  } : null}
                  tier={tier}
                  xpBalance={xpBalance}
                  educationSources={educationSources[skill.slug] || []}
                  onTrain={handleSkillTrained}
                />
              );
            })}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredSkills.map((skill) => {
              const skillProgress = getSkillProgress(skill.slug);
              const tier = getSkillTier(skill.slug);
              return (
                <HierarchicalSkillNode
                  key={skill.id}
                  skill={skill}
                  progress={skillProgress ? {
                    current_level: skillProgress.current_level || 0,
                    current_xp: skillProgress.current_xp || 0,
                    required_xp: skillProgress.required_xp || 100
                  } : null}
                  tier={tier}
                  xpBalance={xpBalance}
                  onTrain={handleSkillTrained}
                />
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Skills Not Started Section */}
      {filterMode !== 'unlearned' && skills.filter(s => !learnedSlugs.has(s.slug)).length > 0 && (
        <Card className="border-muted bg-muted/20">
          <Collapsible open={showUnlocked} onOpenChange={setShowUnlocked}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3">
                <CardTitle className="flex items-center justify-between text-muted-foreground text-sm">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    <span>Skills Not Started</span>
                    <Badge variant="secondary" className="ml-1">
                      {skills.filter(s => !learnedSlugs.has(s.slug)).length}
                    </Badge>
                  </div>
                  {showUnlocked ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground mb-3">
                  Learn skills through University, Books, Mentors, or YouTube videos.
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {skills.filter(s => !learnedSlugs.has(s.slug)).slice(0, 24).map((skill) => (
                    <div 
                      key={skill.id} 
                      className="p-2 rounded border border-muted bg-background/50 opacity-60"
                    >
                      <p className="text-xs font-medium truncate">{skill.display_name}</p>
                      <Badge variant="outline" className="text-xs mt-0.5">
                        {getSkillTier(skill.slug)}
                      </Badge>
                    </div>
                  ))}
                  {skills.filter(s => !learnedSlugs.has(s.slug)).length > 24 && (
                    <div className="p-2 text-xs text-muted-foreground">
                      +{skills.filter(s => !learnedSlugs.has(s.slug)).length - 24} more
                    </div>
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}
    </div>
  );
};

export default SkillTree;
