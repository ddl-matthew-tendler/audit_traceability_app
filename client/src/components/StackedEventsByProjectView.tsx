import { useMemo } from 'react';
import { format, startOfDay } from 'date-fns';
import type { AuditEvent } from '../types';

const PROJECT_COLORS = [
  '#3B3BD3',
  '#10B981',
  '#F97316',
  '#8B5CF6',
  '#EF4444',
  '#14B8A6',
  '#6B7280',
  '#EC4899',
  '#84CC16',
  '#0EA5E9',
];

interface StackedEventsByProjectViewProps {
  events: AuditEvent[];
}

/** Stacked line/area: X = date, Y = number of events, stacked by project name */
export function StackedEventsByProjectView({ events }: StackedEventsByProjectViewProps) {
  const { days, series, maxTotal } = useMemo(() => {
    const byDayProject = new Map<number, Map<string, number>>();
    for (const ev of events) {
      if (!ev.timestamp) continue;
      const day = startOfDay(new Date(ev.timestamp)).getTime();
      const proj = ev.withinProjectName ?? ev.withinProjectId ?? 'Other';
      if (!byDayProject.has(day)) byDayProject.set(day, new Map());
      const projMap = byDayProject.get(day)!;
      projMap.set(proj, (projMap.get(proj) ?? 0) + 1);
    }
    const days = Array.from(byDayProject.keys()).sort((a, b) => a - b).slice(-90);
    const projectTotals = new Map<string, number>();
    for (const projMap of byDayProject.values()) {
      for (const [proj, count] of projMap) {
        projectTotals.set(proj, (projectTotals.get(proj) ?? 0) + count);
      }
    }
    const projectOrder = Array.from(projectTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([p]) => p);
    const dayTotals = days.map((day) => {
      let t = 0;
      const projMap = byDayProject.get(day);
      if (projMap) for (const c of projMap.values()) t += c;
      return t;
    });
    const maxTotal = Math.max(...dayTotals, 1);
    const series = projectOrder.map((project, idx) => {
      const points = days.map((day) => {
        const projMap = byDayProject.get(day);
        const count = projMap?.get(project) ?? 0;
        let yBottom = 0;
        for (let j = 0; j < idx; j++) {
          yBottom += projMap?.get(projectOrder[j]) ?? 0;
        }
        const yTop = yBottom + count;
        return { day, yBottom, yTop };
      });
      return { project, points };
    });
    return { days, series, maxTotal };
  }, [events]);

  const width = 900;
  const height = 320;
  const margin = { top: 20, right: 120, bottom: 36, left: 48 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  if (days.length === 0) {
    return (
      <div className="h-full overflow-auto p-6">
        <h2 className="mb-2 text-lg font-medium text-[#3F4547]">Events by project over time (stacked)</h2>
        <p className="text-sm text-[#7F8385]">No events with timestamps in the selected range.</p>
      </div>
    );
  }

  const xScale = (day: number) =>
    margin.left + ((day - days[0]) / (days[days.length - 1] - days[0] || 1)) * chartWidth;
  const yScale = (v: number) => margin.top + chartHeight - (v / maxTotal) * chartHeight;

  const areaPaths = series.map((s) => {
    const topLine = s.points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.day)} ${yScale(p.yTop)}`)
      .join(' ');
    const bottomLine = [...s.points]
      .reverse()
      .map((p) => `L ${xScale(p.day)} ${yScale(p.yBottom)}`)
      .join(' ');
    return ` ${topLine} L ${xScale(s.points[s.points.length - 1].day)} ${yScale(s.points[s.points.length - 1].yBottom)} ${bottomLine} Z`;
  });

  return (
    <div className="h-full overflow-auto p-6" role="region" aria-label="Events by project over time stacked">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-2 text-lg font-medium text-[#3F4547]">Events by project over time (stacked)</h2>
        <p className="mb-4 text-sm text-[#7F8385]">
          X = date, Y = number of events. Each band is one project; stacked total shows overall activity.
        </p>
        <svg width={width} height={height} className="overflow-visible">
          {series.map((s, idx) => (
            <path
              key={s.project}
              d={areaPaths[idx]}
              fill={PROJECT_COLORS[idx % PROJECT_COLORS.length]}
              fillOpacity={0.85}
              stroke={PROJECT_COLORS[idx % PROJECT_COLORS.length]}
              strokeWidth={1}
            />
          ))}
          <line
            x1={margin.left}
            y1={margin.top}
            x2={margin.left}
            y2={margin.top + chartHeight}
            stroke="#DBE4E8"
            strokeWidth={1}
          />
          <line
            x1={margin.left}
            y1={margin.top + chartHeight}
            x2={margin.left + chartWidth}
            y2={margin.top + chartHeight}
            stroke="#DBE4E8"
            strokeWidth={1}
          />
          {days.filter((_, i) => i % Math.ceil(days.length / 8) === 0).map((day) => (
            <text
              key={day}
              x={xScale(day)}
              y={height - 8}
              textAnchor="middle"
              className="fill-[#7F8385] text-[11px]"
            >
              {format(day, 'M/d')}
            </text>
          ))}
          {[0.25, 0.5, 0.75, 1].map((q) => (
            <text
              key={q}
              x={margin.left - 6}
              y={yScale(maxTotal * q) + 4}
              textAnchor="end"
              className="fill-[#7F8385] text-[11px]"
            >
              {Math.round(maxTotal * q)}
            </text>
          ))}
          {series.map((s, idx) => (
            <g key={s.project}>
              <rect
                x={width - margin.right + 8}
                y={margin.top + idx * 18}
                width={10}
                height={10}
                fill={PROJECT_COLORS[idx % PROJECT_COLORS.length]}
              />
              <text
                x={width - margin.right + 22}
                y={margin.top + idx * 18 + 10}
                className="fill-[#3F4547] text-[11px]"
              >
                {s.project.length > 20 ? s.project.slice(0, 18) + '…' : s.project}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
