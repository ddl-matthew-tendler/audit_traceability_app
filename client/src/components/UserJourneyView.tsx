import { useMemo } from 'react';
import { format } from 'date-fns';
import type { AuditEvent } from '../types';
import { getEventCategory } from '../utils/eventCategory';
import { NODE_COLORS } from '../types';

interface UserJourneyViewProps {
  events: AuditEvent[];
  onSelectEvent: (event: AuditEvent | null) => void;
  selectedEventId: string | null;
  categoryFilter: (cat: string) => boolean;
  selectedUserIds: string[];
}

function eventId(ev: AuditEvent, index: number): string {
  return ev.id ?? `ev-${index}`;
}

/** Timeline showing user movements across projects and datasets */
export function UserJourneyView({
  events,
  onSelectEvent,
  selectedEventId,
  categoryFilter,
  selectedUserIds,
}: UserJourneyViewProps) {
  const byProject = useMemo(() => {
    const list = events.filter((e) => categoryFilter(getEventCategory(e)));
    const map = new Map<string, AuditEvent[]>();
    for (const ev of list) {
      const proj = ev.withinProjectName ?? ev.withinProjectId ?? 'Other';
      if (!map.has(proj)) map.set(proj, []);
      map.get(proj)!.push(ev);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [events, categoryFilter]);

  const noUserSelected = selectedUserIds.length === 0;

  return (
    <div className="h-full overflow-auto" role="region" aria-label="User journey by project">
      {noUserSelected ? (
        <div className="flex h-full items-center justify-center px-4">
          <p className="text-center text-domino-text-body">
            Select a user above to see their movements across projects and datasets.
          </p>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl py-4">
          {byProject.map(([project, projectEvents]) => (
            <section key={project} className="mb-8">
              <h3 className="mb-3 text-sm font-medium text-domino-text-body">{project}</h3>
              <div className="space-y-2">
                {projectEvents.map((ev) => {
                  const id = eventId(ev, events.indexOf(ev));
                  const category = getEventCategory(ev);
                  const color = NODE_COLORS[category] ?? NODE_COLORS.default;
                  const isSelected = selectedEventId === id;

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onSelectEvent(isSelected ? null : ev)}
                      className={`flex w-full items-center gap-3 rounded-lg border-l-4 p-3 text-left transition ${
                        isSelected
                          ? 'border-domino-primary bg-[#EDECFB]'
                          : 'border-domino-border bg-domino-container hover:bg-domino-bg'
                      }`}
                      style={{ borderLeftColor: color }}
                      aria-selected={isSelected}
                    >
                      <span className="shrink-0 text-xs text-domino-text-body tabular-nums">
                        {ev.timestamp ? format(ev.timestamp, 'MMM d, HH:mm') : '—'}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-domino-text">
                        {ev.event ?? 'Event'}
                      </span>
                      <span className="shrink-0 truncate text-sm text-domino-text-body">
                        {ev.targetName ?? ev.targetId ?? '—'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
