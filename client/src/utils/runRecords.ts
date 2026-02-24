import type { AuditEvent } from '../types';
import { inferUsageClass, type UsageClass } from './usageClassification';

export interface RunRecord {
  id: string;
  timestamp: number;
  eventName: string;
  user: string;
  project: string;
  status: string;
  command: string;
  runId: string;
  runType: string;
  runFile: string;
  runOrigin: string;
  environmentName: string;
  computeTier: string;
  hardwareTier: string;
  durationSec: number | null;
  usageClass: UsageClass;
  sourceEvent: AuditEvent;
}

const EXECUTION_EVENT_PATTERN = /\b(run|job|workspace)\b/i;
const EXECUTION_TARGET_TYPES = new Set(['run', 'job', 'workspace']);

export function extractRunRecords(events: AuditEvent[]): RunRecord[] {
  const out: RunRecord[] = [];
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (!isExecutionEvent(ev)) continue;

    const metadata = asRecord(ev.metadata);
    const eventRecord = asRecord(ev);
    const rawData = asRecord(ev.raw);

    // affecting[] contains related entities (environment, hardwareTier) in the raw audit event.
    const affecting = Array.isArray(rawData['affecting']) ? rawData['affecting'] as Record<string, unknown>[] : [];
    let affectingEnvName: string | undefined;
    let affectingHwName: string | undefined;
    for (const aff of affecting) {
      if (!aff || typeof aff !== 'object') continue;
      const etype = String(aff['entityType'] ?? '').toLowerCase();
      if (etype === 'environment' && !affectingEnvName) affectingEnvName = typeof aff['name'] === 'string' ? aff['name'] : undefined;
      if (etype === 'hardwaretier' && !affectingHwName) affectingHwName = typeof aff['name'] === 'string' ? aff['name'] : undefined;
    }

    // domaudit-style nested objects from /v4/jobs response shape
    const metaStatuses = asRecord(metadata['statuses']);
    const metaStageTime = asRecord(metadata['stageTime']);
    const metaEnvironment = asRecord(metadata['environment']);
    const metaStartedBy = asRecord(metadata['startedBy']);
    const metaHardwareTier = asRecord(metadata['hardwareTier']);

    // Case-insensitive metadata lookup: Domino's Audit Trail "Custom Attributes" use
    // title-case keys with spaces ("Run Command", "Hardware Tier", "Environment", "Run").
    const ci = buildCiLookup(metadata);

    const command = firstString(
      eventRecord['command'],
      metadata['Run Command'],
      metadata['runCommand'],
      metadata['command'],
      metadata['jobRunCommand'],
      metadata['commandToRun'],
      metadata['commandLine'],
      metadata['entrypoint'],
      metadata['commandString'],
      ci('runcommand'),
      ci('command')
    );
    const environmentName = firstString(
      eventRecord['environmentName'],
      affectingEnvName,
      metadata['Environment'],
      metadata['environmentName'],
      deepString(metaEnvironment, 'environmentName'),
      typeof metadata['environment'] === 'string' ? metadata['environment'] : undefined,
      metadata['environmentRevisionName'],
      metadata['environmentDisplayName'],
      ci('environment'),
      ci('environmentname')
    );
    const computeTier = firstString(
      eventRecord['computeTier'],
      metadata['Compute Tier'],
      metadata['computeTier'],
      metadata['computeSize'],
      metadata['tier'],
      metadata['machineSize'],
      ci('computetier')
    );
    const hardwareTier = firstString(
      eventRecord['hardwareTier'],
      affectingHwName,
      metadata['Hardware Tier'],
      metadata['hardwareTierName'],
      deepString(metaHardwareTier, 'name'),
      deepString(metaHardwareTier, 'hardwareTierName'),
      typeof metadata['hardwareTier'] === 'string' ? metadata['hardwareTier'] : undefined,
      metadata['hardware'],
      ci('hardwaretier')
    );
    const runId = firstString(
      eventRecord['runId'],
      metadata['Run'],
      metadata['runId'],
      metadata['executionId'],
      ev.targetType?.toLowerCase() === 'run' || ev.targetType?.toLowerCase() === 'job' ? ev.targetId : undefined,
      ev.targetId,
      ci('run'),
      ci('runid')
    );
    const runFile = firstString(
      metadata['Run File'],
      metadata['runFile'],
      metadata['filename'],
      ci('runfile')
    );
    const runOrigin = firstString(
      metadata['Run Origin'],
      metadata['runOrigin'],
      metadata['source'],
      metadata['origin'],
      ci('runorigin')
    );
    const status =
      firstString(
        eventRecord['status'],
        metadata['Execution Status'],
        metadata['status'],
        metadata['runStatus'],
        metadata['executionStatus'],
        deepString(metaStatuses, 'executionStatus'),
        metadata['currentStatus'],
        ci('executionstatus'),
        ci('status')
      ) ?? inferStatusFromEvent(ev.event);

    // Duration: explicit fields first, then calculate from stageTime timestamps
    let durationSec = firstNumber(
      eventRecord['durationSec'],
      metadata['runDurationSec'],
      metadata['runDurationSeconds'],
      metadata['runDurationInSeconds'],
      metadata['durationSec'],
      metadata['durationSeconds']
    );
    if (durationSec == null) {
      const completedMs = firstNumber(metaStageTime['completedTime']);
      const startMs = firstNumber(metaStageTime['runStartTime']);
      if (completedMs != null && startMs != null && completedMs > startMs) {
        durationSec = (completedMs - startMs) / 1000;
      }
    }
    const runType = firstString(
      eventRecord['runType'],
      metadata['Run Type'],
      metadata['runType'],
      metadata['executionType'],
      metadata['workloadType'],
      ci('runtype')
    );
    const user = firstString(ev.actorName, deepString(metaStartedBy, 'username'), ev.actorId) ?? 'Unknown';
    const project = firstString(ev.withinProjectName, ev.withinProjectId) ?? 'Unknown';
    const targetName = firstString(ev.targetName);
    const usageClass = inferUsageClass(command ?? runFile, environmentName, targetName);
    const ts = typeof ev.timestamp === 'number' ? ev.timestamp : 0;

    out.push({
      id: ev.id ?? `${runId ?? 'run'}-${ts}-${i}`,
      timestamp: ts,
      eventName: ev.event || 'Unknown',
      user,
      project,
      status: status ?? 'Unknown',
      command: command ?? 'Unknown',
      runId: runId ?? 'Unknown',
      runType: runType ?? 'Unknown',
      runFile: runFile ?? 'Unknown',
      runOrigin: runOrigin ?? 'Unknown',
      environmentName: environmentName ?? 'Unknown',
      computeTier: computeTier ?? hardwareTier ?? 'Unknown',
      hardwareTier: hardwareTier ?? 'Unknown',
      durationSec,
      usageClass,
      sourceEvent: ev,
    });
  }
  return deduplicateByRunId(out);
}

