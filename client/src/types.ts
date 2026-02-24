/** Audit event from Domino API (fields may vary by version) */
export interface AuditEvent {
  id?: string;
  event: string;
  timestamp: number; // ms
  actorId?: string;
  actorName?: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  withinProjectId?: string;
  withinProjectName?: string;
  metadata?: Record<string, unknown>;
  command?: string;
  status?: string;
  durationSec?: number;
  computeTier?: string;
  hardwareTier?: string;
  environmentName?: string;
  runId?: string;
  runFile?: string;
  runOrigin?: string;
  raw?: Record<string, unknown>;
  [key: string]: unknown;
}

export type EventCategory =
  | 'project'
  | 'data'
  | 'execution'
  | 'file'
  | 'governance'
  | 'environment'
  | 'user'
  | 'default';

export const NODE_COLORS: Record<EventCategory, string> = {
  project: '#3B82F6',
  data: '#10B981',
  execution: '#F97316',
  file: '#8B5CF6',
  governance: '#EF4444',
  environment: '#14B8A6',
  user: '#6B7280',
  default: '#6B7280',
};

export type ViewMode =
  | 'overview'
  | 'jobRuns'
  | 'adoptionBreakdown'
  | 'computeInsights'
  | 'dataCoverage'
  | 'usageOverTime'
  | 'stackedEventsByProject'
  | 'uniqueUsersByProject'
  | 'activityByProject'
  | 'eventTypes';

export interface TimeRangePreset {
  label: string;
  start: Date;
  end: Date;
}
