import { useMemo } from 'react';
import { getHours } from 'date-fns';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import type { AuditEvent } from '../types';
import { HoverTooltip } from './HoverTooltip';
import { getEventActivityBucketsForRange, bucketEventsByTime } from '../utils/chartTimeBuckets';
import type { TimeRange } from './TimeRangePicker';

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
  timeRange: TimeRange;
}

export function OverviewDashboard({
  events,
  previousEvents,
  showComparison,
  previousPeriodLabel,
  timeRange,
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

  const { usageBuckets, usageData, pointRange } = useMemo(() => {
    const buckets = getEventActivityBucketsForRange(timeRange);
    const counts = bucketEventsByTime(events, buckets);
    const interval =
      buckets.length >= 2
        ? buckets[1].value - buckets[0].value
        : 3600000;
    // Center each column in its bucket: x = bucketStart + interval/2 so column spans [bucketStart, bucketStart+interval]
    const data = buckets.map((b) => ({
      x: b.value + interval / 2,
      y: counts.get(b.value) ?? 0,
      name: b.name,
    }));
    return { usageBuckets: buckets, usageData: data, pointRange: interval };
  }, [events, timeRange]);

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

  const usageOptions: Highcharts.Options = useMemo(
    () => ({
      chart: { type: 'column', height: 200 },
      title: { text: undefined },
      xAxis: {
        type: 'datetime',
        tickmarkPlacement: 'on',
        labels: { align: 'center' },
      },
      yAxis: { title: { text: 'Events' }, min: 0 },
      series: [
        {
          type: 'column',
          name: 'Events',
          data: usageData,
          color: '#543FDE',
          pointRange,
        },
      ],
      plotOptions: { column: { borderRadius: 4 } },
      tooltip: {
        pointFormat: '<b>{point.name}</b><br/>{point.y} events',
      },
      credits: { enabled: false },
    }),
    [usageData, pointRange]
  );

  const peakHoursOptions: Highcharts.Options = useMemo(
    () => ({
      chart: { type: 'column', height: 200 },
      title: { text: undefined },
      xAxis: {
        categories: byHour.map((_, h) =>
          h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
        ),
      },
      yAxis: { title: { text: 'Events' }, min: 0 },
      series: [
        {
          type: 'column',
          name: 'Events',
          data: byHour.map((h) => h.count),
          color: '#543FDE',
        },
      ],
      plotOptions: { column: { borderRadius: 4 } },
      credits: { enabled: false },
    }),
    [byHour]
  );

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

        {/* Event Activity Over Time */}
        <div className="mb-8 rounded-lg border border-[#DBE4E8] bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-medium text-[#3F4547]">Event Activity Over Time</h3>
          {usageBuckets.length === 0 ? (
            <p className="text-sm text-[#7F8385]">No time buckets for the selected range.</p>
          ) : (
            <HighchartsReact highcharts={Highcharts} options={usageOptions} />
          )}
        </div>

        {/* Peak activity hours */}
        <div className="mb-8 rounded-lg border border-[#DBE4E8] bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-base font-medium text-[#3F4547]">Peak activity hours</h3>
          <p className="mb-4 text-sm text-[#7F8385]">
            When your team is most active — events by hour of day (your local timezone).
          </p>
          <HighchartsReact highcharts={Highcharts} options={peakHoursOptions} />
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
