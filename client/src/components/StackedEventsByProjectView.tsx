import { useMemo } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import type { AuditEvent } from '../types';
import type { TimeRange } from './TimeRangePicker';
import { getTimeBucketsForRange } from '../utils/chartTimeBuckets';
import { DOMINO_COLORS } from '../utils/highchartsTheme';

interface StackedEventsByProjectViewProps {
  events: AuditEvent[];
  timeRange: TimeRange;
}

/** Stacked area: X = time (aligned with filter), Y = events, stacked by project */
export function StackedEventsByProjectView({ events, timeRange }: StackedEventsByProjectViewProps) {
  const { buckets, series } = useMemo(() => {
    const buckets = getTimeBucketsForRange(timeRange);
    const byBucketProject = new Map<number, Map<string, number>>();
    for (const ev of events) {
      if (!ev.timestamp) continue;
      const proj = ev.withinProjectName ?? ev.withinProjectId ?? 'Other';
      for (let i = buckets.length - 1; i >= 0; i--) {
        if (ev.timestamp >= buckets[i].value) {
          if (!byBucketProject.has(buckets[i].value)) byBucketProject.set(buckets[i].value, new Map());
          const m = byBucketProject.get(buckets[i].value)!;
          m.set(proj, (m.get(proj) ?? 0) + 1);
          break;
        }
      }
    }
    const projectTotals = new Map<string, number>();
    for (const m of byBucketProject.values()) {
      for (const [p, c] of m) projectTotals.set(p, (projectTotals.get(p) ?? 0) + c);
    }
    const projectOrder = Array.from(projectTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([p]) => p);
    const seriesData = projectOrder.map((project) => ({
      name: project,
      data: buckets.map((b) => {
        const m = byBucketProject.get(b.value);
        return [b.value, m?.get(project) ?? 0] as [number, number];
      }),
    }));
    return { buckets, series: seriesData };
  }, [events, timeRange]);

  const options: Highcharts.Options = useMemo(
    () => ({
      chart: { type: 'area', height: 320 },
      title: { text: undefined },
      xAxis: { type: 'datetime' },
      yAxis: { title: { text: 'Events' }, min: 0 },
      plotOptions: {
        area: {
          stacking: 'normal',
          lineWidth: 1,
          marker: { enabled: false },
        },
      },
      series: series.map((s, i) => ({
        type: 'area',
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
        <h2 className="mb-2 text-lg font-medium text-[#3F4547]">Events by project over time (stacked)</h2>
        <p className="text-sm text-[#7F8385]">No time buckets for the selected range.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6" role="region" aria-label="Events by project over time stacked">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-2 text-lg font-medium text-[#3F4547]">Events by project over time (stacked)</h2>
        <p className="mb-6 text-sm text-[#7F8385]">
          X-axis aligned with your time filter. Each band is one project; stacked total shows overall activity.
        </p>
        <HighchartsReact highcharts={Highcharts} options={options} />
      </div>
    </div>
  );
}
