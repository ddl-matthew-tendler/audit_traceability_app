import { useMemo } from 'react';
import type { AuditEvent } from '../types';
import { extractRunRecords } from '../utils/runRecords';

interface DataCoverageViewProps {
  events: AuditEvent[];
}

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
        </p>

        <div className="overflow-auto rounded-lg border border-[#DBE4E8] bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[#FAFAFA] text-left text-[#7F8385]">
              <tr className="border-b border-[#DBE4E8]">
                <th className="px-3 py-2 font-medium">Field</th>
                <th className="px-3 py-2 font-medium">Present</th>
                <th className="px-3 py-2 font-medium">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.field} className="border-b border-[#DBE4E8] text-[#3F4547]">
                  <td className="px-3 py-2">{row.field}</td>
                  <td className="px-3 py-2">
                    {row.present.toLocaleString()} / {row.total.toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{row.pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
