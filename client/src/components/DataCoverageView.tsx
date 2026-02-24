import { useMemo } from 'react';
import type { AuditEvent } from '../types';
import { extractRunRecords } from '../utils/runRecords';
import { UnknownCountBadge } from './UnknownBadge';
import { UsageClassInfo } from './UsageClassInfo';

interface DataCoverageViewProps {
  events: AuditEvent[];
}

const FIELD_KEYS: Record<string, string> = {
  Command: 'command',
  'Run ID': 'runId',
  Duration: 'duration',
  Status: 'status',
  'Compute tier': 'computeTier',
  'Hardware tier': 'hardwareTier',
  Environment: 'environmentName',
  'Run type': 'runType',
  'Usage class': 'usageClass',
};

export function DataCoverageView({ events }: DataCoverageViewProps) {
  const records = useMemo(() => extractRunRecords(events), [events]);

  const rows = useMemo(() => {
    const total = records.length;
    const metrics = [
      { field: 'Command', present: records.filter((r) => r.command !== 'Unknown').length },
      { field: 'Run ID', present: records.filter((r) => r.runId !== 'Unknown').length },
      { field: 'Duration', present: records.filter((r) => r.durationSec != null).length },
      { field: 'Status', present: records.filter((r) => r.status !== 'Unknown').length },
      { field: 'Compute tier', present: records.filter((r) => r.computeTier !== 'Unknown').length },
      { field: 'Hardware tier', present: records.filter((r) => r.hardwareTier !== 'Unknown').length },
      { field: 'Environment', present: records.filter((r) => r.environmentName !== 'Unknown').length },
      { field: 'Run type', present: records.filter((r) => r.runType !== 'Unknown').length },
      { field: 'Usage class', present: records.filter((r) => r.usageClass !== 'Unknown').length },
    ];

    return metrics.map((metric) => {
      const pct = total > 0 ? (metric.present / total) * 100 : 0;
      return {
        ...metric,
        total,
        pct,
      };
    });
  }, [records]);

  return (
    <div className="h-full overflow-auto p-6" role="region" aria-label="Data coverage">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-2 text-lg font-medium text-[#3F4547]">Data coverage</h2>
        <p className="mb-6 text-sm text-[#7F8385]">
          Completeness of key fields used by job, adoption, and compute insights for the selected time range.
          Hover the info icon on low-coverage fields to understand why data is missing.
        </p>

        <div className="overflow-auto rounded-lg border border-[#DBE4E8] bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[#FAFAFA] text-left text-[#7F8385]">
              <tr className="border-b border-[#DBE4E8]">
                <th className="px-3 py-2 font-medium">Field</th>
                <th className="px-3 py-2 font-medium">Present</th>
                <th className="px-3 py-2 font-medium">Coverage</th>
                <th className="px-3 py-2 font-medium w-16"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const unknownCount = row.total - row.present;
                return (
                  <tr key={row.field} className="border-b border-[#DBE4E8] text-[#3F4547]">
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        {row.field}
                        {row.field === 'Usage class' && <UsageClassInfo compact />}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {row.present.toLocaleString()} / {row.total.toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-[#E8E8EE]">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${row.pct}%`,
                              backgroundColor: row.pct >= 80 ? '#28A464' : row.pct >= 50 ? '#CCB718' : '#C20A29',
                            }}
                          />
                        </div>
                        <span>{row.pct.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {unknownCount > 0 && (
                        <UnknownCountBadge
                          field={FIELD_KEYS[row.field] ?? row.field}
                          unknownCount={unknownCount}
                          totalCount={row.total}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