function deduplicateByRunId(records: RunRecord[]): RunRecord[] {
  const groups = new Map<string, RunRecord[]>();
  const noId: RunRecord[] = [];

  for (const rec of records) {
    if (rec.runId === 'Unknown') {
      noId.push(rec);
    } else {
      const group = groups.get(rec.runId);
      if (group) group.push(rec);
      else groups.set(rec.runId, [rec]);
    }
  }

  const out: RunRecord[] = [];
  for (const [, group] of groups) {
    out.push(group.length === 1 ? group[0] : mergeRunRecords(group));
  }
  out.push(...noId);
  out.sort((a, b) => b.timestamp - a.timestamp);
  return out;
}

function mergeRunRecords(records: RunRecord[]): RunRecord {
  const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp);
  const base = { ...sorted[0] };

  for (const rec of sorted) {
    if (base.command === 'Unknown' && rec.command !== 'Unknown') base.command = rec.command;
    if (base.status === 'Unknown' && rec.status !== 'Unknown') base.status = rec.status;
    if (base.runType === 'Unknown' && rec.runType !== 'Unknown') base.runType = rec.runType;
    if (base.runFile === 'Unknown' && rec.runFile !== 'Unknown') base.runFile = rec.runFile;
    if (base.runOrigin === 'Unknown' && rec.runOrigin !== 'Unknown') base.runOrigin = rec.runOrigin;
    if (base.environmentName === 'Unknown' && rec.environmentName !== 'Unknown') base.environmentName = rec.environmentName;
    if (base.computeTier === 'Unknown' && rec.computeTier !== 'Unknown') base.computeTier = rec.computeTier;
    if (base.hardwareTier === 'Unknown' && rec.hardwareTier !== 'Unknown') base.hardwareTier = rec.hardwareTier;
    if (base.durationSec == null && rec.durationSec != null) base.durationSec = rec.durationSec;
    if (base.user === 'Unknown' && rec.user !== 'Unknown') base.user = rec.user;
    if (base.project === 'Unknown' && rec.project !== 'Unknown') base.project = rec.project;
    if (base.usageClass === 'Unknown' && rec.usageClass !== 'Unknown') base.usageClass = rec.usageClass;
  }

  // Derive duration from start/stop timestamps if still missing
  if (base.durationSec == null && sorted.length >= 2) {
    const first = sorted[0].timestamp;
    const last = sorted[sorted.length - 1].timestamp;
    if (first > 0 && last > 0 && last > first) {
      base.durationSec = (last - first) / 1000;
    }
  }

  // Pick the latest non-Unknown status (Stop/Complete overrides Started)
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].status !== 'Unknown' && sorted[i].status !== 'Started') {
      base.status = sorted[i].status;
      break;
    }
  }

  return base;
}

