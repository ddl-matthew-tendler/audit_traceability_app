import { useMemo } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import type { AuditEvent } from '../types';
import { getEventCategory } from '../utils/eventCategory';
import { NODE_COLORS } from '../types';

interface TimelineViewProps {
  events: AuditEvent[];
  onSelectEvent: (event: AuditEvent | null) => void;
  selectedEventId: string | null;
  categoryFilter: (cat: string) => boolean;
}

function eventId(ev: AuditEvent, index: number): string {
  return ev.id ?? `ev-${index}`;
}

export function TimelineView({
  events,
  onSelectEvent,
  selectedEventId,
  categoryFilter,
}: TimelineViewProps) {
  const sorted = useMemo(() => {
    const list = events.filter((e) => categoryFilter(getEventCategory(e)));
    return [...list].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }, [events, categoryFilter]);

  return (
    <div className="h-full overflow-auto" role="list" aria-label="Timeline of events">
      <div className="mx-auto max-w-2xl py-4">
        {sorted.map((ev) => {
          const id = eventId(ev, events.indexOf(ev));
          const category = getEventCategory(ev);
          const color = NODE_COLORS[category] ?? NODE_COLORS.default;
          const isSelected = selectedEventId === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectEvent(isSelected ? null : ev)}
              className={`mb-4 flex w-full items-start gap-4 rounded-lg border-l-4 p-3 text-left transition ${
                isSelected
                  ? 'border-domino-primary bg-domino-secondarySurface'
                  : 'border-domino-border bg-domino-container hover:bg-domino-bg'
              }`}
              style={{ borderLeftColor: color }}
              role="listitem"
              aria-selected={isSelected}
            >
              <div className="shrink-0 text-xs text-domino-text-body">
                {ev.timestamp
                  ? format(new Date(ev.timestamp), 'MMM d, HH:mm')
                  : '—'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-domino-text">{ev.event ?? 'Event'}</div>
                <div className="text-sm text-domino-text-body">
                  {ev.actorName ?? ev.actorId ?? '—'} · {ev.targetName ?? ev.targetId ?? '—'}
                </div>
                <div className="mt-1 text-xs text-domino-text-body">
                  {ev.timestamp ? formatDistanceToNow(ev.timestamp, { addSuffix: true }) : ''}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
