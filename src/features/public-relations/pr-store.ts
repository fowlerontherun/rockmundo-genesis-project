import { create } from "zustand";

export type TabKey = "campaigns" | "appearances" | "offers";

type PRFilters = {
  status: string;
  mediaType: string;
  search: string;
};

type PaginationState = Record<TabKey, number>;

type PRStoreState = {
  tab: TabKey;
  filters: PRFilters;
  pageSize: number;
  pages: PaginationState;
  setTab: (tab: TabKey) => void;
  setFilters: (filters: Partial<PRFilters>) => void;
  setFilter: (key: keyof PRFilters, value: string) => void;
  setPage: (tab: TabKey, page: number) => void;
  resetPages: () => void;
};

const defaultFilters: PRFilters = {
  status: "all",
  mediaType: "all",
  search: "",
};

const defaultPages: PaginationState = {
  campaigns: 1,
  appearances: 1,
  offers: 1,
};

export const usePRStore = create<PRStoreState>((set) => ({
  tab: "campaigns",
  filters: defaultFilters,
  pageSize: 5,
  pages: defaultPages,
  setTab: (tab) =>
    set((state) => ({
      tab,
      pages: { ...state.pages, [tab]: state.pages[tab] ?? 1 },
    })),
  setFilters: (filters) =>
    set(() => ({
      filters: { ...defaultFilters, ...filters },
      pages: defaultPages,
    })),
  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
      pages: defaultPages,
    })),
  setPage: (tab, page) =>
    set((state) => ({
      pages: { ...state.pages, [tab]: Math.max(1, page) },
    })),
  resetPages: () => set({ pages: defaultPages }),
}));
