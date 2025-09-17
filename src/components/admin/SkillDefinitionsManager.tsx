import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { toast } from '@/components/ui/sonner-toast';
import {
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  SparklesIcon,
  Trash2,
} from 'lucide-react';

interface TierCapFormRow {
  key: string;
  value: string;
}

type SkillDefinitionRow = Tables<'skill_definitions'>;
type SkillParentLinkRow = Tables<'skill_parent_links'>;

interface SkillParentAssignment {
  id: string;
  parentSkillId: string;
  unlockThreshold: number | null;
  parentSkill?: {
    id: string;
    slug: string;
    displayName: string;
  };
}

interface SkillDefinitionWithParents {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  tierCaps: Record<string, number>;
  parentLinks: SkillParentAssignment[];
}

interface SkillDefinitionFormState {
  slug: string;
  displayName: string;
  description: string;
  tierCaps: TierCapFormRow[];
}

const createDefaultTierRows = (): TierCapFormRow[] => [
  { key: 'tier_1', value: '' },
  { key: 'tier_2', value: '' },
  { key: 'tier_3', value: '' },
];

const buildTierRowsFromCaps = (tierCaps: Record<string, number>): TierCapFormRow[] => {
  const entries = Object.entries(tierCaps);

  if (entries.length === 0) {
    return createDefaultTierRows();
  }

  return entries
    .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
    .map(([key, value]) => ({
      key,
      value: Number.isFinite(value) ? value.toString() : '',
    }));
};

const normalizeTierCaps = (rows: TierCapFormRow[]): Record<string, number> => {
  return rows.reduce<Record<string, number>>((accumulator, row) => {
    const key = row.key.trim();

    if (!key) {
      return accumulator;
    }

    const numericValue = Number(row.value);

    if (Number.isFinite(numericValue)) {
      accumulator[key] = numericValue;
    }

    return accumulator;
  }, {});
};

const parseTierCaps = (tierCaps: SkillDefinitionRow['tier_caps']): Record<string, number> => {
  if (!tierCaps || typeof tierCaps !== 'object' || Array.isArray(tierCaps)) {
    return {};
  }

  return Object.entries(tierCaps as Record<string, unknown>).reduce<Record<string, number>>(
    (accumulator, [key, value]) => {
      const numeric = Number(value);

      if (Number.isFinite(numeric)) {
        accumulator[key] = numeric;
      }

      return accumulator;
    },
    {},
  );
};

const initialSkillForm: SkillDefinitionFormState = {
  slug: '',
  displayName: '',
  description: '',
  tierCaps: createDefaultTierRows(),
};

