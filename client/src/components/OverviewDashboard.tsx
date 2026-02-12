import { useMemo } from 'react';
import { format, startOfDay } from 'date-fns';
import type { AuditEvent } from '../types';

function computeMetrics(events: AuditEvent[]) {
  const users = new Set<string>();
  const projects = new Set<string>();
  for (const ev of events) {
    const uid = ev.actorId ?? ev.actorName;
    if (uid) users.add(uid);
    const proj = ev.withinProjectName ?? ev.withinProjectId;
    if (proj) projects.add(proj);
  }
  return {
    totalEvents: events.length,
    activeUsers: users.size,
    activeProjects: projects.size,
  };
}

function formatChange(
  current: number,
  previous: number,
  previousPeriodLabel: string
): { text: string; color: string } | null {
  if (previous === 0) {
    if (current === 0) return { text: 'No change compared to ' + previousPeriodLabel, color: 'text-[#7F8385]' };
    return { text: `+100% compared to ${previousPeriodLabel}`, color: 'text-[#28A464]' };
  }
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? '+' : '';
  const color = pct > 0 ? 'text-[#28A464]' : pct < 0 ? 'text-[#C20A29]' : 'text-[#7F8385]';
  return {
    text: `${sign}${pct.toFixed(1)}% compared to ${previousPeriodLabel}`,
    color,
  };
}

interface OverviewDashboardProps {
  events: AuditEvent[];
  previousEvents: AuditEvent[];
  showComparison: boolean;
  previousPeriodLabel: string;
}

export function OverviewDashboard({
  events,
  previousEvents,
  showComparison,
  previousPeriodLabel,
}: OverviewDashboardProps) {
  const metrics = useMemo(() => computeMetrics(events), [events]);
  const previousMetrics = useMemo(() => computeMetrics(previousEvents), [previousEvents]);

  const totalEventsChange = showComparison
    ? formatChange(metrics.totalEvents, previousMetrics.totalEvents, previousPeriodLabel)
    : null;
  const activeUsersChange = showComparison
    ? formatChange(metrics.activeUsers, previousMetrics.activeUsers, previousPeriodLabel)
    : null;
  const activeProjectsChange = showComparison
    ? formatChange(metrics.activeProjects, previousMetrics.activeProjects, previousPeriodLabel)
    : null;

  const byDay = useMemo(() => {
    const map = new Map<number, number>();
    for (const ev of events) {
      if (ev.timestamp) {
        const day = startOfDay(new Date(ev.timestamp)).getTime();
        map.set(day, (map.get(day) ?? 0) + 1);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .slice(-30);
  }, [events]);

  const maxCount = Math.max(...byDay.map(([, c]) => c), 1);

  return (
    <div className="h-full overflow-auto p-6" role="region" aria-label="Usage overview">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-2 text-lg font-medium text-[#3F4547]">Adoption at a glance</h2>
        <p className="mb-6 text-sm text-[#7F8385]">
          Key metrics from audit trail data to understand how Domino is being used.
        </p>

        {/* Metric cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-[#DBE4E8] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#7F8385]">Total events</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[#3F4547]">
              {metrics.totalEvents.toLocaleString()}
            </p>
            {totalEventsChange ? (
              <p className={`mt-0.5 text-xs font-medium ${totalEventsChange.color}`}>
                {totalEventsChange.text}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-[#7F8385]">In selected period</p>
            )}
          </div>
          <div className="rounded-lg border border-[#DBE4E8] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#7F8385]">Active users</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[#3F4547]">
              {metrics.activeUsers.toLocaleString()}
            </p>
            {activeUsersChange ? (
              <p className={`mt-0.5 text-xs font-medium ${activeUsersChange.color}`}>
                {activeUsersChange.text}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-[#7F8385]">Unique actors</p>
            )}
          </div>
          <div className="rounded-lg border border-[#DBE4E8] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#7F8385]">Active projects</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[#3F4547]">
              {metrics.activeProjects.toLocaleString()}
            </p>
            {activeProjectsChange ? (
              <p className={`mt-0.5 text-xs font-medium ${activeProjectsChange.color}`}>
                {activeProjectsChange.text}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-[#7F8385]">With activity</p>
            )}
          </div>
        </div>

        {/* Usage over time mini-chart */}
        <div className="rounded-lg border border-[#DBE4E8] bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-base font-medium text-[#3F4547]">Usage over time</h3>
          <p className="mb-4 text-sm text-[#7F8385]">Events per day — trend in the selected period.</p>
          {byDay.length === 0 ? (
            <p className="text-sm text-[#7F8385]">No events with timestamps in the selected range.</p>
          ) : (
            <>
              <div className="flex items-end gap-0.5" style={{ minHeight: 140 }}>
                {byDay.map(([dayMs, count]) => (
                  <div
                    key={dayMs}
                    className="flex flex-1 flex-col items-center"
                    title={`${format(dayMs, 'MMM d, yyyy')}: ${count.toLocaleString()} events`}
                  >
                    <div
                      className="w-full min-w-[6px] rounded-t bg-[#3B3BD3] transition-opacity hover:opacity-90"
                      style={{
                        height: `${(count / maxCount) * 100}px`,
                        minHeight: count > 0 ? 6 : 0,
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-xs text-[#7F8385]">
                <span>{format(byDay[0][0], 'MMM d')}</span>
                <span>{format(byDay[byDay.length - 1][0], 'MMM d')}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
