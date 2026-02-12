import { useMemo } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import type { AuditEvent } from '../types';
import type { TimeRange } from './TimeRangePicker';
import { getTimeBucketsForRange, bucketEventsByTime } from '../utils/chartTimeBuckets';

interface UsageOverTimeViewProps {
  events: AuditEvent[];
  timeRange: TimeRange;
}

/** Events over time — x-axis aligned with selected time filter */
export function UsageOverTimeView({ events, timeRange }: UsageOverTimeViewProps) {
  const { buckets, seriesData } = useMemo(() => {
    const buckets = getTimeBucketsForRange(timeRange);
    const counts = bucketEventsByTime(events, buckets);
    const data = buckets.map((b) => [b.value, counts.get(b.value) ?? 0] as [number, number]);
    return { buckets, seriesData: data };
  }, [events, timeRange]);

  const bucketMap = useMemo(() => new Map(buckets.map((b) => [b.value, b])), [buckets]);

  const options: Highcharts.Options = useMemo(
    () => ({
      chart: { type: 'column', height: 320 },
      title: { text: undefined },
      xAxis: {
        type: 'datetime',
        tickmarkPlacement: 'on',
      },
      yAxis: {
        title: { text: 'Events' },
        min: 0,
      },
      series: [
        {
          type: 'column',
          name: 'Events',
          data: seriesData,
          color: '#543FDE',
        },
      ],
      tooltip: {
        useHTML: true,
        formatter: function () {
          const x = this.x as number;
          const y = this.y ?? 0;
          const b = bucketMap.get(x);
          return `<b>${b?.name ?? new Date(x).toLocaleDateString()}</b><br/>${Number(y).toLocaleString()} events`;
        },
      },
      plotOptions: {
        column: {
          borderRadius: 4,
        },
      },
      credits: { enabled: false },
    }),
    [seriesData, bucketMap]
  );
  if (buckets.length === 0) {
    return (
      <div className="h-full overflow-auto p-6">
        <h2 className="mb-2 text-lg font-medium text-[#3F4547]">Usage over time</h2>
        <p className="text-sm text-[#7F8385]">No time buckets for the selected range.</p>
      </div>
    );
  }
  return (
    <div className="h-full overflow-auto p-6" role="region" aria-label="Usage over time">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-2 text-lg font-medium text-[#3F4547]">Usage over time</h2>
        <p className="mb-6 text-sm text-[#7F8385]">
          Events in the selected period — x-axis aligned with your time filter.
        </p>
        <HighchartsReact highcharts={Highcharts} options={options} />
      </div>
    </div>
  );
}
