import { useMemo } from 'react';
import type { AuditEvent } from '../types';
import { HoverTooltip } from './HoverTooltip';

const BAR_COLORS = [
  '#543FDE',
  '#0070CC',
  '#28A464',
  '#CCB718',
  '#FF6543',
  '#E835A7',
  '#2EDCC4',
  '#A9734C',
];

interface ActivityByProjectViewProps {
  events: AuditEvent[];
}

export function ActivityByProjectView({ events }: ActivityByProjectViewProps) {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of events) {
      const proj = ev.withinProjectName ?? ev.withinProjectId ?? 'Other';
      map.set(proj, (map.get(proj) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
  }, [events]);

  const maxCount = counts[0]?.[1] ?? 1;
  const chartWidth = 400;

  return (
    <div className="h-full overflow-auto p-6" role="region" aria-label="Activity by project">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-2 text-lg font-medium text-[#3F4547]">Activity by project</h2>
        <p className="mb-6 text-sm text-[#7F8385]">
          Which projects are driving the most usage. Hover over bars for details.
        </p>

        <div className="overflow-hidden rounded-lg border border-[#E0E0E0] bg-white shadow-sm">
          <div className="flex border-b border-[#E0E0E0] bg-[#FAFAFA] px-4 py-2">
            <span className="w-48 shrink-0 text-xs font-semibold uppercase tracking-wider text-[#65657B]">
              Project
            </span>
            <div className="flex-1" />
            <span className="w-16 shrink-0 text-right text-xs font-semibold uppercase tracking-wider text-[#65657B]">
              Events
            </span>
          </div>
          <div className="divide-y divide-[#E0E0E0]">
            {counts.map(([project, count], idx) => (
              <HoverTooltip
                key={project}
                content={
                  <div className="space-y-0.5">
                    <p className="font-semibold text-[#2E2E38]">{project}</p>
                    <p>{count.toLocaleString()} events</p>
                    <p className="text-xs text-[#7F8385]">
                      {maxCount > 0 ? ((count / maxCount) * 100).toFixed(0) : 0}% of top project · Rank #{idx + 1}
                    </p>
                  </div>
                }
                className="block"
              >
                <div className="flex cursor-help items-center gap-4 px-4 py-2 transition-colors hover:bg-[#F5F5F5]">
                  <span
                    className="w-48 shrink-0 truncate text-sm font-medium text-[#3F4547]"
                    title={project}
                  >
                    {project}
                  </span>
                  <div
                    className="flex-1 overflow-hidden rounded bg-[#FAFAFA]"
                    style={{ maxWidth: chartWidth }}
                  >
                    <div
                      className="h-8 rounded transition-all"
                      style={{
                        width: `${(count / maxCount) * 100}%`,
                        minWidth: count > 0 ? 8 : 0,
                        backgroundColor: BAR_COLORS[idx % BAR_COLORS.length],
                      }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-sm tabular-nums font-medium text-[#3F4547]">
                    {count.toLocaleString()}
                  </span>
                </div>
              </HoverTooltip>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
