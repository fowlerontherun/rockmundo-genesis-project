import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface SkillDefinition {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  tier_caps: any;
  created_at: string;
  updated_at: string;
}

export function SkillDefinitionsManager() {
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [newSkill, setNewSkill] = useState({
    slug: '',
    display_name: '',
    description: '',
    tier_caps: {}
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    try {
      const { data, error } = await supabase
        .from('skill_definitions')
        .select('*')
        .order('display_name');

      if (error) throw error;
      setSkills(data || []);
    } catch (error) {
      console.error('Error fetching skills:', error);
      toast.error('Failed to load skills');
    }
  };

  const handleCreateSkill = async () => {
    if (!newSkill.slug || !newSkill.display_name) {
      toast.error('Please fill in required fields');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('skill_definitions')
        .insert({
          slug: newSkill.slug,
          display_name: newSkill.display_name,
          description: newSkill.description || null,
          tier_caps: newSkill.tier_caps
        });

      if (error) throw error;
      
      toast.success('Skill created successfully');
      setNewSkill({ slug: '', display_name: '', description: '', tier_caps: {} });
      fetchSkills();
    } catch (error) {
      console.error('Error creating skill:', error);
      toast.error('Failed to create skill');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSkill = async (skillId: string) => {
    if (!confirm('Are you sure you want to delete this skill?')) return;

    try {
      const { error } = await supabase
        .from('skill_definitions')
        .delete()
        .eq('id', skillId);

      if (error) throw error;
      
      toast.success('Skill deleted successfully');
      fetchSkills();
    } catch (error) {
      console.error('Error deleting skill:', error);
      toast.error('Failed to delete skill');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create New Skill</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={newSkill.slug}
              onChange={(e) => setNewSkill({ ...newSkill, slug: e.target.value })}
              placeholder="skill_slug"
            />
          </div>
          <div>
            <Label htmlFor="display_name">Display Name</Label>
            <Input
              id="display_name"
              value={newSkill.display_name}
              onChange={(e) => setNewSkill({ ...newSkill, display_name: e.target.value })}
              placeholder="Skill Name"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={newSkill.description}
              onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })}
              placeholder="Skill description..."
            />
          </div>
          <Button onClick={handleCreateSkill} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Skill'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Skills</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {skills.map((skill) => (
              <div key={skill.id} className="p-4 border rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{skill.display_name}</h3>
                    <Badge variant="secondary">{skill.slug}</Badge>
                    {skill.description && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {skill.description}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteSkill(skill.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SkillDefinitionsManager;