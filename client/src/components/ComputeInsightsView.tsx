import { useMemo, useState } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import type { AuditEvent } from '../types';
import { extractRunRecords, formatDuration, percentile } from '../utils/runRecords';
import { exportToCsv } from '../utils/csvExport';
import { RunRecordsTable } from './RunRecordsTable';
import { DetailPanel } from './DetailPanel';
import { UnknownCountBadge } from './UnknownBadge';

interface ComputeInsightsViewProps {
  events: AuditEvent[];
}

export function ComputeInsightsView({ events }: ComputeInsightsViewProps) {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const records = useMemo(() => extractRunRecords(events), [events]);

  const durationStats = useMemo(() => {
    const durations = records
      .map((r) => r.durationSec)
      .filter((value): value is number => value != null && Number.isFinite(value) && value >= 0);
    const avg = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null;
    const p95 = percentile(durations, 95);
    return { avg, p95, coverage: records.length ? durations.length / records.length : 0 };
  }, [records]);

  const failureRate = useMemo(() => {
    const known = records.filter((r) => r.status !== 'Unknown');
    const failed = known.filter((r) => /fail|error/i.test(r.status));
    return {
      known: known.length,
      failed: failed.length,
      pct: known.length > 0 ? (failed.length / known.length) * 100 : null,
    };
  }, [records]);

  const tierBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of records) {
      const tier = row.computeTier !== 'Unknown' ? row.computeTier : row.hardwareTier;
      map.set(tier, (map.get(tier) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [records]);

  const tierOptions: Highcharts.Options = useMemo(
    () => ({
      chart: { type: 'bar', height: Math.max(280, tierBreakdown.length * 36), inverted: true },
      title: { text: undefined },
      xAxis: { categories: tierBreakdown.map(([tier]) => tier) },
      yAxis: { title: { text: 'Runs' }, min: 0 },
      series: [
        {
          type: 'bar',
          name: 'Runs',
          data: tierBreakdown.map(([, count]) => count),
          point: {
            events: {
              click: function () {
                setSelectedTier(String(this.category));
              },
            },
          },
        },
      ],
      credits: { enabled: false },
    }),
    [tierBreakdown]
  );

  const filteredRecords = useMemo(() => {
    if (!selectedTier) return records;
    return records.filter((row) => {
      const tier = row.computeTier !== 'Unknown' ? row.computeTier : row.hardwareTier;
      return tier === selectedTier;
    });
  }, [records, selectedTier]);

  const longestRuns = useMemo(
    () =>
      filteredRecords
        .filter((row) => row.durationSec != null)
        .sort((a, b) => (b.durationSec ?? 0) - (a.durationSec ?? 0))
        .slice(0, 20),
    [filteredRecords]
  );

  const mostFrequentCommands = useMemo(() => {
    const map = new Map<string, { count: number; topTier: string }>();
    for (const row of filteredRecords) {
      const key = row.command || 'Unknown';
      const tier = row.computeTier !== 'Unknown' ? row.computeTier : row.hardwareTier;
      const current = map.get(key);
      if (!current) map.set(key, { count: 1, topTier: tier });
      else current.count += 1;
    }
    return Array.from(map.entries())
      .map(([command, value]) => ({ command, ...value }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [filteredRecords]);

  return (
    <div className="h-full overflow-auto p-6" role="region" aria-label="Compute sizing insights">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-2 text-lg font-medium text-[#3F4547]">Compute sizing insights</h2>
        <p className="mb-6 text-sm text-[#7F8385]">
          Understand tier usage, runtime behavior, and actionable right-sizing opportunities.
        </p>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card label="Avg runtime" value={formatDuration(durationStats.avg)} />
          <Card label="P95 runtime" value={formatDuration(durationStats.p95)} />
          <Card label="Duration coverage" value={`${(durationStats.coverage * 100).toFixed(1)}%`} />
          <div className="rounded-lg border border-[#DBE4E8] bg-white p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-sm text-[#7F8385]">
              Failure rate
              {records.length - failureRate.known > 0 && (
                <UnknownCountBadge
                  field="status"
                  unknownCount={records.length - failureRate.known}
                  totalCount={records.length}
                />
              )}
            </p>
            <p className="mt-1 text-xl font-semibold text-[#3F4547]">
              {failureRate.pct == null ? 'N/A' : `${failureRate.pct.toFixed(1)}%`}
            </p>
            <p className="text-xs text-[#7F8385]">
              {failureRate.failed.toLocaleString()} failed / {failureRate.known.toLocaleString()} known
            </p>
          </div>
        </div>

        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-base font-medium text-[#3F4547]">Runs by compute tier/size</h3>
          {selectedTier && (
            <button
              type="button"
              onClick={() => setSelectedTier(null)}
              className="rounded border border-[#DBE4E8] bg-white px-2 py-1 text-xs text-[#3F4547]"
            >
              Clear tier filter ({selectedTier})
            </button>
          )}
        </div>
        <div className="mb-8 rounded-lg border border-[#DBE4E8] bg-white p-5 shadow-sm">
          <HighchartsReact highcharts={Highcharts} options={tierOptions} />
        </div>

        <section className="mb-8 rounded-lg border border-[#DBE4E8] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-medium text-[#3F4547]">Actionable: Longest runs</h3>
            <button
              type="button"
              onClick={() =>
                exportToCsv('longest-runs', longestRuns, [
                  { key: 'timestamp', header: 'Timestamp' },
                  { key: 'user', header: 'User' },
                  { key: 'project', header: 'Project' },
                  { key: 'command', header: 'Command' },
                  { key: 'durationSec', header: 'Duration (sec)' },
                  { key: 'computeTier', header: 'Compute tier' },
                  { key: 'hardwareTier', header: 'Hardware tier' },
                ])
              }
              className="rounded border border-[#DBE4E8] bg-white px-3 py-1.5 text-sm text-[#3F4547]"
            >
              Export CSV
            </button>
          </div>
          <RunRecordsTable rows={longestRuns} onSelectEvent={setSelectedEvent} emptyLabel="No runs with duration found." />
        </section>

        <section className="mb-8 rounded-lg border border-[#DBE4E8] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-medium text-[#3F4547]">Actionable: Most frequent runs/commands</h3>
            <button
              type="button"
              onClick={() =>
                exportToCsv('most-frequent-commands', mostFrequentCommands, [
                  { key: 'command', header: 'Command' },
                  { key: 'count', header: 'Run count' },
                  { key: 'topTier', header: 'Compute tier' },
                ])
              }
              className="rounded border border-[#DBE4E8] bg-white px-3 py-1.5 text-sm text-[#3F4547]"
            >
              Export CSV
            </button>
          </div>
          <div className="overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[#FAFAFA] text-left text-[#7F8385]">
                <tr className="border-b border-[#DBE4E8]">
                  <th className="px-3 py-2 font-medium">Command</th>
                  <th className="px-3 py-2 font-medium">Run count</th>
                  <th className="px-3 py-2 font-medium">Tier used</th>
                </tr>
              </thead>
              <tbody>
                {mostFrequentCommands.map((row) => (
                  <tr key={row.command} className="border-b border-[#DBE4E8] text-[#3F4547]">
                    <td className="max-w-[640px] truncate px-3 py-2" title={row.command}>
                      {row.command}
                    </td>
                    <td className="px-3 py-2">{row.count.toLocaleString()}</td>
                    <td className="px-3 py-2">{row.topTier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <DetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}

interface CardProps {
  label: string;
  value: string;
  subtitle?: string;
}

function Card({ label, value, subtitle }: CardProps) {
  return (
    <div className="rounded-lg border border-[#DBE4E8] bg-white p-4 shadow-sm">
      <p className="text-sm text-[#7F8385]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[#3F4547]">{value}</p>
      {subtitle ? <p className="text-xs text-[#7F8385]">{subtitle}</p> : null}
    </div>
  );
}
