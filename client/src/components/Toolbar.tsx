import { useAppStore, type ViewMode } from '../store/useAppStore';
import { TimeRangePicker, type TimeRange } from './TimeRangePicker';
import { UserFilter, type UserOption } from './UserFilter';

const VIEW_LABELS: { id: ViewMode; label: string }[] = [
  { id: 'table', label: 'Table' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'userJourney', label: 'User journey' },
  { id: 'activityByProject', label: 'By project' },
  { id: 'eventTypes', label: 'Event types' },
];

interface ToolbarProps {
  timeRange: TimeRange;
  onTimeRangeChange: (r: TimeRange) => void;
  selectedUserIds: string[];
  onSelectedUserIdsChange: (ids: string[]) => void;
  users: UserOption[];
  currentUser?: { id?: string; userName?: string } | null;
  usersLoading?: boolean;
  onRefresh: () => void;
  lastUpdated: Date | null;
  eventCount: number;
  projects: string[];
  isLoading?: boolean;
}

export function Toolbar({
  timeRange,
  onTimeRangeChange,
  selectedUserIds,
  onSelectedUserIdsChange,
  users,
  currentUser,
  usersLoading,
  onRefresh,
  lastUpdated,
  eventCount,
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
      {/* Header: title + primary filters (time, user) */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#DBE4E8] bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <img src="./domino-logo.svg" alt="" className="h-8" />
          <h1 className="text-lg font-medium text-[#3F4547]">Traceability Explorer</h1>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#7F8385]">Time range</span>
            <TimeRangePicker value={timeRange} onChange={onTimeRangeChange} disabled={isLoading} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#7F8385]">User</span>
            <UserFilter
              users={users}
              currentUser={currentUser}
              selectedUserIds={selectedUserIds}
              onSelectionChange={onSelectedUserIdsChange}
              disabled={isLoading}
              loading={usersLoading}
            />
          </div>
        </div>
      </header>

      {/* Secondary bar: search, filters, views, actions */}
      <div className="flex flex-wrap items-center gap-4 border-b border-[#DBE4E8] bg-[#FAFAFA] px-6 py-3">
        {/* Search + category filters (group 1) */}
        <div className="flex flex-1 flex-wrap items-center gap-4">
          <input
            type="search"
            placeholder="Search events, targets, metadata…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search events"
            className="min-w-[200px] max-w-xs rounded border border-[#DBE4E8] bg-white px-3 py-2 text-sm text-[#3F4547]"
          />
          <div className="flex items-center gap-3" role="group" aria-label="Category filters">
            {(['project', 'data', 'execution', 'file', 'governance', 'environment', 'user'] as const).map((cat) => (
              <label key={cat} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={categoryFilters[cat] !== false}
                  onChange={(e) => setCategoryFilter(cat, e.target.checked)}
                  className="h-4 w-4 rounded border-[#DBE4E8]"
                />
                <span className="capitalize text-[#3F4547]">{cat}</span>
              </label>
            ))}
            <button
              type="button"
              onClick={() => setAllCategoriesVisible()}
              className="rounded border border-[#C9C5F2] bg-[#EDECFB] px-2 py-1.5 text-xs text-[#1820A0] hover:bg-[#E0DEF7]"
            >
              Show all
            </button>
          </div>
        </div>

        {/* Project filter + view mode (group 2) */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="project-filter" className="sr-only">
              Filter by project
            </label>
            <select
              id="project-filter"
              value={projectFilter ?? ''}
              onChange={(e) => setProjectFilter(e.target.value || null)}
              aria-label="Filter by project"
              className="min-h-[32px] rounded border border-[#DBE4E8] bg-white px-3 py-1.5 text-sm text-[#3F4547]"
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2" role="group" aria-label="View mode">
            <span className="text-sm text-[#7F8385]">View</span>
            {VIEW_LABELS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setViewMode(v.id)}
                aria-pressed={viewMode === v.id}
                title={`Switch to ${v.label} view`}
                className={`min-h-[32px] min-w-[32px] rounded border px-2.5 py-1.5 text-sm ${
                  viewMode === v.id
                    ? 'border-[#3B3BD3] bg-[#3B3BD3] text-white'
                    : 'border-[#DBE4E8] bg-white text-[#3F4547] hover:bg-[#EDECFB]'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions (group 3) */}
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useMockData}
              onChange={(e) => setUseMockData(e.target.checked)}
              aria-label="Use mock data from CSV"
              className="h-4 w-4 rounded border-[#DBE4E8]"
            />
            <span className="text-[#3F4547]">Mock data</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              aria-label="Auto-refresh every 30 seconds"
              disabled={useMockData}
              className="h-4 w-4 rounded border-[#DBE4E8] disabled:opacity-50"
            />
            <span className="text-[#3F4547]">Auto-refresh</span>
          </label>
          <button
            type="button"
            onClick={() => setHighContrast(!highContrast)}
            aria-pressed={highContrast}
            title="Toggle high contrast mode"
            className="min-h-[32px] min-w-[32px] rounded border border-[#DBE4E8] bg-white px-2 py-1.5 text-sm text-[#3F4547] hover:bg-[#EDECFB]"
          >
            Aa
          </button>
          {targetIdFilter && (
            <button
              type="button"
              onClick={() => setTargetIdFilter(null)}
              className="rounded border border-[#C9C5F2] bg-[#EDECFB] px-2 py-1.5 text-sm text-[#1820A0] hover:bg-[#E0DEF7]"
            >
              Clear target filter
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh data"
            className="min-h-[32px] rounded border border-[#C9C5F2] bg-[#EDECFB] px-3 py-1.5 text-sm text-[#1820A0] hover:bg-[#E0DEF7] disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Status strip */}
      <div className="flex items-center justify-between border-b border-[#DBE4E8] bg-white px-6 py-2 text-sm text-[#7F8385]">
        <span>Showing {eventCount.toLocaleString()} events</span>
        <span>Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}</span>
      </div>
    </>
  );
}