const SkillDefinitionsManager: React.FC = () => {
  const [skillDefinitions, setSkillDefinitions] = useState<SkillDefinitionWithParents[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [skillForm, setSkillForm] = useState<SkillDefinitionFormState>(initialSkillForm);
  const [savingSkill, setSavingSkill] = useState(false);
  const [creatingParent, setCreatingParent] = useState(false);
  const [parentForm, setParentForm] = useState({ parentSkillId: '', unlockThreshold: '' });
  const [parentEdits, setParentEdits] = useState<Record<string, string>>({});
  const [parentSavingId, setParentSavingId] = useState<string | null>(null);
  const [deletingSkillId, setDeletingSkillId] = useState<string | null>(null);
  const [deletingParentId, setDeletingParentId] = useState<string | null>(null);
  const [skillDeleteTarget, setSkillDeleteTarget] = useState<SkillDefinitionWithParents | null>(null);
  const [parentDeleteTarget, setParentDeleteTarget] = useState<
    { skillId: string; link: SkillParentAssignment } | null
  >(null);

  const fetchSkills = useCallback(async (initialLoad = false) => {
    if (initialLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const [skillsResponse, parentLinksResponse] = await Promise.all([
        supabase
          .from('skill_definitions')
          .select('*')
          .order('display_name', { ascending: true }),
        supabase.from('skill_parent_links').select('*'),
      ]);

      if (skillsResponse.error) {
        throw skillsResponse.error;
      }

      if (parentLinksResponse.error) {
        throw parentLinksResponse.error;
      }

      const skillRows = (skillsResponse.data ?? []) as SkillDefinitionRow[];
      const parentRows = (parentLinksResponse.data ?? []) as SkillParentLinkRow[];

      const normalizedSkills = skillRows.map<SkillDefinitionWithParents>((row) => ({
        id: row.id,
        slug: row.slug,
        displayName: row.display_name,
        description: row.description ?? null,
        tierCaps: parseTierCaps(row.tier_caps),
        parentLinks: [],
      }));

      const skillsById = new Map<string, SkillDefinitionWithParents>();
      normalizedSkills.forEach((skill) => {
        skillsById.set(skill.id, skill);
      });

      parentRows.forEach((link) => {
        const skill = skillsById.get(link.skill_id);

        if (!skill) {
          return;
        }

        const parentSkill = skillsById.get(link.parent_skill_id);
        const unlockThreshold =
          typeof link.unlock_threshold === 'number' && Number.isFinite(link.unlock_threshold)
            ? link.unlock_threshold
            : null;

        skill.parentLinks.push({
          id: link.id,
          parentSkillId: link.parent_skill_id,
          unlockThreshold,
          parentSkill: parentSkill
            ? {
                id: parentSkill.id,
                slug: parentSkill.slug,
                displayName: parentSkill.displayName,
              }
            : undefined,
        });
      });

      normalizedSkills.forEach((skill) => {
        skill.parentLinks.sort((a, b) => {
          const aName = a.parentSkill?.displayName ?? a.parentSkill?.slug ?? a.parentSkillId;
          const bName = b.parentSkill?.displayName ?? b.parentSkill?.slug ?? b.parentSkillId;

          return aName.localeCompare(bName);
        });
      });

      setSkillDefinitions(normalizedSkills);
    } catch (error) {
      console.error('Error loading skill definitions:', error);
      toast.error('Failed to load skill definitions');
    } finally {
      if (initialLoad) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }, []);

  const clearSkillForm = () => {
    setSelectedSkillId(null);
    setSkillForm(initialSkillForm);
    setParentForm({ parentSkillId: '', unlockThreshold: '' });
    setParentEdits({});
    setCreatingParent(false);
  };

  const handleEditSkill = (skill: SkillDefinitionWithParents) => {
    setSelectedSkillId(skill.id);
    setSkillForm({
      slug: skill.slug,
      displayName: skill.displayName,
      description: skill.description ?? '',
      tierCaps: buildTierRowsFromCaps(skill.tierCaps),
    });
    setParentForm({ parentSkillId: '', unlockThreshold: '' });
    setParentEdits(
      skill.parentLinks.reduce<Record<string, string>>((accumulator, link) => {
        accumulator[link.id] = link.unlockThreshold?.toString() ?? '';
        return accumulator;
      }, {}),
    );
  };

  useEffect(() => {
    fetchSkills(true);
  }, [fetchSkills]);

  useEffect(() => {
    if (!selectedSkillId) {
      return;
    }

    const skill = skillDefinitions.find((item) => item.id === selectedSkillId);

    if (!skill) {
      return;
    }

    setParentEdits(
      skill.parentLinks.reduce<Record<string, string>>((accumulator, link) => {
        accumulator[link.id] = link.unlockThreshold?.toString() ?? '';
        return accumulator;
      }, {}),
    );

    setSkillForm((previous) => {
      if (
        previous.slug === skill.slug &&
        previous.displayName === skill.displayName &&
        previous.description === (skill.description ?? '')
      ) {
        return previous;
      }

      return {
        slug: skill.slug,
        displayName: skill.displayName,
        description: skill.description ?? '',
        tierCaps: buildTierRowsFromCaps(skill.tierCaps),
      };
    });
  }, [selectedSkillId, skillDefinitions]);

  const selectedSkill = useMemo(
    () => skillDefinitions.find((skill) => skill.id === selectedSkillId) ?? null,
    [skillDefinitions, selectedSkillId],
  );

  const availableParentOptions = useMemo(() => {
    if (!selectedSkill) {
      return [];
    }

    const assignedParents = new Set(selectedSkill.parentLinks.map((link) => link.parentSkillId));

    return skillDefinitions.filter(
      (skill) => skill.id !== selectedSkill.id && !assignedParents.has(skill.id),
    );
  }, [skillDefinitions, selectedSkill]);

  const handleSkillSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = {
      slug: skillForm.slug.trim(),
      display_name: skillForm.displayName.trim(),
      description: skillForm.description.trim() || null,
      tier_caps: normalizeTierCaps(skillForm.tierCaps),
    };

    if (!payload.slug) {
      toast.error('Slug is required');
      return;
    }

    if (!payload.display_name) {
      toast.error('Display name is required');
      return;
    }

    setSavingSkill(true);

    try {
      if (selectedSkillId) {
        const { error } = await supabase
          .from('skill_definitions')
          .update(payload)
          .eq('id', selectedSkillId);

        if (error) {
          throw error;
        }

        toast.success('Skill definition updated');
      } else {
        const { error } = await supabase.from('skill_definitions').insert([payload]);

        if (error) {
          throw error;
        }

        toast.success('Skill definition created');
        clearSkillForm();
      }

      await fetchSkills(false);
    } catch (error) {
      console.error('Error saving skill definition:', error);
      toast.error('Failed to save skill definition');
    } finally {
      setSavingSkill(false);
    }
  };

  const handleAddTierRow = () => {
    setSkillForm((previous) => ({
      ...previous,
      tierCaps: [...previous.tierCaps, { key: '', value: '' }],
    }));
  };

  const handleRemoveTierRow = (index: number) => {
    setSkillForm((previous) => {
      const updated = previous.tierCaps.filter((_, rowIndex) => rowIndex !== index);

      return {
        ...previous,
        tierCaps: updated.length > 0 ? updated : createDefaultTierRows(),
      };
    });
  };

  const handleTierRowChange = (index: number, field: 'key' | 'value', value: string) => {
    setSkillForm((previous) => {
      const updated = previous.tierCaps.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: value,
            }
          : row,
      );

      return {
        ...previous,
        tierCaps: updated,
      };
    });
  };

  const handleParentCreate = async () => {
    if (!selectedSkillId || !parentForm.parentSkillId) {
      toast.error('Select a parent skill before linking');
      return;
    }

    const thresholdValue = parentForm.unlockThreshold.trim();
    const unlockThreshold = thresholdValue === '' ? null : Number(thresholdValue);

    if (thresholdValue !== '' && !Number.isFinite(unlockThreshold)) {
      toast.error('Unlock threshold must be a number');
      return;
    }

    setCreatingParent(true);

    try {
      const { error } = await supabase.from('skill_parent_links').insert([
        {
          skill_id: selectedSkillId,
          parent_skill_id: parentForm.parentSkillId,
          unlock_threshold: unlockThreshold,
        },
      ]);

      if (error) {
        throw error;
      }

      toast.success('Parent skill linked');
      setParentForm({ parentSkillId: '', unlockThreshold: '' });
      await fetchSkills(false);
    } catch (error) {
      console.error('Error linking parent skill:', error);
      toast.error('Failed to link parent skill');
    } finally {
      setCreatingParent(false);
    }
  };

  const handleParentUpdate = async (link: SkillParentAssignment) => {
    const thresholdValue = (parentEdits[link.id] ?? '').trim();
    const unlockThreshold = thresholdValue === '' ? null : Number(thresholdValue);

    if (thresholdValue !== '' && !Number.isFinite(unlockThreshold)) {
      toast.error('Unlock threshold must be a valid number');
      return;
    }

    setParentSavingId(link.id);

    try {
      const { error } = await supabase
        .from('skill_parent_links')
        .update({ unlock_threshold: unlockThreshold })
        .eq('id', link.id);

      if (error) {
        throw error;
      }

      toast.success('Parent requirement updated');
      await fetchSkills(false);
    } catch (error) {
      console.error('Error updating parent requirement:', error);
      toast.error('Failed to update parent requirement');
    } finally {
      setParentSavingId(null);
    }
  };

  const handleConfirmSkillDelete = async () => {
    if (!skillDeleteTarget) {
      return;
    }

    const { id, displayName } = skillDeleteTarget;
    setDeletingSkillId(id);

    try {
      const { error } = await supabase.from('skill_definitions').delete().eq('id', id);

      if (error) {
        throw error;
      }

      toast.success(`Skill "${displayName}" deleted`);

      if (selectedSkillId === id) {
        clearSkillForm();
      }

      await fetchSkills(false);
    } catch (error) {
      console.error('Error deleting skill definition:', error);
      toast.error('Failed to delete skill definition');
    } finally {
      setDeletingSkillId(null);
      setSkillDeleteTarget(null);
    }
  };

  const handleConfirmParentDelete = async () => {
    if (!parentDeleteTarget) {
      return;
    }

    const { link } = parentDeleteTarget;
    setDeletingParentId(link.id);

    try {
      const { error } = await supabase.from('skill_parent_links').delete().eq('id', link.id);

      if (error) {
        throw error;
      }

      toast.success('Parent skill removed');
      await fetchSkills(false);
    } catch (error) {
      console.error('Error removing parent skill link:', error);
      toast.error('Failed to remove parent skill');
    } finally {
      setDeletingParentId(null);
      setParentDeleteTarget(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <SparklesIcon className="w-7 h-7 text-primary" />
          <div>
            <CardTitle>Skill Definitions</CardTitle>
            <CardDescription>
              Configure skill metadata, tier caps, and parent prerequisites for progression.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {selectedSkill ? `Edit: ${selectedSkill.displayName}` : 'Create Skill Definition'}
              </h3>
              {selectedSkill && (
                <Button variant="outline" size="sm" onClick={clearSkillForm} disabled={savingSkill}>
                  New Skill
                </Button>
              )}
            </div>
            <form className="space-y-4" onSubmit={handleSkillSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium">Slug</label>
                <Input
                  placeholder="performance"
                  value={skillForm.slug}
                  onChange={(event) =>
                    setSkillForm((previous) => ({ ...previous, slug: event.target.value }))
                  }
                  disabled={savingSkill}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Display Name</label>
                <Input
                  placeholder="Performance"
                  value={skillForm.displayName}
                  onChange={(event) =>
                    setSkillForm((previous) => ({ ...previous, displayName: event.target.value }))
                  }
                  disabled={savingSkill}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Impacts live shows, fan engagement, and performance outcomes."
                  value={skillForm.description}
                  onChange={(event) =>
                    setSkillForm((previous) => ({ ...previous, description: event.target.value }))
                  }
                  disabled={savingSkill}
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Tier Caps</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddTierRow}
                    disabled={savingSkill}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add tier
                  </Button>
                </div>
                <div className="space-y-2">
                  {skillForm.tierCaps.map((row, index) => (
                    <div key={`${row.key}-${index}`} className="flex items-center gap-2">
                      <Input
                        placeholder="tier_1"
                        value={row.key}
                        onChange={(event) => handleTierRowChange(index, 'key', event.target.value)}
                        disabled={savingSkill}
                      />
                      <Input
                        placeholder="50"
                        value={row.value}
                        type="number"
                        onChange={(event) => handleTierRowChange(index, 'value', event.target.value)}
                        disabled={savingSkill}
                      />
                      {skillForm.tierCaps.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveTierRow(index)}
                          disabled={savingSkill}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Button type="submit" className="w-full" disabled={savingSkill}>
                  {savingSkill ? 'Saving...' : selectedSkill ? 'Update Skill' : 'Create Skill'}
                </Button>
                {selectedSkill && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={clearSkillForm}
                    disabled={savingSkill}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
            {selectedSkill && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-semibold flex items-center gap-2">
                    <GitBranch className="w-4 h-4" /> Parent Skills
                  </h4>
                  <Badge variant="outline">{selectedSkill.parentLinks.length} linked</Badge>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Parent Skill</label>
                    <Select
                      value={parentForm.parentSkillId}
                      onValueChange={(value) =>
                        setParentForm((previous) => ({ ...previous, parentSkillId: value }))
                      }
                      disabled={creatingParent || availableParentOptions.length === 0}
                    >
                      <SelectTrigger className="text-left">
                        <SelectValue
                          placeholder={
                            availableParentOptions.length === 0
                              ? 'No available parent skills'
                              : 'Select parent skill'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {availableParentOptions.map((skill) => (
                          <SelectItem key={skill.id} value={skill.id}>
                            {skill.displayName} ({skill.slug})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Unlock Threshold</label>
                    <Input
                      placeholder="35"
                      value={parentForm.unlockThreshold}
                      onChange={(event) =>
                        setParentForm((previous) => ({
                          ...previous,
                          unlockThreshold: event.target.value,
                        }))
                      }
                      disabled={creatingParent}
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional. Minimum level required on the parent skill to unlock this skill tier.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleParentCreate}
                    disabled={creatingParent || !parentForm.parentSkillId}
                    className="w-full"
                  >
                    {creatingParent ? 'Linking...' : 'Link Parent Skill'}
                  </Button>
                </div>
                <div className="space-y-3">
                  {selectedSkill.parentLinks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No parent skills linked yet.</p>
                  ) : (
                    selectedSkill.parentLinks.map((link) => (
                      <div key={link.id} className="border rounded-lg p-3 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium">
                              {link.parentSkill?.displayName ?? 'Unknown Skill'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {link.parentSkill?.slug ?? link.parentSkillId}
                            </div>
                          </div>
                          <Badge variant="outline" className="flex items-center gap-1 text-xs">
                            <GitBranch className="w-3 h-3" /> Parent
                          </Badge>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Unlock Threshold</span>
                            <Input
                              className="w-28"
                              type="number"
                              value={parentEdits[link.id] ?? ''}
                              onChange={(event) =>
                                setParentEdits((previous) => ({
                                  ...previous,
                                  [link.id]: event.target.value,
                                }))
                              }
                              disabled={parentSavingId === link.id || deletingParentId === link.id}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleParentUpdate(link)}
                              disabled={parentSavingId === link.id || deletingParentId === link.id}
                            >
                              {parentSavingId === link.id ? (
                                <span className="flex items-center gap-1">
                                  <Loader2 className="w-4 h-4 animate-spin" /> Saving
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Save className="w-4 h-4" /> Save
                                </span>
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                setParentDeleteTarget({ skillId: selectedSkill.id, link })
                              }
                              disabled={parentSavingId === link.id || deletingParentId === link.id}
                            >
                              {deletingParentId === link.id ? 'Removing...' : 'Remove'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Existing Skills</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchSkills(false)}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            </div>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : skillDefinitions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No skill definitions have been created yet.</p>
            ) : (
              <div className="space-y-4">
                {skillDefinitions.map((skill) => (
                  <div key={skill.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="font-semibold text-base">{skill.displayName}</div>
                        <div className="text-xs uppercase text-muted-foreground tracking-wide">
                          {skill.slug}
                        </div>
                      </div>
                      <Badge variant="outline" className="flex items-center gap-1 text-xs">
                        <SparklesIcon className="w-3 h-3" /> {skill.parentLinks.length} parents
                      </Badge>
                    </div>
                    {skill.description && (
                      <p className="text-sm text-muted-foreground">{skill.description}</p>
                    )}
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Tier Caps
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Object.keys(skill.tierCaps).length === 0 ? (
                          <Badge variant="outline" className="text-xs">
                            No caps configured
                          </Badge>
                        ) : (
                          Object.entries(skill.tierCaps)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([tier, cap]) => (
                              <Badge key={tier} variant="secondary" className="text-xs">
                                {tier}: {cap}
                              </Badge>
                            ))
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Parent Skills
                      </div>
                      {skill.parentLinks.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No parent skills assigned.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {skill.parentLinks.map((link) => (
                            <Badge key={link.id} variant="outline" className="text-xs flex items-center gap-1">
                              <GitBranch className="w-3 h-3" />
                              {link.parentSkill?.displayName ?? link.parentSkill?.slug ?? 'Unknown'}
                              {typeof link.unlockThreshold === 'number'
                                ? ` • ${link.unlockThreshold}`
                                : ''}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditSkill(skill)}
                        disabled={deletingSkillId === skill.id}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setSkillDeleteTarget(skill)}
                        disabled={deletingSkillId === skill.id}
                      >
                        {deletingSkillId === skill.id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>

      <AlertDialog
        open={Boolean(skillDeleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setSkillDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete skill definition</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{skillDeleteTarget?.displayName}"? This action cannot be
              undone and will remove any parent relationships that depend on it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSkillId === skillDeleteTarget?.id}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSkillDelete}
              disabled={deletingSkillId === skillDeleteTarget?.id}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingSkillId === skillDeleteTarget?.id ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(parentDeleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setParentDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove parent relationship</AlertDialogTitle>
            <AlertDialogDescription>
              Removing this parent will allow the skill to progress without the linked prerequisite.
              Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingParentId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmParentDelete}
              disabled={Boolean(deletingParentId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingParentId ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default SkillDefinitionsManager;
