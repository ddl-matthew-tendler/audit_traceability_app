import { useMemo } from 'react';
import { format, startOfDay, getHours } from 'date-fns';
import type { AuditEvent } from '../types';
import { HoverTooltip } from './HoverTooltip';

const DOMINO_ACCENT_COLORS = [
  '#543FDE',
  '#0070CC',
  '#28A464',
  '#CCB718',
  '#FF6543',
  '#E835A7',
  '#2EDCC4',
  '#A9734C',
];

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

  const byHour = useMemo(() => {
    const buckets = new Array(24).fill(0);
    for (const ev of events) {
      if (ev.timestamp) {
        const h = getHours(new Date(ev.timestamp));
        buckets[h]++;
      }
    }
    return buckets.map((count, hour) => ({ hour, count }));
  }, [events]);

  const maxCount = Math.max(...byDay.map(([, c]) => c), 1);
  const maxHourCount = Math.max(...byHour.map((h) => h.count), 1);

  return (
    <div className="h-full overflow-auto p-6" role="region" aria-label="Usage overview">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-2 text-lg font-medium text-[#3F4547]">Adoption at a glance</h2>
        <p className="mb-6 text-sm text-[#7F8385]">
          Key metrics from audit trail data to understand how Domino is being used.
        </p>

        {/* Metric cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <HoverTooltip
            content={
              <div className="space-y-1">
                <p className="font-semibold text-[#2E2E38]">Total events</p>
                <p>
                  Count of all audit trail events in the selected period. Includes project actions, datasets, jobs,
                  workspaces, files, and more.
                </p>
                <p className="text-xs text-[#7F8385]">
                  Current: {metrics.totalEvents.toLocaleString()}
                  {showComparison &&
                    ` • Previous: ${previousMetrics.totalEvents.toLocaleString()}`}
                </p>
              </div>
            }
            className="w-full"
          >
            <div className="cursor-help rounded-lg border border-[#DBE4E8] bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
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
          </HoverTooltip>
          <HoverTooltip
            content={
              <div className="space-y-1">
                <p className="font-semibold text-[#2E2E38]">Active users</p>
                <p>
                  Unique actors who performed at least one action in the selected period. Includes users who created,
                  edited, or executed in projects.
                </p>
                <p className="text-xs text-[#7F8385]">
                  Current: {metrics.activeUsers.toLocaleString()}
                  {showComparison &&
                    ` • Previous: ${previousMetrics.activeUsers.toLocaleString()}`}
                </p>
              </div>
            }
            className="w-full"
          >
            <div className="cursor-help rounded-lg border border-[#DBE4E8] bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
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
          </HoverTooltip>
          <HoverTooltip
            content={
              <div className="space-y-1">
                <p className="font-semibold text-[#2E2E38]">Active projects</p>
                <p>
                  Number of distinct projects with at least one audit event. Shows platform breadth and team adoption
                  across projects.
                </p>
                <p className="text-xs text-[#7F8385]">
                  Current: {metrics.activeProjects.toLocaleString()}
                  {showComparison &&
                    ` • Previous: ${previousMetrics.activeProjects.toLocaleString()}`}
                </p>
              </div>
            }
            className="w-full"
          >
            <div className="cursor-help rounded-lg border border-[#DBE4E8] bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
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
          </HoverTooltip>
        </div>

        {/* Usage over time mini-chart */}
        <div className="mb-8 rounded-lg border border-[#DBE4E8] bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-base font-medium text-[#3F4547]">Usage over time</h3>
          <p className="mb-4 text-sm text-[#7F8385]">Events per day — trend in the selected period.</p>
          {byDay.length === 0 ? (
            <p className="text-sm text-[#7F8385]">No events with timestamps in the selected range.</p>
          ) : (
            <>
              <div className="flex items-end gap-0.5" style={{ minHeight: 140 }}>
                {byDay.map(([dayMs, count]) => (
                  <HoverTooltip
                    key={dayMs}
                    content={
                      <div className="space-y-0.5">
                        <p className="font-semibold text-[#2E2E38]">
                          {format(new Date(dayMs), 'EEEE, MMMM d, yyyy')}
                        </p>
                        <p>{count.toLocaleString()} events</p>
                        <p className="text-xs text-[#7F8385]">
                          {maxCount > 0 ? ((count / maxCount) * 100).toFixed(0) : 0}% of peak day
                        </p>
                      </div>
                    }
                    className="flex flex-1 flex-col items-center"
                  >
                    <div
                      className="w-full min-w-[6px] cursor-help rounded-t bg-[#3B3BD3] transition-opacity hover:opacity-90"
                      style={{
                        height: `${(count / maxCount) * 100}px`,
                        minHeight: count > 0 ? 6 : 0,
                      }}
                    />
                  </HoverTooltip>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-xs text-[#7F8385]">
                <span>{format(byDay[0][0], 'MMM d')}</span>
                <span>{format(byDay[byDay.length - 1][0], 'MMM d')}</span>
              </div>
            </>
          )}
        </div>

        {/* Peak activity hours */}
        <div className="mb-8 rounded-lg border border-[#DBE4E8] bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-base font-medium text-[#3F4547]">Peak activity hours</h3>
          <p className="mb-4 text-sm text-[#7F8385]">
            When your team is most active — events by hour of day (your local timezone).
          </p>
          <div className="flex items-end gap-0.5" style={{ minHeight: 120 }}>
            {byHour.map(({ hour, count }) => (
              <HoverTooltip
                key={hour}
                content={
                  <div className="space-y-0.5">
                    <p className="font-semibold text-[#2E2E38]">
                      {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                    </p>
                    <p>{count.toLocaleString()} events</p>
                    <p className="text-xs text-[#7F8385]">
                      {maxHourCount > 0 ? ((count / maxHourCount) * 100).toFixed(0) : 0}% of peak hour
                    </p>
                  </div>
                }
                className="flex flex-1 flex-col items-center"
              >
                <div
                  className="w-full min-w-[4px] cursor-help rounded-t transition-opacity hover:opacity-90"
                  style={{
                    height: `${(count / maxHourCount) * 100}px`,
                    minHeight: count > 0 ? 4 : 0,
                    backgroundColor: DOMINO_ACCENT_COLORS[hour % DOMINO_ACCENT_COLORS.length],
                  }}
                />
              </HoverTooltip>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-[#7F8385]">
            <span>12 AM</span>
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
            <span>11 PM</span>
          </div>
        </div>

        {/* View all Audit Trail CTA */}
        <div className="rounded-lg border border-[#DBE4E8] bg-white p-5 shadow-sm">
          <a
            href="https://life-sciences-demo.domino-eval.com/audit-trail"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#543FDE] hover:text-[#3B23D1] hover:underline"
          >
            View all Audit Trail events
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <p className="mt-1 text-xs text-[#7F8385]">
            Open the full Audit Trail in Domino to search, filter, and explore all events.
          </p>
        </div>
      </div>
    </div>
  );
}
