import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
  ReactFlowProvider,
  Panel,
} from 'reactflow';
import dagre from '@dagrejs/dagre';
import 'reactflow/dist/style.css';
import { AuditNode } from './AuditNode';
import { ContextMenu } from './ContextMenu';
import { useAppStore } from '../store/useAppStore';
import { buildDag } from '../utils/dagBuilder';
import type { AuditEvent } from '../types';

const nodeTypes = { auditNode: AuditNode };

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 60, nodesep: 40 });

  nodes.forEach((n) => g.setNode(n.id, { width: 180, height: 70 }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  const layoutedNodes = nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: { x: pos.x - 90, y: pos.y - 35 },
    };
  });

  return { nodes: layoutedNodes, edges };
}

interface DAGCanvasInnerProps {
  events: AuditEvent[];
  onNodeSelect: (event: AuditEvent | null) => void;
  selectedEventId: string | null;
  onShowByUser: (actorId: string) => void;
}

function DAGCanvasInner({ events, onNodeSelect, selectedEventId: _selectedEventId, onShowByUser }: DAGCanvasInnerProps) {
  const { categoryFilters, projectFilter, searchQuery, setTargetIdFilter } = useAppStore();
  const [contextMenu, setContextMenu] = useState<{ event: AuditEvent; x: number; y: number } | null>(null);

  const filtered = useMemo(() => {
    let list = events;
    if (projectFilter) {
      list = list.filter(
        (e) => e.withinProjectId === projectFilter || e.withinProjectName === projectFilter
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => {
        const name = (e.event ?? '').toLowerCase();
        const target = ((e.targetName ?? e.targetId) ?? '').toString().toLowerCase();
        const meta = JSON.stringify(e.metadata ?? {}).toLowerCase();
        return name.includes(q) || target.includes(q) || meta.includes(q);
      });
    }
    return list;
  }, [events, projectFilter, searchQuery]);

  const categoryFilterFn = useCallback(
    (cat: string) => categoryFilters[cat] !== false,
    [categoryFilters]
  );

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildDag({ events: filtered, categoryFilter: categoryFilterFn }),
    [filtered, categoryFilterFn]
  );

  const layouted = useMemo(
    () => getLayoutedElements(initialNodes, initialEdges),
    [initialNodes, initialEdges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layouted.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layouted.edges);

  useEffect(() => {
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  }, [layouted, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const ev = (node.data as { event?: AuditEvent }).event;
      onNodeSelect(ev ?? null);
    },
    [onNodeSelect]
  );

  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
    setContextMenu(null);
  }, [onNodeSelect]);

  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: Node) => {
      e.preventDefault();
      const ev = (node.data as { event?: AuditEvent }).event;
      if (ev) setContextMenu({ event: ev, x: e.clientX, y: e.clientY });
    },
    []
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={onNodeClick}
      onNodeContextMenu={onNodeContextMenu}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.1}
      maxZoom={2}
      defaultEdgeOptions={{ type: 'smoothstep' }}
      aria-label="DAG of audit events"
    >
      <Background />
      <Controls showInteractive={false} />
      <MiniMap nodeColor={(n) => (n.data?.color as string) ?? '#6B7280'} />
      <Panel position="top-right">
        <span className="rounded bg-domino-container px-2 py-1 text-xs text-domino-text shadow">
          {nodes.length} nodes
        </span>
      </Panel>
      {contextMenu && (
        <ContextMenu
          event={contextMenu.event}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onShowForTarget={(id) => setTargetIdFilter(id)}
          onShowByUser={onShowByUser}
        />
      )}
    </ReactFlow>
  );
}

interface DAGCanvasProps {
  events: AuditEvent[];
  onNodeSelect: (event: AuditEvent | null) => void;
  selectedEventId: string | null;
  onShowByUser: (actorId: string) => void;
}

export function DAGCanvas(props: DAGCanvasProps) {
  return (
    <ReactFlowProvider>
      <DAGCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
