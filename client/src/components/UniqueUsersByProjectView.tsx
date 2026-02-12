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

interface UniqueUsersByProjectViewProps {
  events: AuditEvent[];
}

/** Line chart: X = date, Y = unique users, one line per project */
export function UniqueUsersByProjectView({ events }: UniqueUsersByProjectViewProps) {
  const { days, series, maxUsers } = useMemo(() => {
    const byDayProject = new Map<number, Map<string, Set<string>>>();
    for (const ev of events) {
      if (!ev.timestamp) continue;
      const day = startOfDay(new Date(ev.timestamp)).getTime();
      const proj = ev.withinProjectName ?? ev.withinProjectId ?? 'Other';
      const uid = ev.actorId ?? ev.actorName ?? '';
      if (!uid) continue;
      if (!byDayProject.has(day)) byDayProject.set(day, new Map());
      const projMap = byDayProject.get(day)!;
      if (!projMap.has(proj)) projMap.set(proj, new Set());
      projMap.get(proj)!.add(uid);
    }
    const days = Array.from(byDayProject.keys()).sort((a, b) => a - b).slice(-90);
    const projectSet = new Set<string>();
    for (const projMap of byDayProject.values()) {
      for (const p of projMap.keys()) projectSet.add(p);
    }
    const projectOrder = Array.from(projectSet).sort();
    const seriesData = projectOrder.map((project) => {
      const points = days.map((day) => {
        const projMap = byDayProject.get(day);
        const users = projMap?.get(project);
        return { day, count: users ? users.size : 0 };
      });
      return { project, points };
    });
    let maxUsers = 0;
    for (const s of seriesData) {
      for (const p of s.points) if (p.count > maxUsers) maxUsers = p.count;
    }
    maxUsers = Math.max(maxUsers, 1);
    return { days, series: seriesData, maxUsers };
  }, [events]);

  const width = 900;
  const height = 320;
  const margin = { top: 20, right: 120, bottom: 36, left: 48 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  if (days.length === 0) {
    return (
      <div className="h-full overflow-auto p-6">
        <h2 className="mb-2 text-lg font-medium text-[#3F4547]">Unique users per project over time</h2>
        <p className="text-sm text-[#7F8385]">No events with timestamps in the selected range.</p>
      </div>
    );
  }

  const xScale = (day: number) =>
    margin.left + ((day - days[0]) / (days[days.length - 1] - days[0] || 1)) * chartWidth;
  const yScale = (v: number) => margin.top + chartHeight - (v / maxUsers) * chartHeight;

  return (
    <div className="h-full overflow-auto p-6" role="region" aria-label="Unique users per project over time">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-2 text-lg font-medium text-[#3F4547]">Unique users per project over time</h2>
        <p className="mb-4 text-sm text-[#7F8385]">
          X = date, Y = number of unique users who had activity in that project on that day.
        </p>
        <svg width={width} height={height} className="overflow-visible">
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
              y={yScale(maxUsers * q) + 4}
              textAnchor="end"
              className="fill-[#7F8385] text-[11px]"
            >
              {Math.round(maxUsers * q)}
            </text>
          ))}
          {series.map((s, idx) => {
            const color = PROJECT_COLORS[idx % PROJECT_COLORS.length];
            const pathD = s.points
              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.day)} ${yScale(p.count)}`)
              .join(' ');
            return (
              <path
                key={s.project}
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}
          {series.map((s, idx) => (
            <g key={s.project}>
              <line
                x1={width - margin.right + 8}
                y1={margin.top + idx * 18 + 5}
                x2={width - margin.right + 18}
                y2={margin.top + idx * 18 + 5}
                stroke={PROJECT_COLORS[idx % PROJECT_COLORS.length]}
                strokeWidth={2}
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
