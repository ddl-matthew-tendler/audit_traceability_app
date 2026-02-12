import { useMemo } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import type { AuditEvent } from '../types';
import { DOMINO_COLORS } from '../utils/highchartsTheme';

interface EventTypesViewProps {
  events: AuditEvent[];
}

export function EventTypesView({ events }: EventTypesViewProps) {
  const { categories, data } = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of events) {
      const name = ev.event ?? 'Unknown';
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    const sorted = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40);
    return {
      categories: sorted.map(([e]) => e),
      data: sorted.map(([, c]) => c),
    };
  }, [events]);

  const options: Highcharts.Options = useMemo(
    () => ({
      chart: { type: 'bar', height: Math.max(320, categories.length * 36), inverted: true },
      title: { text: undefined },
      xAxis: { categories },
      yAxis: { title: { text: 'Events' }, min: 0 },
      series: [
        {
          type: 'bar',
          name: 'Events',
          data: data.map((v, i) => ({ y: v, color: DOMINO_COLORS[i % DOMINO_COLORS.length] })),
        },
      ],
      plotOptions: {
        bar: {
          borderRadius: 4,
        },
      },
      legend: { enabled: false },
      credits: { enabled: false },
    }),
    [categories, data]
  );

  return (
    <div className="h-full overflow-auto p-6" role="region" aria-label="Event types breakdown">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-2 text-lg font-medium text-[#3F4547]">Event types</h2>
        <p className="mb-6 text-sm text-[#7F8385]">
          Breakdown of what users are doing in Domino. Hover over bars for details.
        </p>
        <HighchartsReact highcharts={Highcharts} options={options} />
      </div>
    </div>
  );
}
