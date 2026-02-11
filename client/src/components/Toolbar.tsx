import { useAppStore, type ViewMode } from '../store/useAppStore';
import { TimeRangePicker, type TimeRange } from './TimeRangePicker';

const VIEW_LABELS: { id: ViewMode; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'usageOverTime', label: 'Usage over time' },
  { id: 'activityByProject', label: 'By project' },
  { id: 'eventTypes', label: 'Event types' },
];

interface ToolbarProps {
  timeRange: TimeRange;
  onTimeRangeChange: (r: TimeRange) => void;
  onRefresh: () => void;
  lastUpdated: Date | null;
  eventCount: number;
  isLoading?: boolean;
}

export function Toolbar({
  timeRange,
  onTimeRangeChange,
  onRefresh,
  lastUpdated,
  eventCount,
  isLoading,
}: ToolbarProps) {
  const { viewMode, setViewMode, useMockData, setUseMockData, autoRefresh, setAutoRefresh } = useAppStore();

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#DBE4E8] bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <img src="./domino-logo.svg" alt="" className="h-8" />
          <h1 className="text-lg font-medium text-[#3F4547]">Usage Patterns</h1>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#7F8385]">Time range</span>
            <TimeRangePicker value={timeRange} onChange={onTimeRangeChange} disabled={isLoading} />
          </div>
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
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh data"
            className="min-h-[32px] rounded border border-[#C9C5F2] bg-[#EDECFB] px-3 py-1.5 text-sm text-[#1820A0] hover:bg-[#E0DEF7] disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-4 border-b border-[#DBE4E8] bg-[#FAFAFA] px-6 py-2">
        <span className="text-sm text-[#7F8385]">View</span>
        {VIEW_LABELS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setViewMode(v.id)}
            aria-pressed={viewMode === v.id}
            title={v.label}
            className={`min-h-[32px] rounded border px-3 py-1.5 text-sm ${
              viewMode === v.id
                ? 'border-[#3B3BD3] bg-[#3B3BD3] text-white'
                : 'border-[#DBE4E8] bg-white text-[#3F4547] hover:bg-[#EDECFB]'
            }`}
          >
            {v.label}
          </button>
        ))}
        <span className="ml-auto text-sm text-[#7F8385]">
          {eventCount.toLocaleString()} events · Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}
        </span>
      </div>
    </>
  );
}
