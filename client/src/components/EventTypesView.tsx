import { useMemo } from 'react';
import type { AuditEvent } from '../types';

interface EventTypesViewProps {
  events: AuditEvent[];
}

export function EventTypesView({ events }: EventTypesViewProps) {
  const counts = useMemo(() => {
    const list = events;
    const map = new Map<string, number>();
    for (const ev of list) {
      const name = ev.event ?? 'Unknown';
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40);
  }, [events]);

  const total = counts.reduce((s, [, c]) => s + c, 0);

  return (
    <div className="h-full overflow-auto p-6" role="region" aria-label="Event types breakdown">
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-2 text-lg font-medium text-[#3F4547]">Event types</h2>
        <p className="mb-4 text-sm text-[#7F8385]">Breakdown of what users are doing in Domino.</p>
        <div className="space-y-2">
          {counts.map(([eventName, count]) => {
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={eventName} className="flex items-center gap-4">
                <span className="min-w-[220px] truncate text-sm text-[#3F4547]" title={eventName}>
                  {eventName}
                </span>
                <span className="w-14 shrink-0 text-right text-sm tabular-nums text-[#7F8385]">
                  {count.toLocaleString()} ({pct.toFixed(1)}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
