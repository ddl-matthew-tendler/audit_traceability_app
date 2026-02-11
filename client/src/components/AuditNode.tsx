import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { formatDistanceToNow } from 'date-fns';

function truncate(s: string, len: number): string {
  if (!s) return '';
  return s.length <= len ? s : s.slice(0, len - 1) + '…';
}

const CATEGORY_ICONS: Record<string, string> = {
  project: '📁',
  data: '📊',
  execution: '▶',
  file: '📄',
  governance: '✓',
  environment: '🔧',
  user: '👤',
  default: '•',
};

function AuditNodeComponent({ data, selected }: NodeProps) {
  const eventName = (data.eventName as string) ?? 'Event';
  const timeAgo = data.timeAgo as number;
  const targetName = (data.targetName as string) ?? '';
  const category = (data.category as string) ?? 'default';
  const color = (data.color as string) ?? '#6B7280';
  const icon = CATEGORY_ICONS[category] ?? CATEGORY_ICONS.default;

  return (
    <div
      className={`min-w-[140px] max-w-[200px] rounded-lg border-2 px-2 py-1.5 shadow-sm ${
        selected ? 'ring-2 ring-domino-primary' : ''
      }`}
      style={{
        backgroundColor: color,
        borderColor: selected ? 'var(--domino-primary)' : 'rgba(0,0,0,0.1)',
        color: '#fff',
      }}
    >
      <div className="flex items-center gap-1 text-xs font-medium">
        <span aria-hidden>{icon}</span>
        <span className="truncate">{truncate(eventName, 20)}</span>
      </div>
      <div className="mt-0.5 text-[10px] opacity-90">
        {timeAgo ? formatDistanceToNow(timeAgo, { addSuffix: true }) : '—'}
      </div>
      {targetName && (
        <div className="mt-0.5 truncate text-[10px] opacity-80">{truncate(targetName, 24)}</div>
      )}
    </div>
  );
}

export const AuditNode = memo(AuditNodeComponent);
