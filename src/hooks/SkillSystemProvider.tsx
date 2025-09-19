import React, { createContext, useContext, useState } from 'react';

interface SkillSystemContextType {
  skills: any[];
  loading: boolean;
  error: string | null;
}

const SkillSystemContext = createContext<SkillSystemContextType>({
  skills: [],
  loading: false,
  error: null,
});

export const useSkillSystem = () => useContext(SkillSystemContext);

export const SkillSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [skills] = useState([]);
  const [loading] = useState(false);
  const [error] = useState(null);

  return (
    <SkillSystemContext.Provider value={{ skills, loading, error }}>
      {children}
    </SkillSystemContext.Provider>
  );
};