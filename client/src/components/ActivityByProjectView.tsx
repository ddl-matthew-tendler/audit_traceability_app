import { useMemo } from 'react';
import type { AuditEvent } from '../types';
import { getEventCategory } from '../utils/eventCategory';

interface ActivityByProjectViewProps {
  events: AuditEvent[];
  categoryFilter: (cat: string) => boolean;
}

export function ActivityByProjectView({ events, categoryFilter }: ActivityByProjectViewProps) {
  const counts = useMemo(() => {
    const list = events.filter((e) => categoryFilter(getEventCategory(e)));
    const map = new Map<string, number>();
    for (const ev of list) {
      const proj = ev.withinProjectName ?? ev.withinProjectId ?? 'Other';
      map.set(proj, (map.get(proj) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30);
  }, [events, categoryFilter]);

  const maxCount = counts[0]?.[1] ?? 1;

  return (
    <div className="h-full overflow-auto p-6" role="region" aria-label="Activity by project">
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-4 text-lg font-medium text-domino-text">Events by project</h2>
        <div className="space-y-3">
          {counts.map(([project, count]) => (
            <div key={project} className="flex items-center gap-4">
              <span className="min-w-[180px] truncate text-sm text-domino-text" title={project}>
                {project}
              </span>
              <div className="flex-1 overflow-hidden rounded bg-domino-container">
                <div
                  className="h-6 rounded bg-[#3B3BD3]"
                  style={{ width: `${(count / maxCount) * 100}%`, minWidth: count > 0 ? '4px' : 0 }}
                />
              </div>
              <span className="w-12 shrink-0 text-right text-sm tabular-nums text-domino-text-body">
                {count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
