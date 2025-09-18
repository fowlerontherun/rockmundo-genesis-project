import { createContext } from "react";

import { type SkillSystemContextValue } from "./useSkillSystem.types";

export const SkillSystemContext = createContext<SkillSystemContextValue | undefined>(
  undefined
);
