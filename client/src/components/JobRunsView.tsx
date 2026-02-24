import { useMemo, useState } from 'react';
import type { AuditEvent } from '../types';
import { extractRunRecords } from '../utils/runRecords';
import { RunRecordsTable } from './RunRecordsTable';
import { DetailPanel } from './DetailPanel';
import { exportToCsv } from '../utils/csvExport';

interface JobRunsViewProps {
  events: AuditEvent[];
}

export function JobRunsView({ events }: JobRunsViewProps) {
  const [query, setQuery] = useState('');
  const [userFilter, setUserFilter] = useState('All');
  const [projectFilter, setProjectFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [usageFilter, setUsageFilter] = useState('All');
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const records = useMemo(
    () => extractRunRecords(events).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
    [events]
  );

  const options = useMemo(() => {
    const users = new Set<string>();
    const projects = new Set<string>();
    const statuses = new Set<string>();
    for (const row of records) {
      users.add(row.user);
      projects.add(row.project);
      statuses.add(row.status);
    }
    return {
      users: ['All', ...Array.from(users).sort()],
      projects: ['All', ...Array.from(projects).sort()],
      statuses: ['All', ...Array.from(statuses).sort()],
      usages: ['All', 'SAS', 'SLC', 'Unknown'],
    };
  }, [records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((row) => {
      if (userFilter !== 'All' && row.user !== userFilter) return false;
      if (projectFilter !== 'All' && row.project !== projectFilter) return false;
      if (statusFilter !== 'All' && row.status !== statusFilter) return false;
      if (usageFilter !== 'All' && row.usageClass !== usageFilter) return false;
      if (!q) return true;
      return (
        row.command.toLowerCase().includes(q) ||
        row.project.toLowerCase().includes(q) ||
        row.user.toLowerCase().includes(q) ||
        row.runId.toLowerCase().includes(q) ||
        row.eventName.toLowerCase().includes(q)
      );
    });
  }, [records, query, userFilter, projectFilter, statusFilter, usageFilter]);

  const onExportCsv = () => {
    exportToCsv('job-runs-filtered', filtered, [
      { key: 'timestamp', header: 'Timestamp' },
      { key: 'eventName', header: 'Event' },
      { key: 'runId', header: 'Run ID' },
      { key: 'durationSec', header: 'Duration (sec)' },
      { key: 'status', header: 'Status' },
      { key: 'user', header: 'User' },
      { key: 'project', header: 'Project' },
      { key: 'command', header: 'Command' },
      { key: 'computeTier', header: 'Compute tier' },
      { key: 'hardwareTier', header: 'Hardware tier' },
      { key: 'environmentName', header: 'Environment' },
      { key: 'usageClass', header: 'Inferred usage class' },
    ]);
  };

  return (
    <div className="h-full overflow-auto p-6" role="region" aria-label="Job and run visibility">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-2 text-lg font-medium text-[#3F4547]">Job and run visibility</h2>
        <p className="mb-4 text-sm text-[#7F8385]">
          Answer who is using Domino, what they are running, which projects are active, and who owns each run.
        </p>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-6">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search command, user, project, run id"
            className="rounded border border-[#DBE4E8] bg-white px-3 py-2 text-sm text-[#3F4547] md:col-span-2"
          />
          <Select value={userFilter} onChange={setUserFilter} options={options.users} label="User" />
          <Select value={projectFilter} onChange={setProjectFilter} options={options.projects} label="Project" />
          <Select value={statusFilter} onChange={setStatusFilter} options={options.statuses} label="Status" />
          <Select value={usageFilter} onChange={setUsageFilter} options={options.usages} label="Usage class" />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-[#7F8385]">
            Showing {filtered.length.toLocaleString()} of {records.length.toLocaleString()} execution records.
          </p>
          <button
            type="button"
            onClick={onExportCsv}
            className="rounded border border-[#DBE4E8] bg-white px-3 py-1.5 text-sm text-[#3F4547] hover:bg-[#F7F8FD]"
          >
            Export CSV
          </button>
        </div>

        <RunRecordsTable rows={filtered} onSelectEvent={setSelectedEvent} />
      </div>

      <DetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
}

function Select({ value, onChange, options, label }: SelectProps) {
  return (
    <label className="flex flex-col gap-1 text-xs text-[#7F8385]">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-[#DBE4E8] bg-white px-2 py-2 text-sm text-[#3F4547]"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