function isExecutionEvent(event: AuditEvent): boolean {
  const targetType = String(event.targetType ?? '').toLowerCase();
  if (EXECUTION_TARGET_TYPES.has(targetType)) return true;
  return EXECUTION_EVENT_PATTERN.test(event.event ?? '');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/** Safely read a string property from a nested object (domaudit-style deep field access). */
function deepString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/**
 * Build a case-insensitive lookup for metadata keys.
 * Domino Audit Trail "Custom Attributes" use title-case keys with spaces
 * (e.g. "Run Command", "Hardware Tier"), while code may use camelCase or snake_case.
 */
function buildCiLookup(meta: Record<string, unknown>): (normalizedKey: string) => string | undefined {
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(meta)) {
    if (typeof k === 'string' && typeof v === 'string' && v.trim()) {
      map.set(k.toLowerCase().replace(/[\s_-]/g, ''), v.trim());
    }
  }
  return (normalizedKey: string) => map.get(normalizedKey.toLowerCase().replace(/[\s_-]/g, ''));
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

/** Map audit event names to run status using SWAG/API patterns (e.g. RunMonolithDTO status enum, execution lifecycle). */
function inferStatusFromEvent(eventName: string | undefined): string {
  const name = (eventName ?? '').toLowerCase();
  if (name.includes('fail') || name.includes('error') || name.includes('fault')) return 'Failed';
  if (name.includes('stop') || name.includes('discard')) return 'Stopped';
  if (name.includes('succeed') || name.includes('complete') || name.includes('finish') || name.includes('publish')) return 'Succeeded';
  if (name.includes('start') || name.includes('launch') || name.includes('run')) return 'Started';
  if (name.includes('queue') || name.includes('schedule')) return 'Queued';
  if (name.includes('pull') || name.includes('build') || name.includes('prepar') || name.includes('mount') || name.includes('synchronize')) return 'Running';
  return 'Unknown';
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

export function formatDuration(durationSec: number | null): string {
  if (durationSec == null || !Number.isFinite(durationSec)) return 'Unknown';
  if (durationSec < 60) return `${Math.round(durationSec)}s`;
  const minutes = durationSec / 60;
  if (minutes < 60) return `${minutes.toFixed(1)}m`;
  const hours = minutes / 60;
  return `${hours.toFixed(1)}h`;
}
