import { useContext } from "react";

import { SkillSystemContext } from "./SkillSystemContext";
import { type SkillSystemContextValue } from "./useSkillSystem.types";

export const useSkillSystem = (): SkillSystemContextValue => {
  const context = useContext(SkillSystemContext);
  if (!context) {
    throw new Error("useSkillSystem must be used within a SkillSystemProvider");
  }
  return context;
};
