import { format } from 'date-fns';
import type { AuditEvent } from '../types';
import type { RunRecord } from '../utils/runRecords';
import { formatDuration } from '../utils/runRecords';
import { UnknownBadge } from './UnknownBadge';
import { UsageClassInfo } from './UsageClassInfo';

interface RunRecordsTableProps {
  rows: RunRecord[];
  onSelectEvent: (event: AuditEvent) => void;
  emptyLabel?: string;
}

function CellValue({ value, field, record }: { value: string; field: string; record: RunRecord }) {
  if (value === 'Unknown') return <UnknownBadge field={field} record={record} />;
  return <>{value}</>;
}

export function RunRecordsTable({
  rows,
  onSelectEvent,
  emptyLabel = 'No rows for the current filters.',
}: RunRecordsTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-[#7F8385]">{emptyLabel}</p>;
  }

  return (
    <div className="overflow-auto rounded-lg border border-[#DBE4E8] bg-white shadow-sm">
      <table className="w-full min-w-[980px] border-collapse text-sm">
        <thead className="bg-[#FAFAFA]">
          <tr className="border-b border-[#DBE4E8] text-left text-[#7F8385]">
            <th className="px-3 py-2 font-medium">Time</th>
            <th className="px-3 py-2 font-medium">Duration</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">User</th>
            <th className="px-3 py-2 font-medium">Project</th>
            <th className="px-3 py-2 font-medium">Command</th>
            <th className="px-3 py-2 font-medium">Hardware tier</th>
            <th className="px-3 py-2 font-medium">Environment</th>
            <th className="px-3 py-2 font-medium">Run type</th>
            <th className="px-3 py-2 font-medium">
              <span className="inline-flex items-center gap-1">Usage <UsageClassInfo compact /></span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="cursor-pointer border-b border-[#DBE4E8] text-[#3F4547] hover:bg-[#F7F8FD]"
              onClick={() => onSelectEvent(row.sourceEvent)}
            >
              <td className="px-3 py-2">{row.timestamp ? format(row.timestamp, 'PP p') : 'Unknown'}</td>
              <td className="px-3 py-2">
                {row.durationSec == null ? <UnknownBadge field="duration" record={row} /> : formatDuration(row.durationSec)}
              </td>
              <td className="px-3 py-2"><CellValue value={row.status} field="status" record={row} /></td>
              <td className="px-3 py-2"><CellValue value={row.user} field="user" record={row} /></td>
              <td className="px-3 py-2"><CellValue value={row.project} field="project" record={row} /></td>
              <td className="max-w-[260px] truncate px-3 py-2" title={row.command !== 'Unknown' ? row.command : undefined}>
                <CellValue value={row.command} field="command" record={row} />
              </td>
              <td className="px-3 py-2"><CellValue value={row.hardwareTier} field="hardwareTier" record={row} /></td>
              <td className="max-w-[220px] truncate px-3 py-2" title={row.environmentName !== 'Unknown' ? row.environmentName : undefined}>
                <CellValue value={row.environmentName} field="environmentName" record={row} />
              </td>
              <td className="px-3 py-2"><CellValue value={row.runType} field="runType" record={row} /></td>
              <td className="px-3 py-2"><CellValue value={row.usageClass} field="usageClass" record={row} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
