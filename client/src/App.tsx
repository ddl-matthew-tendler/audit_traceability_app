import { useMemo, useState, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toolbar } from './components/Toolbar';
import { TimelineView } from './components/TimelineView';
import { TableView } from './components/TableView';
import { UserJourneyView } from './components/UserJourneyView';
import { ActivityByProjectView } from './components/ActivityByProjectView';
import { EventTypesView } from './components/EventTypesView';
import { DetailPanel } from './components/DetailPanel';
import { useAppStore } from './store/useAppStore';
import { useAuditEvents, useUsers, useCurrentUser } from './api/hooks';
import type { UserOption } from './components/UserFilter';
import { getDefaultTimeRange, timeRangeToParams } from './components/TimeRangePicker';
import type { AuditEvent } from './types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000, retry: 1 },
  },
});

function eventId(ev: AuditEvent, index: number): string {
  return ev.id ?? `ev-${index}`;
}

function AppContent() {
  const [timeRange, setTimeRange] = useState(getDefaultTimeRange);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const { viewMode, searchQuery, categoryFilters, projectFilter, targetIdFilter, highContrast, useMockData } =
    useAppStore();

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const params = useMemo(
    () => ({
      ...timeRangeToParams(timeRange),
      limit: useMockData ? 0 : 10_000,
      ...(selectedUserIds.length === 1 ? { actorId: selectedUserIds[0] } : {}),
    }),
    [timeRange, selectedUserIds, useMockData]
  );

  const { data: events = [], isLoading, isFetching, isError, error, refetch, dataUpdatedAt } = useAuditEvents(
    params,
    useAppStore.getState().autoRefresh,
    useMockData
  );

  const categoryFilterFn = useCallback(
    (cat: string) => categoryFilters[cat] !== false,
    [categoryFilters]
  );

  const filtered = useMemo(() => {
    let list = events;
    if (selectedUserIds.length > 1) {
      list = list.filter((e) => {
        const id = e.actorId ?? e.actorName;
        return id && selectedUserIds.includes(id);
      });
    }
    if (projectFilter) {
      list = list.filter(
        (e) => e.withinProjectId === projectFilter || e.withinProjectName === projectFilter
      );
    }
    if (targetIdFilter) {
      list = list.filter(
        (e) => e.targetId === targetIdFilter || e.withinProjectId === targetIdFilter
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => {
        const name = (e.event ?? '').toLowerCase();
        const target = ((e.targetName ?? e.targetId) ?? '').toString().toLowerCase();
        const meta = JSON.stringify(e.metadata ?? {}).toLowerCase();
        return name.includes(q) || target.includes(q) || meta.includes(q);
      });
    }
    return list;
  }, [events, selectedUserIds, projectFilter, targetIdFilter, searchQuery]);

  const projects = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => {
      const name = e.withinProjectName || e.withinProjectId;
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [events]);

  const usersFromEvents = useMemo((): UserOption[] => {
    const set = new Map<string, string>();
    events.forEach((e) => {
      const id = e.actorId ?? e.actorName;
      if (id) set.set(id, e.actorName ?? e.actorId ?? id);
    });
    return Array.from(set.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [events]);

  const { data: apiUsers = [], isLoading: usersLoading } = useUsers();
  const { data: currentUser } = useCurrentUser();
  const userOptions: UserOption[] = useMockData
    ? usersFromEvents
    : apiUsers.map((u) => ({ id: (u.id ?? u.userName ?? '') as string, label: (u.userName ?? u.id ?? '') as string }));

  const selectedEventId = selectedEvent
    ? eventId(selectedEvent, filtered.indexOf(selectedEvent))
    : null;

  const handleNodeSelect = useCallback((ev: AuditEvent | null) => {
    setSelectedEvent(ev);
  }, []);

  const handleClosePanel = useCallback(() => setSelectedEvent(null), []);

  return (
    <div
      className="flex h-screen flex-col bg-domino-bg font-sans text-domino-text"
      data-high-contrast={highContrast ? 'true' : undefined}
    >
      <Toolbar
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        selectedUserIds={selectedUserIds}
        onSelectedUserIdsChange={setSelectedUserIds}
        users={userOptions}
        currentUser={currentUser ?? null}
        usersLoading={usersLoading && !useMockData}
        onRefresh={() => refetch()}
        lastUpdated={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
        eventCount={filtered.length}
        projects={projects}
        isLoading={isLoading || isFetching}
      />

      <main className="relative flex flex-1 overflow-hidden" role="main">
        <div className="flex-1 overflow-hidden">
          {isError ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-4" role="alert">
              <p className="text-center text-lg text-domino-error">
                Unable to load audit events
              </p>
              <p className="text-center text-domino-text-body">
                {(error as Error)?.message ?? 'Check that DOMINO_API_HOST is set and you have access to the Audit Trail API.'}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="rounded border border-domino-primary bg-domino-primary px-4 py-2 text-white hover:opacity-90"
              >
                Retry
              </button>
            </div>
          ) : isLoading ? (
            <div className="flex h-full items-center justify-center" aria-busy="true">
              <div className="text-center">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-domino-border border-t-domino-primary" />
                <p className="mt-2 text-domino-text-body">Loading events…</p>
              </div>
            </div>
          ) : events.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-4" role="status">
              <p className="text-center text-lg text-domino-text">No events found</p>
              <p className="text-center text-domino-text-body">
                Try adjusting the time range or filters to see audit events.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-4" role="status">
              <p className="text-center text-lg text-domino-text">No events match your filters</p>
              <p className="text-center text-domino-text-body">
                Clear search, category, or project filters to see more events.
              </p>
            </div>
          ) : viewMode === 'table' ? (
            <TableView
              events={filtered}
              onSelectEvent={handleNodeSelect}
              selectedEventId={selectedEventId}
              categoryFilter={categoryFilterFn}
            />
          ) : viewMode === 'timeline' ? (
            <TimelineView
              events={filtered}
              onSelectEvent={handleNodeSelect}
              selectedEventId={selectedEventId}
              categoryFilter={categoryFilterFn}
            />
          ) : viewMode === 'userJourney' ? (
            <UserJourneyView
              events={filtered}
              onSelectEvent={handleNodeSelect}
              selectedEventId={selectedEventId}
              categoryFilter={categoryFilterFn}
              selectedUserIds={selectedUserIds}
            />
          ) : viewMode === 'activityByProject' ? (
            <ActivityByProjectView events={filtered} categoryFilter={categoryFilterFn} />
          ) : (
            <EventTypesView events={filtered} categoryFilter={categoryFilterFn} />
          )}
        </div>

        {selectedEvent && (
          <DetailPanel event={selectedEvent} onClose={handleClosePanel} />
        )}
      </main>

      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {isLoading ? 'Loading events.' : `${filtered.length} events loaded. View: ${viewMode}.`}
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
