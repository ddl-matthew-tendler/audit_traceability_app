import { useMemo } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import type { AuditEvent } from '../types';
import type { TimeRange } from './TimeRangePicker';
import { getTimeBucketsForRange } from '../utils/chartTimeBuckets';
import { DOMINO_COLORS } from '../utils/highchartsTheme';

interface UniqueUsersByProjectViewProps {
  events: AuditEvent[];
  timeRange: TimeRange;
}

/** Line chart: X = time (aligned with filter), Y = unique users, one line per project */
export function UniqueUsersByProjectView({ events, timeRange }: UniqueUsersByProjectViewProps) {
  const { buckets, series } = useMemo(() => {
    const buckets = getTimeBucketsForRange(timeRange);
    const sorted = [...buckets].sort((a, b) => a.value - b.value);
    const byBucketProject = new Map<number, Map<string, Set<string>>>();
    for (const ev of events) {
      if (!ev.timestamp) continue;
      const proj = ev.withinProjectName ?? ev.withinProjectId ?? 'Other';
      const uid = ev.actorId ?? ev.actorName ?? '';
      if (!uid) continue;
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (ev.timestamp >= sorted[i].value) {
          if (!byBucketProject.has(sorted[i].value)) byBucketProject.set(sorted[i].value, new Map());
          const m = byBucketProject.get(sorted[i].value)!;
          if (!m.has(proj)) m.set(proj, new Set());
          m.get(proj)!.add(uid);
          break;
        }
      }
    }
    const projectSet = new Set<string>();
    for (const m of byBucketProject.values()) {
      for (const p of m.keys()) projectSet.add(p);
    }
    const projectOrder = Array.from(projectSet).sort();
    const seriesData = projectOrder.map((project) => ({
      name: project,
      data: buckets.map((b) => {
        const m = byBucketProject.get(b.value);
        const users = m?.get(project);
        return [b.value, users ? users.size : 0] as [number, number];
      }),
    }));
    return { buckets, series: seriesData };
  }, [events, timeRange]);

  const options: Highcharts.Options = useMemo(
    () => ({
      chart: { type: 'line', height: 320 },
      title: { text: undefined },
      xAxis: { type: 'datetime' },
      yAxis: { title: { text: 'Unique users' }, min: 0 },
      plotOptions: {
        line: {
          marker: { enabled: false },
        },
      },
      series: series.map((s, i) => ({
        type: 'line',
        name: s.name,
        data: s.data,
        color: DOMINO_COLORS[i % DOMINO_COLORS.length],
      })),
      credits: { enabled: false },
    }),
    [series]
  );

  if (buckets.length === 0) {
    return (
      <div className="h-full overflow-auto p-6">
        <h2 className="mb-2 text-lg font-medium text-[#3F4547]">Unique users per project over time</h2>
        <p className="text-sm text-[#7F8385]">No time buckets for the selected range.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6" role="region" aria-label="Unique users per project over time">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-2 text-lg font-medium text-[#3F4547]">Unique users per project over time</h2>
        <p className="mb-6 text-sm text-[#7F8385]">
          X-axis aligned with your time filter. Each line shows unique users who had activity in that project per period.
        </p>
        <HighchartsReact highcharts={Highcharts} options={options} />
      </div>
    </div>
  );
}
