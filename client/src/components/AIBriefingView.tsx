import { useMemo } from 'react';
import type { AuditEvent } from '../types';
import { ExecutiveBriefing } from './ExecutiveBriefing';
import { buildExecutiveInsights } from '../utils/executiveInsights';

interface AIBriefingViewProps {
  events: AuditEvent[];
  previousEvents: AuditEvent[];
}

export function AIBriefingView({ events, previousEvents }: AIBriefingViewProps) {
  const executiveInsights = useMemo(
    () => buildExecutiveInsights(events, previousEvents),
    [events, previousEvents]
  );

  return (
    <div className="h-full overflow-auto p-6" role="region" aria-label="AI Briefing">
      <div className="mx-auto max-w-4xl">
        <ExecutiveBriefing report={executiveInsights} />
      </div>
    </div>
  );
}
