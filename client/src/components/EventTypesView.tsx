import { useMemo } from 'react';
import type { AuditEvent } from '../types';
import { HoverTooltip } from './HoverTooltip';

const DOMINO_ACCENT_COLORS = [
  '#543FDE',
  '#0070CC',
  '#28A464',
  '#CCB718',
  '#FF6543',
  '#E835A7',
  '#2EDCC4',
  '#A9734C',
];

interface EventTypesViewProps {
  events: AuditEvent[];
}

export function EventTypesView({ events }: EventTypesViewProps) {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of events) {
      const name = ev.event ?? 'Unknown';
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40);
  }, [events]);

  const total = counts.reduce((s, [, c]) => s + c, 0);
  const maxCount = counts[0]?.[1] ?? 1;

  return (
    <div className="h-full overflow-auto p-6" role="region" aria-label="Event types breakdown">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-2 text-lg font-medium text-[#3F4547]">Event types</h2>
        <p className="mb-6 text-sm text-[#65657B]">
          Breakdown of what users are doing in Domino. Hover over rows for more details.
        </p>

        {/* Domino-styled table */}
        <div className="overflow-hidden rounded-lg border border-[#E0E0E0] bg-white shadow-sm">
          <table className="w-full border-collapse" role="table">
            <thead>
              <tr className="bg-[#FAFAFA]">
                <th
                  className="border-b border-[#E0E0E0] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#65657B]"
                  scope="col"
                >
                  #
                </th>
                <th
                  className="border-b border-[#E0E0E0] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#65657B]"
                  scope="col"
                >
                  Event type
                </th>
                <th
                  className="border-b border-[#E0E0E0] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#65657B]"
                  scope="col"
                >
                  Count
                </th>
                <th
                  className="border-b border-[#E0E0E0] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#65657B]"
                  scope="col"
                >
                  Share
                </th>
                <th
                  className="w-1/3 border-b border-[#E0E0E0] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#65657B]"
                  scope="col"
                >
                  Distribution
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E0E0]">
              {counts.map(([eventName, count], idx) => {
                const pct = total > 0 ? (count / total) * 100 : 0;
                const barPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                const color = DOMINO_ACCENT_COLORS[idx % DOMINO_ACCENT_COLORS.length];
                return (
                  <HoverTooltip
                    key={eventName}
                    content={
                      <div className="space-y-1">
                        <p className="font-semibold text-[#2E2E38]">{eventName}</p>
                        <p>{count.toLocaleString()} events ({pct.toFixed(1)}% of total)</p>
                        <p className="text-xs text-[#7F8385]">
                          Rank #{idx + 1} of {counts.length} event types
                        </p>
                      </div>
                    }
                    className="block"
                  >
                    <tr className="cursor-help transition-colors hover:bg-[#F5F5F5]">
                      <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-[#8F8FA3]">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-[#2E2E38]" title={eventName}>
                          {eventName.length > 50 ? eventName.slice(0, 48) + '…' : eventName}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium tabular-nums text-[#3F4547]">
                        {count.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-[#65657B]">
                        {pct.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-6 overflow-hidden rounded bg-[#FAFAFA]">
                          <div
                            className="h-full rounded transition-all"
                            style={{
                              width: `${barPct}%`,
                              minWidth: count > 0 ? 4 : 0,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  </HoverTooltip>
                );
              })}
            </tbody>
          </table>
        </div>

        {counts.length === 0 && (
          <p className="py-8 text-center text-sm text-[#8F8FA3]">No event types in the selected range.</p>
        )}
      </div>
    </div>
  );
}
