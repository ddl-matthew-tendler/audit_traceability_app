import { useMemo } from 'react';
import { format, startOfDay } from 'date-fns';
import type { AuditEvent } from '../types';
import { HoverTooltip } from './HoverTooltip';

interface UsageOverTimeViewProps {
  events: AuditEvent[];
}

/** Events per day for the selected time range */
export function UsageOverTimeView({ events }: UsageOverTimeViewProps) {
  const byDay = useMemo(() => {
    const map = new Map<number, number>();
    for (const ev of events) {
      if (ev.timestamp) {
        const day = startOfDay(new Date(ev.timestamp)).getTime();
        map.set(day, (map.get(day) ?? 0) + 1);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .slice(-60);
  }, [events]);

  const maxCount = Math.max(...byDay.map(([, c]) => c), 1);

  return (
    <div className="h-full overflow-auto p-6" role="region" aria-label="Usage over time">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-6 text-lg font-medium text-[#3F4547]">Usage over time</h2>
        <p className="mb-4 text-sm text-[#7F8385]">Events per day — see how Domino adoption trends over the period.</p>
        {byDay.length === 0 ? (
          <p className="text-sm text-[#7F8385]">No events with timestamps in the selected range.</p>
        ) : (
          <div className="flex items-end gap-1" style={{ minHeight: 200 }}>
            {byDay.map(([dayMs, count]) => (
              <HoverTooltip
                key={dayMs}
                content={
                  <div className="space-y-0.5">
                    <p className="font-semibold text-[#2E2E38]">
                      {format(new Date(dayMs), 'EEEE, MMMM d, yyyy')}
                    </p>
                    <p>{count.toLocaleString()} events</p>
                    <p className="text-xs text-[#7F8385]">
                      {maxCount > 0 ? ((count / maxCount) * 100).toFixed(0) : 0}% of peak day
                    </p>
                  </div>
                }
                className="flex flex-1 flex-col items-center gap-1"
              >
                <div className="flex flex-1 flex-col items-center gap-1 cursor-help w-full">
                  <span className="text-xs tabular-nums text-[#7F8385]">
                    {count > 0 ? count.toLocaleString() : ''}
                  </span>
                  <div
                    className="w-full min-w-[4px] rounded-t bg-[#3B3BD3] transition-opacity hover:opacity-90"
                    style={{
                      height: `${(count / maxCount) * 160}px`,
                      minHeight: count > 0 ? 4 : 0,
                    }}
                  />
                  <span className="text-[10px] text-[#7F8385]">{format(dayMs, 'M/d')}</span>
                </div>
              </HoverTooltip>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
