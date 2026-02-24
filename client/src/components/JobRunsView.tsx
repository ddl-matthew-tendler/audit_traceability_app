import { useMemo, useState } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import type { AuditEvent } from '../types';
import type { TimeRange } from './TimeRangePicker';
import { extractRunRecords, formatDuration } from '../utils/runRecords';
import { getEventActivityBucketsForRange, bucketEventsByTime } from '../utils/chartTimeBuckets';
import { DOMINO_COLORS } from '../utils/highchartsTheme';
import { RunRecordsTable } from './RunRecordsTable';
import { DetailPanel } from './DetailPanel';
import { exportToCsv } from '../utils/csvExport';
import { UnknownCountBadge } from './UnknownBadge';
import { UsageClassInfo } from './UsageClassInfo';

interface JobRunsViewProps {
  events: AuditEvent[];
  timeRange: TimeRange;
}

export function JobRunsView({ events, timeRange }: JobRunsViewProps) {
  const [query, setQuery] = useState('');
  const [userFilter, setUserFilter] = useState('All');
  const [projectFilter, setProjectFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [usageFilter, setUsageFilter] = useState('All');
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const records = useMemo(
    () => extractRunRecords(events).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
    [events]
  );

  const options = useMemo(() => {
    const users = new Set<string>();
    const projects = new Set<string>();
    const statuses = new Set<string>();
    for (const row of records) {
      users.add(row.user);
      projects.add(row.project);
      statuses.add(row.status);
    }
    return {
      users: ['All', ...Array.from(users).sort()],
      projects: ['All', ...Array.from(projects).sort()],
      statuses: ['All', ...Array.from(statuses).sort()],
      usages: ['All', 'SAS', 'SLC', 'Unknown'],
    };
  }, [records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((row) => {
      if (userFilter !== 'All' && row.user !== userFilter) return false;
      if (projectFilter !== 'All' && row.project !== projectFilter) return false;
      if (statusFilter !== 'All' && row.status !== statusFilter) return false;
      if (usageFilter !== 'All' && row.usageClass !== usageFilter) return false;
      if (!q) return true;
      return (
        row.command.toLowerCase().includes(q) ||
        row.project.toLowerCase().includes(q) ||
        row.user.toLowerCase().includes(q) ||
        row.runId.toLowerCase().includes(q) ||
        row.eventName.toLowerCase().includes(q)
      );
    });
  }, [records, query, userFilter, projectFilter, statusFilter, usageFilter]);

  const metrics = useMemo(() => {
    const users = new Set<string>();
    const projects = new Set<string>();
    let runsWithDuration = 0;
    let durationSum = 0;
    for (const row of filtered) {
      users.add(row.user);
      projects.add(row.project);
      if (row.durationSec != null && Number.isFinite(row.durationSec)) {
        runsWithDuration += 1;
        durationSum += row.durationSec;
      }
    }
    return {
      totalRuns: filtered.length,
      uniqueUsers: users.size,
      uniqueProjects: projects.size,
      runsWithDuration,
      avgDurationSec: runsWithDuration > 0 ? durationSum / runsWithDuration : null,
    };
  }, [filtered]);

  const buckets = useMemo(() => getEventActivityBucketsForRange(timeRange), [timeRange]);
  const runsOverTimeData = useMemo(() => {
    const counts = bucketEventsByTime(
      filtered.map((r) => ({ timestamp: r.timestamp })),
      buckets
    );
    const interval =
      buckets.length >= 2 ? buckets[1].value - buckets[0].value : 3600000;
    return buckets.map((b) => ({
      x: b.value + interval / 2,
      y: counts.get(b.value) ?? 0,
      name: b.name,
    }));
  }, [filtered, buckets]);

  const usageBreakdown = useMemo(() => {
    const sas = filtered.filter((r) => r.usageClass === 'SAS').length;
    const slc = filtered.filter((r) => r.usageClass === 'SLC').length;
    const unknown = filtered.filter((r) => r.usageClass === 'Unknown').length;
    return [
      { name: 'SAS', y: sas, color: DOMINO_COLORS[0] },
      { name: 'SLC', y: slc, color: DOMINO_COLORS[1] },
      { name: 'Unknown', y: unknown, color: DOMINO_COLORS[2] },
    ].filter((d) => d.y > 0);
  }, [filtered]);

  const runsOverTimeOptions: Highcharts.Options = useMemo(
    () => ({
      chart: { type: 'column', height: 200 },
      title: { text: undefined },
      xAxis: {
        type: 'datetime',
        tickmarkPlacement: 'on',
        labels: { align: 'center' },
      },
      yAxis: { title: { text: 'Runs' }, min: 0 },
      series: [
        {
          type: 'column',
          name: 'Runs',
          data: runsOverTimeData,
          color: '#543FDE',
          pointRange: buckets.length >= 2 ? buckets[1].value - buckets[0].value : 3600000,
        },
      ],
      plotOptions: { column: { borderRadius: 4 } },
      tooltip: {
        pointFormat: '<b>{point.name}</b><br/>{point.y} runs',
      },
      credits: { enabled: false },
    }),
    [runsOverTimeData, buckets]
  );

  const usageBreakdownOptions: Highcharts.Options = useMemo(
    () => ({
      chart: { type: 'column', height: 200 },
      title: { text: undefined },
      xAxis: { categories: usageBreakdown.map((d) => d.name) },
      yAxis: { title: { text: 'Runs' }, min: 0 },
      series: [
        {
          type: 'column',
          name: 'Runs',
          data: usageBreakdown.map((d) => ({ y: d.y, color: d.color })),
        },
      ],
      plotOptions: { column: { borderRadius: 4 } },
      credits: { enabled: false },
    }),
    [usageBreakdown]
  );

  const onExportCsv = () => {
    exportToCsv('job-runs-filtered', filtered, [
      { key: 'timestamp', header: 'Timestamp' },
      { key: 'eventName', header: 'Event' },
      { key: 'runId', header: 'Run ID' },
      { key: 'durationSec', header: 'Duration (sec)' },
      { key: 'status', header: 'Status' },
      { key: 'user', header: 'User' },
      { key: 'project', header: 'Project' },
      { key: 'command', header: 'Command' },
      { key: 'computeTier', header: 'Compute tier' },
      { key: 'hardwareTier', header: 'Hardware tier' },
      { key: 'environmentName', header: 'Environment' },
      { key: 'usageClass', header: 'Inferred usage class' },
    ]);
  };

  return (
    <div className="h-full overflow-auto p-6" role="region" aria-label="Job and run visibility">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-2 text-lg font-medium text-[#3F4547]">Job and run visibility</h2>
        <p className="mb-6 text-sm text-[#7F8385]">
          Answer who is using Domino, what they are running, which projects are active, and who owns each run.
        </p>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-[#DBE4E8] bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <p className="text-sm font-medium text-[#7F8385]">Total runs</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[#3F4547]">
              {metrics.totalRuns.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs text-[#7F8385]">In filtered view</p>
          </div>
          <div className="rounded-lg border border-[#DBE4E8] bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <p className="text-sm font-medium text-[#7F8385]">Unique users</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[#3F4547]">
              {metrics.uniqueUsers.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs text-[#7F8385]">Who ran jobs</p>
          </div>
          <div className="rounded-lg border border-[#DBE4E8] bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <p className="text-sm font-medium text-[#7F8385]">Unique projects</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[#3F4547]">
              {metrics.uniqueProjects.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs text-[#7F8385]">With runs</p>
          </div>
          <div className="rounded-lg border border-[#DBE4E8] bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <p className="text-sm font-medium text-[#7F8385]">Avg runtime</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[#3F4547]">
              {formatDuration(metrics.avgDurationSec)}
            </p>
            <p className="mt-0.5 text-xs text-[#7F8385]">
              {metrics.runsWithDuration > 0
                ? `${metrics.runsWithDuration.toLocaleString()} runs with duration`
                : 'No duration data'}
            </p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-[#DBE4E8] bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-medium text-[#3F4547]">Runs over time</h3>
            {buckets.length > 0 ? (
              <HighchartsReact highcharts={Highcharts} options={runsOverTimeOptions} />
            ) : (
              <p className="text-sm text-[#7F8385]">No time buckets for the selected range.</p>
            )}
          </div>
          <div className="rounded-lg border border-[#DBE4E8] bg-white p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-base font-medium text-[#3F4547]">
              By usage class <UsageClassInfo />
              {usageBreakdown.some((d) => d.name === 'Unknown') && (
                <UnknownCountBadge
                  field="usageClass"
                  unknownCount={usageBreakdown.find((d) => d.name === 'Unknown')?.y ?? 0}
                  totalCount={filtered.length}
                />
              )}
            </h3>
            {usageBreakdown.length > 0 ? (
              <HighchartsReact highcharts={Highcharts} options={usageBreakdownOptions} />
            ) : (
              <p className="text-sm text-[#7F8385]">No runs in filtered view.</p>
            )}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-6">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search command, user, project, run id"
            className="rounded border border-[#DBE4E8] bg-white px-3 py-2 text-sm text-[#3F4547] md:col-span-2"
          />
          <Select value={userFilter} onChange={setUserFilter} options={options.users} label="User" />
          <Select value={projectFilter} onChange={setProjectFilter} options={options.projects} label="Project" />
          <Select value={statusFilter} onChange={setStatusFilter} options={options.statuses} label="Status" />
          <Select value={usageFilter} onChange={setUsageFilter} options={options.usages} label="Usage class" infoIcon={<UsageClassInfo compact />} />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-[#7F8385]">
            Showing {filtered.length.toLocaleString()} of {records.length.toLocaleString()} execution records.
          </p>
          <button
            type="button"
            onClick={onExportCsv}
            className="rounded border border-[#DBE4E8] bg-white px-3 py-1.5 text-sm text-[#3F4547] hover:bg-[#F7F8FD]"
          >
            Export CSV
          </button>
        </div>

        <RunRecordsTable rows={filtered} onSelectEvent={setSelectedEvent} />
      </div>

      <DetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
  infoIcon?: React.ReactNode;
}

function Select({ value, onChange, options, label, infoIcon }: SelectProps) {
  return (
    <label className="flex flex-col gap-1 text-xs text-[#7F8385]">
      <span className="inline-flex items-center gap-1">{label}{infoIcon}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-[#DBE4E8] bg-white px-2 py-2 text-sm text-[#3F4547]"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
