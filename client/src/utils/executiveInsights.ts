import type { AuditEvent } from '../types';
import { extractRunRecords, percentile } from './runRecords';
import type { ViewMode } from '../store/useAppStore';

export interface ExecutiveRecommendation {
  title: string;
  body: string;
  targetView: ViewMode;
}

export interface ExecutiveInsightReport {
  headline: string;
  summary: string;
  findings: string[];
  recommendations: ExecutiveRecommendation[];
}

function uniqueCount(values: Array<string | undefined>): number {
  return new Set(values.filter((value): value is string => Boolean(value && value.trim()))).size;
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

function formatDelta(delta: number | null, fallbackWhenPositive = 'new activity vs prior period'): string {
  if (delta == null) return fallbackWhenPositive;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}% vs prior period`;
}

function classifyFailure(status: string): boolean {
  return /fail|error|fault/i.test(status);
}

function averageCoverage(events: ReturnType<typeof extractRunRecords>): number | null {
  if (events.length === 0) return null;
  const fields = [
    (row: ReturnType<typeof extractRunRecords>[number]) => row.command !== 'Unknown',
    (row: ReturnType<typeof extractRunRecords>[number]) => row.status !== 'Unknown',
    (row: ReturnType<typeof extractRunRecords>[number]) => row.durationSec != null,
    (row: ReturnType<typeof extractRunRecords>[number]) => row.environmentName !== 'Unknown',
    (row: ReturnType<typeof extractRunRecords>[number]) => row.computeTier !== 'Unknown',
    (row: ReturnType<typeof extractRunRecords>[number]) => row.usageClass !== 'Unknown',
  ];
  const present = fields.reduce(
    (sum, hasField) => sum + events.filter((row) => hasField(row)).length / events.length,
    0
  );
  return (present / fields.length) * 100;
}

function summarizeTopProject(events: ReturnType<typeof extractRunRecords>): string | null {
  const counts = new Map<string, number>();
  for (const row of events) {
    counts.set(row.project, (counts.get(row.project) ?? 0) + 1);
  }
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
  if (!top || top[0] === 'Unknown') return null;
  return `${top[0]} leads run activity with ${top[1].toLocaleString()} executions`;
}

export function buildExecutiveInsights(
  events: AuditEvent[],
  previousEvents: AuditEvent[]
): ExecutiveInsightReport {
  const currentRuns = extractRunRecords(events);
  const previousRuns = extractRunRecords(previousEvents);

  const totalEvents = events.length;
  const previousTotalEvents = previousEvents.length;
  const activeUsers = uniqueCount(events.map((event) => event.actorName ?? event.actorId));
  const previousActiveUsers = uniqueCount(previousEvents.map((event) => event.actorName ?? event.actorId));
  const activeProjects = uniqueCount(events.map((event) => event.withinProjectName ?? event.withinProjectId));

  const currentKnownRuns = currentRuns.filter((row) => row.status !== 'Unknown');
  const previousKnownRuns = previousRuns.filter((row) => row.status !== 'Unknown');
  const currentFailures = currentKnownRuns.filter((row) => classifyFailure(row.status)).length;
  const previousFailures = previousKnownRuns.filter((row) => classifyFailure(row.status)).length;
  const currentFailureRate = currentKnownRuns.length ? (currentFailures / currentKnownRuns.length) * 100 : null;
  const previousFailureRate = previousKnownRuns.length ? (previousFailures / previousKnownRuns.length) * 100 : null;

  const currentClassifiedRuns = currentRuns.filter((row) => row.usageClass !== 'Unknown');
  const previousClassifiedRuns = previousRuns.filter((row) => row.usageClass !== 'Unknown');
  const currentSlcShare = currentClassifiedRuns.length
    ? (currentClassifiedRuns.filter((row) => row.usageClass === 'SLC').length / currentClassifiedRuns.length) * 100
    : null;
  const previousSlcShare = previousClassifiedRuns.length
    ? (previousClassifiedRuns.filter((row) => row.usageClass === 'SLC').length / previousClassifiedRuns.length) * 100
    : null;

  const currentDurations = currentRuns
    .map((row) => row.durationSec)
    .filter((value): value is number => value != null && Number.isFinite(value) && value >= 0);
  const p95Duration = percentile(currentDurations, 95);
  const coverage = averageCoverage(currentRuns);
  const topProject = summarizeTopProject(currentRuns);

  const eventDelta = percentChange(totalEvents, previousTotalEvents);
  const userDelta = percentChange(activeUsers, previousActiveUsers);
  const slcDelta = currentSlcShare != null && previousSlcShare != null ? currentSlcShare - previousSlcShare : null;
  const failureDelta = currentFailureRate != null && previousFailureRate != null ? currentFailureRate - previousFailureRate : null;

  const headline =
    eventDelta != null && eventDelta >= 0
      ? `Platform activity is expanding: ${totalEvents.toLocaleString()} events across ${activeUsers.toLocaleString()} active users and ${activeProjects.toLocaleString()} projects.`
      : `Platform activity softened to ${totalEvents.toLocaleString()} events, but ${activeUsers.toLocaleString()} users remain active across ${activeProjects.toLocaleString()} projects.`;

  const summaryParts = [
    `${formatDelta(eventDelta)} in total activity`,
    `${formatDelta(userDelta, 'new user activity detected')} in active-user participation`,
  ];
  if (currentSlcShare != null) {
    summaryParts.push(
      `SLC accounts for ${currentSlcShare.toFixed(1)}% of classified runs${
        slcDelta == null ? '' : ` (${slcDelta >= 0 ? '+' : ''}${slcDelta.toFixed(1)} pts vs prior period)`
      }`
    );
  }
  if (currentFailureRate != null) {
    summaryParts.push(`execution failure rate is ${currentFailureRate.toFixed(1)}%`);
  }
  if (coverage != null) {
    summaryParts.push(`${coverage.toFixed(1)}% average metadata coverage`);
  }

  const findings = [
    `${summaryParts[0]}; ${summaryParts[1]}.`,
    currentSlcShare == null
      ? 'Usage classification is still sparse, which limits adoption storytelling.'
      : `Adoption mix shows ${currentSlcShare >= 50 ? 'SLC-led' : 'SAS-led'} behavior with ${currentClassifiedRuns.length.toLocaleString()} classified executions.`,
    currentFailureRate == null
      ? 'Run status coverage is too limited to quantify execution reliability yet.'
      : `Run health is ${currentFailureRate >= 10 ? 'a watch item' : 'stable'} at ${currentFailureRate.toFixed(1)}% failed known-status runs${
          failureDelta == null ? '' : ` (${failureDelta >= 0 ? '+' : ''}${failureDelta.toFixed(1)} pts vs prior period)`
        }.`,
    coverage == null
      ? 'No execution records were found in the selected time range.'
      : `Operational traceability is ${coverage >= 80 ? 'strong' : coverage >= 65 ? 'usable but uneven' : 'thin'} with ${coverage.toFixed(1)}% field coverage across command, status, runtime, environment, compute, and usage-class signals.`,
    topProject ? `${topProject}.` : 'No clear project concentration signal emerged from the current period.',
    p95Duration == null
      ? 'Runtime duration coverage is limited, so performance bottlenecks are harder to prove.'
      : `P95 runtime is ${(p95Duration / 60).toFixed(1)} minutes, which is the right lens for identifying slow-tail compute usage.`,
  ];

  const recommendations: ExecutiveRecommendation[] = [];

  if (currentSlcShare == null || currentSlcShare < 50) {
    recommendations.push({
      title: 'Push SLC migration story',
      body: 'Open the adoption view to identify teams still behaving like SAS-heavy users and target enablement around them.',
      targetView: 'adoptionBreakdown',
    });
  }

  if (currentFailureRate != null && currentFailureRate >= 8) {
    recommendations.push({
      title: 'Investigate failure concentration',
      body: 'Review recent run records and isolate which users, projects, or commands are driving the failure rate upward.',
      targetView: 'jobRuns',
    });
  }

  if (coverage != null && coverage < 75) {
    recommendations.push({
      title: 'Improve traceability completeness',
      body: 'Use the coverage view to show which fields are missing most often and where instrumentation needs to be tightened.',
      targetView: 'dataCoverage',
    });
  }

  if (p95Duration != null && p95Duration >= 30 * 60) {
    recommendations.push({
      title: 'Right-size slow-tail compute',
      body: 'Open compute insights to inspect long-running jobs and over-provisioned tiers before positioning a cost optimization story.',
      targetView: 'computeInsights',
    });
  }

  if (recommendations.length < 3) {
    recommendations.push({
      title: 'Show project concentration',
      body: 'Use the project activity view to demonstrate where Domino has traction today and which teams should be expanded next.',
      targetView: 'activityByProject',
    });
  }

  return {
    headline,
    summary: summaryParts.join(' • '),
    findings: findings.slice(0, 4),
    recommendations: recommendations.slice(0, 3),
  };
}
