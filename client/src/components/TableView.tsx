import { useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import type { AuditEvent } from '../types';
import { getEventCategory } from '../utils/eventCategory';

interface TableViewProps {
  events: AuditEvent[];
  onSelectEvent: (event: AuditEvent | null) => void;
  selectedEventId: string | null;
  categoryFilter: (cat: string) => boolean;
}

function eventId(ev: AuditEvent, index: number): string {
  return ev.id ?? `ev-${index}`;
}

type SortKey = 'time' | 'event' | 'actor' | 'target' | 'project';

export function TableView({
  events,
  onSelectEvent,
  selectedEventId,
  categoryFilter,
}: TableViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const list = events.filter((e) => categoryFilter(getEventCategory(e)));
    const cmp = (a: AuditEvent, b: AuditEvent): number => {
      let va: string | number = '';
      let vb: string | number = '';
      switch (sortKey) {
        case 'time':
          va = a.timestamp ?? 0;
          vb = b.timestamp ?? 0;
          return va < vb ? -1 : va > vb ? 1 : 0;
        case 'event':
          va = (a.event ?? '').toLowerCase();
          vb = (b.event ?? '').toLowerCase();
          return String(va).localeCompare(String(vb));
        case 'actor':
          va = (a.actorName ?? a.actorId ?? '').toLowerCase();
          vb = (b.actorName ?? b.actorId ?? '').toLowerCase();
          return String(va).localeCompare(String(vb));
        case 'target':
          va = (a.targetName ?? a.targetId ?? '').toString().toLowerCase();
          vb = (b.targetName ?? b.targetId ?? '').toString().toLowerCase();
          return String(va).localeCompare(String(vb));
        case 'project':
          va = (a.withinProjectName ?? a.withinProjectId ?? '').toLowerCase();
          vb = (b.withinProjectName ?? b.withinProjectId ?? '').toLowerCase();
          return String(va).localeCompare(String(vb));
        default:
          return 0;
      }
    };
    const out = [...list].sort((a, b) => {
      const r = cmp(a, b);
      return sortDir === 'asc' ? r : -r;
    });
    return out;
  }, [events, categoryFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'time' ? 'desc' : 'asc');
    }
  };

  return (
    <div className="h-full overflow-auto" role="region" aria-label="Events table">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-domino-bg">
          <tr className="border-b border-domino-border">
            <th className="px-4 py-2 text-left">
              <button
                type="button"
                onClick={() => toggleSort('time')}
                className="font-medium text-domino-text"
              >
                Time {sortKey === 'time' && (sortDir === 'asc' ? '↑' : '↓')}
              </button>
            </th>
            <th className="px-4 py-2 text-left">
              <button
                type="button"
                onClick={() => toggleSort('event')}
                className="font-medium text-domino-text"
              >
                Event {sortKey === 'event' && (sortDir === 'asc' ? '↑' : '↓')}
              </button>
            </th>
            <th className="px-4 py-2 text-left">
              <button
                type="button"
                onClick={() => toggleSort('actor')}
                className="font-medium text-domino-text"
              >
                Actor {sortKey === 'actor' && (sortDir === 'asc' ? '↑' : '↓')}
              </button>
            </th>
            <th className="px-4 py-2 text-left">
              <button
                type="button"
                onClick={() => toggleSort('target')}
                className="font-medium text-domino-text"
              >
                Target {sortKey === 'target' && (sortDir === 'asc' ? '↑' : '↓')}
              </button>
            </th>
            <th className="px-4 py-2 text-left">
              <button
                type="button"
                onClick={() => toggleSort('project')}
                className="font-medium text-domino-text"
              >
                Project {sortKey === 'project' && (sortDir === 'asc' ? '↑' : '↓')}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((ev) => {
            const id = eventId(ev, events.indexOf(ev));
            const isSelected = selectedEventId === id;

            return (
              <tr
                key={id}
                onClick={() => onSelectEvent(isSelected ? null : ev)}
                className={`cursor-pointer border-b border-domino-border hover:bg-domino-bg ${
                  isSelected ? 'bg-domino-secondarySurface' : ''
                }`}
              >
                <td className="px-4 py-2 text-domino-text-body" title={ev.timestamp ? format(new Date(ev.timestamp), 'PPpp') : ''}>
                  {ev.timestamp ? formatDistanceToNow(ev.timestamp, { addSuffix: true }) : '—'}
                </td>
                <td className="max-w-[200px] truncate px-4 py-2 text-domino-text" title={ev.event ?? ''}>
                  {ev.event ?? '—'}
                </td>
                <td className="max-w-[120px] truncate px-4 py-2 text-domino-text" title={ev.actorName ?? ev.actorId ?? ''}>
                  {ev.actorName ?? ev.actorId ?? '—'}
                </td>
                <td className="max-w-[180px] truncate px-4 py-2 text-domino-text" title={(ev.targetName ?? ev.targetId) ?? ''}>
                  {ev.targetName ?? ev.targetId ?? '—'}
                </td>
                <td className="max-w-[150px] truncate px-4 py-2 text-domino-text-body" title={ev.withinProjectName ?? ev.withinProjectId ?? ''}>
                  {ev.withinProjectName ?? ev.withinProjectId ?? '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
