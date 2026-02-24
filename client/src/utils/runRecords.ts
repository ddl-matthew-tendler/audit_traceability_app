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
  runFile: string;
  runOrigin: string;
  environmentName: string;
  computeTier: string;
  hardwareTier: string;
  durationSec: number | null;
  usageClass: UsageClass;
  sourceEvent: AuditEvent;
}

const EXECUTION_EVENT_PATTERN = /(run|job|workspace|app|execution)/i;
const EXECUTION_TARGET_TYPES = new Set(['run', 'job', 'workspace', 'app']);

export function extractRunRecords(events: AuditEvent[]): RunRecord[] {
  const out: RunRecord[] = [];
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (!isExecutionEvent(ev)) continue;

    const metadata = asRecord(ev.metadata);
    const eventRecord = asRecord(ev);
    const command = firstString(
      eventRecord['command'],
      metadata['runCommand'],
      metadata['command'],
      metadata['jobRunCommand'],
      metadata['commandToRun'],
      metadata['commandLine'],
      metadata['entrypoint']
    );
    const environmentName = firstString(
      eventRecord['environmentName'],
      metadata['environmentName'],
      metadata['environment'],
      metadata['environmentRevisionName'],
      metadata['environmentDisplayName']
    );
    const computeTier = firstString(
      eventRecord['computeTier'],
      metadata['computeTier'],
      metadata['computeSize'],
      metadata['tier'],
      metadata['machineSize']
    );
    const hardwareTier = firstString(
      eventRecord['hardwareTier'],
      metadata['hardwareTier'],
      metadata['hardwareTierName'],
      metadata['hardware']
    );
    const runId = firstString(
      eventRecord['runId'],
      metadata['runId'],
      metadata['executionId'],
      ev.targetId
    );
    const runFile = firstString(metadata['runFile'], metadata['filename']);
    const runOrigin = firstString(metadata['runOrigin'], metadata['source']);
    const status =
      firstString(eventRecord['status'], metadata['status'], metadata['runStatus']) ??
      inferStatusFromEvent(ev.event);
    const durationSec = firstNumber(
      eventRecord['durationSec'],
      metadata['runDurationSec'],
      metadata['runDurationSeconds'],
      metadata['runDurationInSeconds'],
      metadata['durationSec'],
      metadata['durationSeconds']
    );
    const user = firstString(ev.actorName, ev.actorId) ?? 'Unknown';
    const project = firstString(ev.withinProjectName, ev.withinProjectId) ?? 'Unknown';
    const usageClass = inferUsageClass(command ?? runFile, environmentName);
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
      runFile: runFile ?? 'Unknown',
      runOrigin: runOrigin ?? 'Unknown',
      environmentName: environmentName ?? 'Unknown',
      computeTier: computeTier ?? 'Unknown',
      hardwareTier: hardwareTier ?? 'Unknown',
      durationSec,
      usageClass,
      sourceEvent: ev,
    });
  }
  return out;
}

function isExecutionEvent(event: AuditEvent): boolean {
  const targetType = String(event.targetType ?? '').toLowerCase();
  if (EXECUTION_TARGET_TYPES.has(targetType)) return true;
  return EXECUTION_EVENT_PATTERN.test(event.event ?? '');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
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

function inferStatusFromEvent(eventName: string | undefined): string {
  const name = (eventName ?? '').toLowerCase();
  if (name.includes('fail') || name.includes('error')) return 'Failed';
  if (name.includes('stop')) return 'Stopped';
  if (name.includes('start') || name.includes('launch')) return 'Started';
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
