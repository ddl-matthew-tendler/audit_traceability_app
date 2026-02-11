import { useAppStore, type ViewMode } from '../store/useAppStore';
import { TimeRangePicker, type TimeRange } from './TimeRangePicker';

const VIEW_LABELS: { id: ViewMode; label: string }[] = [
  { id: 'dag', label: 'DAG' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'table', label: 'Table' },
];

interface ToolbarProps {
  timeRange: TimeRange;
  onTimeRangeChange: (r: TimeRange) => void;
  onRefresh: () => void;
  lastUpdated: Date | null;
  eventCount: number;
  projects: string[];
  isLoading?: boolean;
}

export function Toolbar({
  timeRange,
  onTimeRangeChange,
  onRefresh,
  lastUpdated: _lastUpdated,
  eventCount: _eventCount,
  projects,
  isLoading,
}: ToolbarProps) {
  const {
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    categoryFilters,
    setCategoryFilter,
    setAllCategoriesVisible,
    projectFilter,
    setProjectFilter,
    targetIdFilter,
    setTargetIdFilter,
    autoRefresh,
    setAutoRefresh,
    highContrast,
    setHighContrast,
    useMockData,
    setUseMockData,
  } = useAppStore();

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-domino-border bg-[#2E2E38] px-4 py-2 text-white">
        <div className="flex items-center gap-4">
          <img src="./domino-logo.svg" alt="" className="h-8" />
          <span className="text-lg font-medium">Traceability Explorer</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <TimeRangePicker value={timeRange} onChange={onTimeRangeChange} disabled={isLoading} />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-domino-border bg-domino-bg px-4 py-2">
        <input
          type="search"
          placeholder="Search events, targets, metadata…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search events"
          className="min-w-[200px] flex-1 rounded border border-domino-border bg-domino-container px-3 py-1.5 text-sm text-domino-text"
        />
        <div className="flex items-center gap-1" role="group" aria-label="Category filters">
          {(['project', 'data', 'execution', 'file', 'governance', 'environment', 'user'] as const).map((cat) => (
            <label key={cat} className="flex cursor-pointer items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={categoryFilters[cat] !== false}
                onChange={(e) => setCategoryFilter(cat, e.target.checked)}
                className="h-4 w-4 rounded border-domino-border"
              />
              <span className="capitalize">{cat}</span>
            </label>
          ))}
          <button
            type="button"
            onClick={() => setAllCategoriesVisible()}
            className="rounded border border-domino-border bg-domino-container px-2 py-1 text-xs text-domino-text-body hover:bg-domino-bg"
          >
            Show all
          </button>
        </div>
        <select
          value={projectFilter ?? ''}
          onChange={(e) => setProjectFilter(e.target.value || null)}
          aria-label="Filter by project"
          className="rounded border border-domino-border bg-domino-container px-2 py-1 text-sm text-domino-text"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2" role="group" aria-label="View mode">
          {VIEW_LABELS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setViewMode(v.id)}
              aria-pressed={viewMode === v.id}
              className={`rounded border px-2 py-1 text-sm ${
                viewMode === v.id
                  ? 'border-domino-primary bg-domino-primary text-white'
                  : 'border-domino-border bg-domino-container text-domino-text hover:bg-domino-bg'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={useMockData}
            onChange={(e) => setUseMockData(e.target.checked)}
            aria-label="Use mock data from CSV"
          />
          Mock data
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            aria-label="Auto-refresh every 30 seconds"
            disabled={useMockData}
          />
          Auto-refresh
        </label>
        <button
          type="button"
          onClick={() => setHighContrast(!highContrast)}
          aria-pressed={highContrast}
          aria-label="Toggle high contrast mode"
          className="rounded border border-domino-border bg-domino-container px-2 py-1 text-sm hover:bg-domino-bg"
          title="High contrast"
        >
          Aa
        </button>
        {targetIdFilter && (
          <button
            type="button"
            onClick={() => setTargetIdFilter(null)}
            className="rounded border border-domino-border bg-domino-container px-2 py-1 text-sm text-domino-text-body hover:bg-domino-bg"
          >
            Clear target filter
          </button>
        )}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="rounded border border-domino-secondaryBorder bg-domino-secondarySurface px-2 py-1 text-sm text-domino-secondaryText hover:bg-domino-secondaryBorder disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
    </>
  );
}
