import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { CrewCatalogItem, createInitialCrewCatalog } from "./catalog";

interface BandCrewCatalogContextValue {
  catalog: CrewCatalogItem[];
  setCatalog: React.Dispatch<React.SetStateAction<CrewCatalogItem[]>>;
  resetCatalog: () => void;
}

const BandCrewCatalogContext = createContext<BandCrewCatalogContextValue | undefined>(undefined);

export const BandCrewCatalogProvider = ({ children }: { children: React.ReactNode }) => {
  const [catalog, setCatalog] = useState<CrewCatalogItem[]>(createInitialCrewCatalog());

  const resetCatalog = useCallback(() => {
    setCatalog(createInitialCrewCatalog());
  }, []);

  const value = useMemo(
    () => ({
      catalog,
      setCatalog,
      resetCatalog,
    }),
    [catalog, resetCatalog],
  );

  return (
    <BandCrewCatalogContext.Provider value={value}>{children}</BandCrewCatalogContext.Provider>
  );
};

export const useBandCrewCatalog = () => {
  const context = useContext(BandCrewCatalogContext);
  if (!context) {
    throw new Error("useBandCrewCatalog must be used within a BandCrewCatalogProvider");
  }
  return context;
};
