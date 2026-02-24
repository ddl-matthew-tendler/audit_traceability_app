import { useState, useCallback, useRef, useEffect } from 'react';
import type { RunRecord } from '../utils/runRecords';

interface UnknownBadgeProps {
  field: string;
  record?: RunRecord;
  /** Short reason override (used when no record context is available) */
  reason?: string;
}

const FIELD_EXPLANATIONS: Record<string, { checked: string; tip: string }> = {
  command: {
    checked: 'Run Command, runCommand, command, jobRunCommand, commandToRun, commandLine, entrypoint',
    tip: 'The audit event did not include a command field. This often happens for workspace sessions or events where the command is set after launch.',
  },
  status: {
    checked: 'Execution Status, status, runStatus, executionStatus, currentStatus',
    tip: 'No execution status was found in the event or enrichment data. The event may represent an action that does not have a terminal status yet.',
  },
  environmentName: {
    checked: 'Environment, environmentName, environmentRevisionName, affecting[].environment',
    tip: 'The environment name was not included in the audit event or enrichment APIs. Some older events or non-execution events omit this.',
  },
  computeTier: {
    checked: 'Compute Tier, computeTier, computeSize, tier, machineSize',
    tip: 'No compute tier information was available. This is often missing for workspace events or when the hardware tier is configured at the project level.',
  },
  hardwareTier: {
    checked: 'Hardware Tier, hardwareTierName, hardwareTier, affecting[].hardwareTier',
    tip: 'Hardware tier was not resolved from the event, enrichment APIs, or the Control Center bulk data.',
  },
  runId: {
    checked: 'Run, runId, executionId, targets[].entity.id',
    tip: 'No run or job ID was found. The event may be a project-level or user-level action rather than an execution.',
  },
  runType: {
    checked: 'Run Type, runType, executionType, workloadType',
    tip: 'The run type (Job, Workspace, App, etc.) could not be determined from the event name or metadata.',
  },
  runFile: {
    checked: 'Run File, runFile, filename',
    tip: 'No run file was specified. Workspace sessions and some scheduled jobs may not have an explicit file.',
  },
  runOrigin: {
    checked: 'Run Origin, runOrigin, source',
    tip: 'The origin of the run (API, Web UI, Scheduler) was not recorded in this event.',
  },
  user: {
    checked: 'actorName, startedBy.username, actorId',
    tip: 'The user who triggered this event could not be identified. System-generated events may not have an actor.',
  },
  project: {
    checked: 'withinProjectName, withinProjectId, in.name',
    tip: 'No project context was found. Some platform-level events are not scoped to a specific project.',
  },
  usageClass: {
    checked: 'Inferred from command, environment name, and target name patterns',
    tip: 'Usage class (SAS / SLC) is inferred by matching patterns in the command, environment, and target name. "Unknown" means none of the known SAS or SLC patterns were detected.',
  },
  duration: {
    checked: 'runDurationSec, stageTime (completedTime - runStartTime), event timestamp range',
    tip: 'No duration data was available. The run may still be in progress, or timing data was not captured.',
  },
};

function getAvailableFields(record: RunRecord): string[] {
  const available: string[] = [];
  if (record.eventName && record.eventName !== 'Unknown') available.push(`Event: ${record.eventName}`);
  if (record.user && record.user !== 'Unknown') available.push(`User: ${record.user}`);
  if (record.project && record.project !== 'Unknown') available.push(`Project: ${record.project}`);
  if (record.command && record.command !== 'Unknown') available.push(`Command: ${truncate(record.command, 60)}`);
  if (record.status && record.status !== 'Unknown') available.push(`Status: ${record.status}`);
  if (record.runId && record.runId !== 'Unknown') available.push(`Run ID: ${truncate(record.runId, 30)}`);
  if (record.environmentName && record.environmentName !== 'Unknown') available.push(`Environment: ${record.environmentName}`);
  if (record.hardwareTier && record.hardwareTier !== 'Unknown') available.push(`Hardware: ${record.hardwareTier}`);
  if (record.durationSec != null) available.push(`Duration: ${record.durationSec.toFixed(0)}s`);
  return available;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}

export function UnknownBadge({ field, record, reason }: UnknownBadgeProps) {
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => setVisible(true), []);
  const hide = useCallback(() => setVisible(false), []);

  const explanation = FIELD_EXPLANATIONS[field];
  const availableFields = record ? getAvailableFields(record) : [];

  useEffect(() => {
    if (!visible || !tooltipRef.current || !wrapperRef.current) return;
    const tip = tooltipRef.current;
    const rect = tip.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      tip.style.left = 'auto';
      tip.style.right = '0';
      tip.style.transform = 'none';
    }
    if (rect.left < 8) {
      tip.style.left = '0';
      tip.style.right = 'auto';
      tip.style.transform = 'none';
    }
  }, [visible]);

  return (
    <span
      ref={wrapperRef}
      className="group relative inline-flex cursor-help items-center gap-1"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <span className="border-b border-dashed border-[#C0C0C0] text-[#9B9BAF]">Unknown</span>
      <svg className="h-3.5 w-3.5 shrink-0 text-[#B0B0C0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {visible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-[9999] mb-2 w-72 -translate-x-1/2 rounded-lg border border-[#E0E0E0] bg-white p-3 shadow-xl"
        >
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#7F8385]">
            Why is this unknown?
          </p>
          <p className="mb-2 text-xs leading-relaxed text-[#3F4547]">
            {reason ?? explanation?.tip ?? 'This field was not present in the audit event data.'}
          </p>
          {explanation && (
            <div className="mb-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[#9B9BAF]">Fields checked</p>
              <p className="mt-0.5 text-[11px] leading-snug text-[#7F8385]">{explanation.checked}</p>
            </div>
          )}
          {availableFields.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-[#9B9BAF]">Data that IS available</p>
              <ul className="mt-0.5 space-y-0.5">
                {availableFields.map((f) => (
                  <li key={f} className="text-[11px] leading-snug text-[#3F4547]">{f}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-[#E0E0E0] bg-white" />
        </div>
      )}
    </span>
  );
}

interface UnknownCountBadgeProps {
  field: string;
  unknownCount: number;
  totalCount: number;
}

/** Inline badge for aggregate unknown counts (used in charts/cards) */
export function UnknownCountBadge({ field, unknownCount, totalCount }: UnknownCountBadgeProps) {
  const [visible, setVisible] = useState(false);
  const show = useCallback(() => setVisible(true), []);
  const hide = useCallback(() => setVisible(false), []);

  const explanation = FIELD_EXPLANATIONS[field];
  const pct = totalCount > 0 ? ((unknownCount / totalCount) * 100).toFixed(1) : '0';

  return (
    <span
      className="relative inline-flex cursor-help items-center gap-1"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <svg className="h-3.5 w-3.5 shrink-0 text-[#B0B0C0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {visible && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 z-[9999] mb-2 w-64 -translate-x-1/2 rounded-lg border border-[#E0E0E0] bg-white p-3 shadow-xl"
        >
          <p className="mb-1.5 text-xs font-semibold text-[#3F4547]">
            {unknownCount.toLocaleString()} of {totalCount.toLocaleString()} records ({pct}%) are unclassified
          </p>
          <p className="mb-2 text-xs leading-relaxed text-[#7F8385]">
            {explanation?.tip ?? 'These records could not be classified from the available audit data.'}
          </p>
          {explanation && (
            <p className="text-[10px] leading-snug text-[#9B9BAF]">
              Checked: {explanation.checked}
            </p>
          )}
          <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-[#E0E0E0] bg-white" />
        </div>
      )}
    </span>
  );
}
