import { useState } from 'react';
import { useAppStore, type ViewMode } from '../store/useAppStore';
import { TimeRangePicker, type TimeRange } from './TimeRangePicker';
import { ScheduleReportModal } from './ScheduleReportModal';

const VIEW_LABELS: { id: ViewMode; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'jobRuns', label: 'Job runs' },
  { id: 'adoptionBreakdown', label: 'SAS vs SLC adoption' },
  { id: 'computeInsights', label: 'Compute insights' },
  { id: 'dataCoverage', label: 'Data coverage' },
  { id: 'usageOverTime', label: 'Usage over time' },
  { id: 'stackedEventsByProject', label: 'Stacked by project' },
  { id: 'uniqueUsersByProject', label: 'Users per project' },
  { id: 'activityByProject', label: 'By project' },
  { id: 'eventTypes', label: 'Event types' },
];

interface ToolbarProps {
  timeRange: TimeRange;
  onTimeRangeChange: (r: TimeRange) => void;
  lastUpdated: Date | null;
  eventCount: number;
  isLoading?: boolean;
}

export function Toolbar({
  timeRange,
  onTimeRangeChange,
  lastUpdated,
  eventCount,
  isLoading,
}: ToolbarProps) {
  const { viewMode, setViewMode, useMockData, setUseMockData } = useAppStore();
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#DBE4E8] bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <img src="./domino-logo.svg" alt="" className="h-8" />
          <h1 className="text-lg font-medium text-[#3F4547]">Usage Trends</h1>
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
              aria-label="Use demo data from CSV"
              className="h-4 w-4 rounded border-[#DBE4E8]"
            />
            <span className="text-[#3F4547]">Demo data</span>
          </label>
          <button
            type="button"
            onClick={() => setScheduleModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded border border-[#543FDE] bg-[#543FDE] px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-[#3B23D1]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Schedule Report
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

      <ScheduleReportModal open={scheduleModalOpen} onClose={() => setScheduleModalOpen(false)} />
    </>
  );
}
