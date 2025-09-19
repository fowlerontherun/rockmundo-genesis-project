import React, { createContext, useContext, useState } from 'react';
import type { Database } from '@/integrations/supabase/types';

type SkillDefinition = Database['public']['Tables']['skill_definitions']['Row'];

interface SkillSystemContextType {
  skills: SkillDefinition[];
  loading: boolean;
  error: string | null;
}

const SkillSystemContext = createContext<SkillSystemContextType>({
  skills: [],
  loading: false,
  error: null,
});

// eslint-disable-next-line react-refresh/only-export-components
export const useSkillSystem = () => useContext(SkillSystemContext);

export const SkillSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [skills] = useState<SkillDefinition[]>([]);
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  return (
    <SkillSystemContext.Provider value={{ skills, loading, error }}>
      {children}
    </SkillSystemContext.Provider>
  );
};