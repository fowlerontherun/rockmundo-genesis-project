import React, { createContext, useContext, useState } from 'react';
import type { Database } from '@/integrations/supabase/types';

type SkillDefinition = Database['public']['Tables']['skill_definitions']['Row'];

interface SkillSystemContextType {
  skills: SkillDefinition[];
  loading: boolean;
  error: string | null;
}

export const SkillSystemProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const definitions = useMemo<SkillDefinitionRecord[]>(() => [], []);
  const relationships = useMemo<SkillRelationshipRecord[]>(() => [], []);
  const progress = useMemo<SkillProgressRecord[]>(() => [], []);
  const loading = false;
  const error: string | null = null;

// eslint-disable-next-line react-refresh/only-export-components
export const useSkillSystem = () => useContext(SkillSystemContext);

export const SkillSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [skills] = useState<SkillDefinition[]>([]);
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);


  const value = useMemo<SkillSystemContextValue>(
    () => ({
      definitions,
      relationships,
      progress,
      loading,
      error,
      refreshProgress,
      updateSkillProgress,
    }),
    [definitions, relationships, progress, loading, error, refreshProgress, updateSkillProgress],
  );

  return <SkillSystemContext.Provider value={value}>{children}</SkillSystemContext.Provider>;
};
