import { useMemo, useState } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import type { AuditEvent } from '../types';
import type { TimeRange } from './TimeRangePicker';
import { extractRunRecords } from '../utils/runRecords';
import { getTimeBucketsForRange } from '../utils/chartTimeBuckets';
import { exportToCsv } from '../utils/csvExport';
import { UnknownCountBadge } from './UnknownBadge';
import { UsageClassInfo } from './UsageClassInfo';

interface AdoptionBreakdownViewProps {
  events: AuditEvent[];
  timeRange: TimeRange;
}

type UsageClass = 'SAS' | 'SLC' | 'Unknown';
type DrillMode = 'users' | 'projects';

const USAGE_CLASSES: UsageClass[] = ['SAS', 'SLC', 'Unknown'];

export function AdoptionBreakdownView({ events, timeRange }: AdoptionBreakdownViewProps) {
  const [usageFilter, setUsageFilter] = useState<UsageClass | 'All'>('All');
  const [drillMode, setDrillMode] = useState<DrillMode>('users');

  const records = useMemo(() => extractRunRecords(events), [events]);
  const buckets = useMemo(() => getTimeBucketsForRange(timeRange), [timeRange]);

  const uniqueTotals = useMemo(() => {
    const users = new Map<UsageClass, Set<string>>();
    const projects = new Map<UsageClass, Set<string>>();
    for (const usage of USAGE_CLASSES) {
      users.set(usage, new Set());
      projects.set(usage, new Set());
    }
    for (const row of records) {
      users.get(row.usageClass)?.add(row.user);
      projects.get(row.usageClass)?.add(row.project);
    }
    return {
      users: users,
      projects: projects,
    };
  }, [records]);

  const series = useMemo(() => {
    const buildSeries = (mode: DrillMode) => {
      return USAGE_CLASSES.map((usage) => {
        const points = buckets.map((bucket, idx) => {
          const nextStart = idx + 1 < buckets.length ? buckets[idx + 1].value : Number.MAX_SAFE_INTEGER;
          const seen = new Set<string>();
          for (const row of records) {
            if (row.usageClass !== usage) continue;
            if (row.timestamp < bucket.value || row.timestamp >= nextStart) continue;
            seen.add(mode === 'users' ? row.user : row.project);
          }
          return seen.size;
        });
        return { usage, points };
      });
    };

    return {
      users: buildSeries('users'),
      projects: buildSeries('projects'),
      categories: buckets.map((b) => b.label),
    };
  }, [records, buckets]);

  const userOptions: Highcharts.Options = useMemo(
    () => ({
      chart: { type: 'column', height: 280 },
      title: { text: undefined },
      xAxis: { categories: series.categories },
      yAxis: { title: { text: 'Unique active users' }, min: 0, stackLabels: { enabled: false } },
      plotOptions: { column: { stacking: 'normal', borderRadius: 4 } },
      series: series.users.map((entry) => ({
        type: 'column',
        name: entry.usage,
        data: entry.points,
      })),
      credits: { enabled: false },
    }),
    [series]
  );

  const projectOptions: Highcharts.Options = useMemo(
    () => ({
      chart: { type: 'column', height: 280 },
      title: { text: undefined },
      xAxis: { categories: series.categories },
      yAxis: { title: { text: 'Active projects' }, min: 0, stackLabels: { enabled: false } },
      plotOptions: { column: { stacking: 'normal', borderRadius: 4 } },
      series: series.projects.map((entry) => ({
        type: 'column',
        name: entry.usage,
        data: entry.points,
      })),
      credits: { enabled: false },
    }),
    [series]
  );

  const drillRows = useMemo(() => {
    const counts = new Map<string, { count: number; usage: UsageClass; lastSeen: number }>();
    for (const row of records) {
      if (usageFilter !== 'All' && row.usageClass !== usageFilter) continue;
      const key = drillMode === 'users' ? row.user : row.project;
      const prev = counts.get(key);
      if (!prev) {
        counts.set(key, { count: 1, usage: row.usageClass, lastSeen: row.timestamp || 0 });
      } else {
        prev.count += 1;
        prev.lastSeen = Math.max(prev.lastSeen, row.timestamp || 0);
      }
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.count - a.count);
  }, [records, usageFilter, drillMode]);

  return (
    <div className="h-full overflow-auto p-6" role="region" aria-label="Adoption breakdown">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-medium text-[#3F4547]">
          SAS vs SLC adoption <UsageClassInfo />
        </h2>
        <p className="mb-6 text-sm text-[#7F8385]">
          Unique users and active projects over time split by inferred usage class (command-first, environment-second).
        </p>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {USAGE_CLASSES.map((usage) => (
            <div key={usage} className="rounded-lg border border-[#DBE4E8] bg-white p-4 shadow-sm">
              <p className="flex items-center gap-1.5 text-sm text-[#7F8385]">
                {usage}
                {usage === 'Unknown' && (
                  <UnknownCountBadge
                    field="usageClass"
                    unknownCount={records.filter((r) => r.usageClass === 'Unknown').length}
                    totalCount={records.length}
                  />
                )}
              </p>
              <p className="mt-1 text-xl font-semibold text-[#3F4547]">
                {uniqueTotals.users.get(usage)?.size.toLocaleString() ?? '0'} users
              </p>
              <p className="text-sm text-[#7F8385]">
                {uniqueTotals.projects.get(usage)?.size.toLocaleString() ?? '0'} projects
              </p>
            </div>
          ))}
        </div>

        <div className="mb-6 rounded-lg border border-[#DBE4E8] bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-base font-medium text-[#3F4547]">Unique active users over time</h3>
          <HighchartsReact highcharts={Highcharts} options={userOptions} />
        </div>

        <div className="mb-6 rounded-lg border border-[#DBE4E8] bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-base font-medium text-[#3F4547]">Active projects over time</h3>
          <HighchartsReact highcharts={Highcharts} options={projectOptions} />
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setDrillMode('users')}
            className={`rounded border px-3 py-1.5 text-sm ${
              drillMode === 'users'
                ? 'border-[#3B3BD3] bg-[#3B3BD3] text-white'
                : 'border-[#DBE4E8] bg-white text-[#3F4547]'
            }`}
          >
            Drill-down: Users
          </button>
          <button
            type="button"
            onClick={() => setDrillMode('projects')}
            className={`rounded border px-3 py-1.5 text-sm ${
              drillMode === 'projects'
                ? 'border-[#3B3BD3] bg-[#3B3BD3] text-white'
                : 'border-[#DBE4E8] bg-white text-[#3F4547]'
            }`}
          >
            Drill-down: Projects
          </button>
          <select
            value={usageFilter}
            onChange={(e) => setUsageFilter(e.target.value as UsageClass | 'All')}
            className="rounded border border-[#DBE4E8] bg-white px-2 py-1.5 text-sm text-[#3F4547]"
          >
            <option value="All">All usage classes</option>
            {USAGE_CLASSES.map((usage) => (
              <option key={usage} value={usage}>
                {usage}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              exportToCsv(`adoption-${drillMode}-${usageFilter.toLowerCase()}`, drillRows, [
                { key: 'name', header: drillMode === 'users' ? 'User' : 'Project' },
                { key: 'usage', header: 'Usage class' },
                { key: 'count', header: 'Run count' },
                { key: 'lastSeen', header: 'Last seen timestamp' },
              ])
            }
            className="ml-auto rounded border border-[#DBE4E8] bg-white px-3 py-1.5 text-sm text-[#3F4547]"
          >
            Export CSV
          </button>
        </div>

        <div className="overflow-auto rounded-lg border border-[#DBE4E8] bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[#FAFAFA] text-left text-[#7F8385]">
              <tr className="border-b border-[#DBE4E8]">
                <th className="px-3 py-2 font-medium">{drillMode === 'users' ? 'User' : 'Project'}</th>
                <th className="px-3 py-2 font-medium">
                  <span className="inline-flex items-center gap-1">Usage class <UsageClassInfo compact /></span>
                </th>
                <th className="px-3 py-2 font-medium">Run count</th>
              </tr>
            </thead>
            <tbody>
              {drillRows.map((row) => (
                <tr key={`${row.name}-${row.usage}`} className="border-b border-[#DBE4E8] text-[#3F4547]">
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2">{row.usage}</td>
                  <td className="px-3 py-2">{row.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
