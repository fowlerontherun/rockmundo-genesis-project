import { useCallback, useMemo, type PropsWithChildren } from "react";

import { SkillSystemContext } from "./SkillSystemContext";
import {
  type SkillDefinitionRecord,
  type SkillProgressRecord,
  type SkillRelationshipRecord,
  type SkillSystemContextValue,
} from "./useSkillSystem.types";

export const SkillSystemProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const definitions = useMemo<SkillDefinitionRecord[]>(() => [], []);
  const relationships = useMemo<SkillRelationshipRecord[]>(() => [], []);
  const progress = useMemo<SkillProgressRecord[]>(() => [], []);
  const loading = false;
  const error: string | null = null;

  const refreshProgress = useCallback<SkillSystemContextValue["refreshProgress"]>(async () => {
    // The progression system is not yet implemented.
  }, []);

  const updateSkillProgress = useCallback<SkillSystemContextValue["updateSkillProgress"]>(
    async (_input) => {
      // The progression system is not yet implemented.
      return null;
    },
    [],
  );

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
