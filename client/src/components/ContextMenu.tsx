import { useEffect } from 'react';
import type { AuditEvent } from '../types';
import { buildEventDeepLink } from '../utils/dominoLinks';

interface ContextMenuProps {
  event: AuditEvent;
  x: number;
  y: number;
  onClose: () => void;
  onShowForTarget: (targetId: string) => void;
  onShowByUser: (actorId: string) => void;
}

export function ContextMenu({
  event,
  x,
  y,
  onClose,
  onShowForTarget,
  onShowByUser,
}: ContextMenuProps) {
  useEffect(() => {
    const handleClick = () => onClose();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [onClose]);

  const link = buildEventDeepLink(event);
  const targetId = event.targetId ?? event.withinProjectId;
  const actorId = event.actorId ?? event.actorName ?? '';

  return (
    <div
      className="fixed z-50 min-w-[180px] rounded border border-domino-border bg-domino-container py-1 shadow-lg"
      style={{ left: x, top: y }}
      role="menu"
    >
      {targetId && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onShowForTarget(targetId);
            onClose();
          }}
          className="w-full px-3 py-2 text-left text-sm text-domino-text hover:bg-domino-bg"
          role="menuitem"
        >
          Show all events for this target
        </button>
      )}
      {actorId && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onShowByUser(actorId);
            onClose();
          }}
          className="w-full px-3 py-2 text-left text-sm text-domino-text hover:bg-domino-bg"
          role="menuitem"
        >
          Show all events by this user
        </button>
      )}
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full px-3 py-2 text-left text-sm text-domino-primary hover:bg-domino-bg"
          role="menuitem"
        >
          Open in Domino
        </a>
      )}
    </div>
  );
}
