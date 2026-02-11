import type { Node, Edge } from 'reactflow';
import type { AuditEvent } from '../types';
import { getEventCategory } from './eventCategory';
import { NODE_COLORS } from '../types';

const TEMPORAL_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function eventId(ev: AuditEvent, index: number): string {
  return ev.id ?? `ev-${index}`;
}

export interface GraphInput {
  events: AuditEvent[];
  categoryFilter: (category: string) => boolean;
}

export function buildDag(input: GraphInput): { nodes: Node[]; edges: Edge[] } {
  const { events, categoryFilter } = input;
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const edgeIds = new Set<string>();

  const sorted = [...events].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    const id = eventId(ev, events.indexOf(ev));
    const category = getEventCategory(ev);
    if (!categoryFilter(category)) continue;

    nodes.push({
      id,
      type: 'auditNode',
      position: { x: 0, y: 0 },
      data: {
        event: ev,
        eventName: ev.event || 'Event',
        timeAgo: ev.timestamp,
        targetName: ev.targetName ?? ev.targetId ?? '',
        category,
        color: NODE_COLORS[category as keyof typeof NODE_COLORS] ?? NODE_COLORS.default,
      },
    });
  }

  const nodeIdSet = new Set(nodes.map((n) => n.id));

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const idA = eventId(a, events.indexOf(a));
    if (!nodeIdSet.has(idA)) continue;
    const timeA = a.timestamp || 0;
    const projectA = a.withinProjectId || '';
    const targetA = a.targetId || '';

    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      const idB = eventId(b, events.indexOf(b));
      if (!nodeIdSet.has(idB)) continue;
      const timeB = b.timestamp || 0;
      const projectB = b.withinProjectId || '';
      const targetB = b.targetId || '';

      let shouldEdge = false;
      if (projectA && projectA === projectB && timeB - timeA <= TEMPORAL_WINDOW_MS) {
        shouldEdge = true;
      }
      if (targetA && (targetB === targetA || projectB === targetA)) shouldEdge = true;
      if (targetB && projectA === targetB) shouldEdge = true;

      if (shouldEdge) {
        const eid = `e-${idA}-${idB}`;
        if (!edgeIds.has(eid)) {
          edgeIds.add(eid);
          edges.push({ id: eid, source: idA, target: idB });
        }
      }
    }
  }

  return { nodes, edges };
}
