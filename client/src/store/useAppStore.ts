import { create } from 'zustand';

export type ViewMode =
  | 'overview'
  | 'usageOverTime'
  | 'stackedEventsByProject'
  | 'uniqueUsersByProject'
  | 'activityByProject'
  | 'eventTypes';

interface AppState {
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  selectedEventId: string | null;
  setSelectedEventId: (id: string | null) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  categoryFilters: Record<string, boolean>;
  setCategoryFilter: (category: string, visible: boolean) => void;
  setAllCategoriesVisible: () => void;
  projectFilter: string | null;
  setProjectFilter: (p: string | null) => void;
  targetIdFilter: string | null;
  setTargetIdFilter: (t: string | null) => void;
  autoRefresh: boolean;
  setAutoRefresh: (v: boolean) => void;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
  connectedComponentFilter: boolean;
  setConnectedComponentFilter: (v: boolean) => void;
  useMockData: boolean;
  setUseMockData: (v: boolean) => void;
}

const defaultCategories: Record<string, boolean> = {
  project: true,
  data: true,
  execution: true,
  file: true,
  governance: true,
  environment: true,
  user: true,
  default: true,
};

export const useAppStore = create<AppState>((set) => ({
  viewMode: 'overview',
  setViewMode: (viewMode) => set({ viewMode }),
  selectedEventId: null,
  setSelectedEventId: (selectedEventId) => set({ selectedEventId }),
  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  categoryFilters: { ...defaultCategories },
  setCategoryFilter: (category, visible) =>
    set((s) => ({
      categoryFilters: { ...s.categoryFilters, [category]: visible },
    })),
  setAllCategoriesVisible: () =>
    set({ categoryFilters: { ...defaultCategories } }),
  projectFilter: null,
  setProjectFilter: (projectFilter) => set({ projectFilter }),
  targetIdFilter: null,
  setTargetIdFilter: (targetIdFilter) => set({ targetIdFilter }),
  autoRefresh: false,
  setAutoRefresh: (autoRefresh) => set({ autoRefresh }),
  highContrast: false,
  setHighContrast: (highContrast) => set({ highContrast }),
  connectedComponentFilter: false,
  setConnectedComponentFilter: (connectedComponentFilter) =>
    set({ connectedComponentFilter }),
  useMockData: false,
  setUseMockData: (useMockData) => set({ useMockData }),
}));
