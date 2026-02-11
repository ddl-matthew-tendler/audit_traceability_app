import { useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import type { AuditEvent } from '../types';
import { buildEventDeepLink } from '../utils/dominoLinks';

interface DetailPanelProps {
  event: AuditEvent | null;
  onClose: () => void;
}

export function DetailPanel({ event, onClose }: DetailPanelProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  if (!event) return null;

  const link = buildEventDeepLink(event);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-auto border-l border-domino-border bg-domino-container shadow-xl"
        role="dialog"
        aria-label="Event details"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-domino-border bg-domino-bg px-4 py-3">
          <h2 className="text-lg font-semibold text-domino-text">Event details</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="rounded p-1 text-domino-text-body hover:bg-domino-border hover:text-domino-text"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-4 p-4">
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-domino-text-body">Event</h3>
            <p className="mt-1 text-domino-text">{event.event ?? '—'}</p>
          </section>
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-domino-text-body">Timestamp</h3>
            <p className="mt-1 text-domino-text">
              {event.timestamp
                ? format(new Date(event.timestamp), 'PPpp zzz')
                : '—'}
            </p>
          </section>
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-domino-text-body">Actor</h3>
            <p className="mt-1 text-domino-text">
              {event.actorName ?? event.actorId ?? '—'}
            </p>
            {event.actorId && (
              <p className="text-sm text-domino-text-body">ID: {event.actorId}</p>
            )}
          </section>
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-domino-text-body">Target</h3>
            <p className="mt-1 text-domino-text">{event.targetName ?? event.targetId ?? '—'}</p>
            {event.targetType && (
              <p className="text-sm text-domino-text-body">Type: {event.targetType}</p>
            )}
            {event.targetId && (
              <p className="text-sm text-domino-text-body">ID: {event.targetId}</p>
            )}
          </section>
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-domino-text-body">Project</h3>
            <p className="mt-1 text-domino-text">
              {event.withinProjectName ?? event.withinProjectId ?? '—'}
            </p>
          </section>
          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <section>
              <details className="group">
                <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-domino-text-body">
                  Metadata (JSON)
                </summary>
                <pre className="mt-2 overflow-auto rounded border border-domino-border bg-domino-bg p-2 text-xs text-domino-text">
                  {JSON.stringify(event.metadata, null, 2)}
                </pre>
              </details>
            </section>
          )}
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded border border-domino-primary bg-domino-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              View in Domino
            </a>
          )}
        </div>
      </aside>
    </>
  );
}
