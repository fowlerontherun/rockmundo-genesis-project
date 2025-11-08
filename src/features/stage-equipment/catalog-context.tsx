import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { createInitialStageEquipmentCatalog, EquipmentCatalogItem } from "./catalog";

interface StageEquipmentCatalogContextValue {
  catalog: EquipmentCatalogItem[];
  setCatalog: React.Dispatch<React.SetStateAction<EquipmentCatalogItem[]>>;
  resetCatalog: () => void;
}

const StageEquipmentCatalogContext = createContext<StageEquipmentCatalogContextValue | undefined>(
  undefined,
);

export const StageEquipmentCatalogProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [catalog, setCatalog] = useState<EquipmentCatalogItem[]>(createInitialStageEquipmentCatalog());

  const resetCatalog = useCallback(() => {
    setCatalog(createInitialStageEquipmentCatalog());
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
    <StageEquipmentCatalogContext.Provider value={value}>
      {children}
    </StageEquipmentCatalogContext.Provider>
  );
};

export const useStageEquipmentCatalog = () => {
  const context = useContext(StageEquipmentCatalogContext);
  if (!context) {
    throw new Error(
      "useStageEquipmentCatalog must be used within a StageEquipmentCatalogProvider",
    );
  }
  return context;
};
