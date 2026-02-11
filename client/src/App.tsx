import { useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toolbar } from './components/Toolbar';
import { OverviewDashboard } from './components/OverviewDashboard';
import { UsageOverTimeView } from './components/UsageOverTimeView';
import { ActivityByProjectView } from './components/ActivityByProjectView';
import { EventTypesView } from './components/EventTypesView';
import { useAppStore } from './store/useAppStore';
import { useAuditEvents } from './api/hooks';
import { getDefaultTimeRange, timeRangeToParams } from './components/TimeRangePicker';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000, retry: 1 },
  },
});

function AppContent() {
  const [timeRange, setTimeRange] = useState(getDefaultTimeRange);
  const { viewMode, useMockData } = useAppStore();

  const params = useMemo(
    () => ({
      ...timeRangeToParams(timeRange),
      limit: useMockData ? 0 : 10_000,
    }),
    [timeRange, useMockData]
  );

  const { data: events = [], isLoading, isFetching, isError, error, refetch, dataUpdatedAt } = useAuditEvents(
    params,
    useAppStore.getState().autoRefresh,
    useMockData
  );

  return (
    <div className="flex h-screen flex-col bg-[#FAFAFA] font-sans text-[#3F4547]">
      <Toolbar
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        onRefresh={() => refetch()}
        lastUpdated={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
        eventCount={events.length}
        isLoading={isLoading || isFetching}
      />

      <main className="relative flex-1 overflow-auto" role="main">
        {isError ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-4" role="alert">
            <p className="text-center text-lg text-red-600">Unable to load audit events</p>
            <p className="text-center text-sm text-[#7F8385]">
              {(error as Error)?.message ?? 'Check that DOMINO_API_HOST is set and you have access to the Audit Trail API.'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded border border-[#3B3BD3] bg-[#3B3BD3] px-4 py-2 text-white hover:opacity-90"
            >
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex h-full items-center justify-center" aria-busy="true">
            <div className="text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#DBE4E8] border-t-[#3B3BD3]" />
              <p className="mt-2 text-sm text-[#7F8385]">Loading…</p>
            </div>
          </div>
        ) : events.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-4" role="status">
            <p className="text-center text-lg text-[#3F4547]">No events found</p>
            <p className="text-center text-sm text-[#7F8385]">
              Change the time range or use mock data to see adoption metrics.
            </p>
          </div>
        ) : viewMode === 'overview' ? (
          <OverviewDashboard events={events} />
        ) : viewMode === 'usageOverTime' ? (
          <UsageOverTimeView events={events} />
        ) : viewMode === 'activityByProject' ? (
          <ActivityByProjectView events={events} />
        ) : (
          <EventTypesView events={events} />
        )}
      </main>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {isLoading ? 'Loading.' : `${events.length} events loaded. View: ${viewMode}.`}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
