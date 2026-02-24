import { useState, useEffect, useCallback, useMemo } from 'react';

interface ScheduleReportModalProps {
  open: boolean;
  onClose: () => void;
}

interface ConfigData {
  user: { id: string; userName: string; fullName: string; email: string };
  hardwareTiers: { id: string; name: string; cores?: number; memory?: number }[];
  projectId: string;
  projectName: string;
}

const REPORT_SECTIONS = [
  { id: 'overview', label: 'Overview metrics', description: 'Total events, active users, active projects, and period-over-period change' },
  { id: 'jobRuns', label: 'Job & run details', description: 'Full table of execution records with user, project, command, status, and duration' },
  { id: 'adoption', label: 'SAS vs SLC adoption', description: 'Usage class breakdown showing SAS, SLC, and unclassified run counts per user and project' },
  { id: 'compute', label: 'Compute insights', description: 'Hardware tier usage, average runtimes, failure rates, and longest-running jobs' },
  { id: 'coverage', label: 'Data coverage', description: 'Completeness percentages for each field (command, status, environment, etc.)' },
];

const FREQUENCIES = [
  { id: 'daily', label: 'Every day', description: 'A fresh report lands in your inbox every morning' },
  { id: 'weekly', label: 'Every week', description: 'A weekly summary delivered on the day you choose' },
  { id: 'monthly', label: 'Every month', description: 'A monthly recap delivered on the 1st of each month' },
];

const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

const TIMEZONES = [
  { id: 'America/New_York', label: 'Eastern Time (ET)' },
  { id: 'America/Chicago', label: 'Central Time (CT)' },
  { id: 'America/Denver', label: 'Mountain Time (MT)' },
  { id: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { id: 'Europe/London', label: 'London (GMT/BST)' },
  { id: 'Europe/Berlin', label: 'Central Europe (CET)' },
  { id: 'Asia/Tokyo', label: 'Japan (JST)' },
  { id: 'UTC', label: 'UTC' },
];

const STEPS = ['What to include', 'Who receives it', 'When to send', 'Review & schedule'];

export function ScheduleReportModal({ open, onClose }: ScheduleReportModalProps) {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('Weekly Usage Trends Report');
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set(REPORT_SECTIONS.map((s) => s.id)));
  const [emails, setEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  const [timezone, setTimezone] = useState('America/New_York');
  const [hardwareTierId, setHardwareTierId] = useState('');

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setSubmitResult(null);
    setConfigLoading(true);
    setConfigError(null);

    fetch('./api/schedule-report/config')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setConfigError(data.error);
        } else {
          setConfig(data);
          if (data.user?.email) {
            setEmails([data.user.email]);
          }
          if (data.hardwareTiers?.length > 0) {
            const smallest = data.hardwareTiers.reduce(
              (best: { id: string; cores?: number }, t: { id: string; cores?: number }) =>
                (t.cores ?? 99) < (best.cores ?? 99) ? t : best,
              data.hardwareTiers[0]
            );
            setHardwareTierId(smallest.id);
          }
        }
      })
      .catch((e) => setConfigError(String(e)))
      .finally(() => setConfigLoading(false));
  }, [open]);

  const toggleSection = useCallback((id: string) => {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addEmail = useCallback(() => {
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed) return;
    const parts = trimmed.split(/[,;\s]+/).filter((e) => e.includes('@'));
    if (parts.length === 0) return;
    setEmails((prev) => [...new Set([...prev, ...parts])]);
    setEmailInput('');
  }, [emailInput]);

  const removeEmail = useCallback((email: string) => {
    setEmails((prev) => prev.filter((e) => e !== email));
  }, []);

  const canAdvance = useMemo(() => {
    if (step === 0) return selectedSections.size > 0 && title.trim().length > 0;
    if (step === 1) return emails.length > 0;
    if (step === 2) return true;
    return true;
  }, [step, selectedSections, title, emails]);

  const scheduleDescription = useMemo(() => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    const tz = TIMEZONES.find((t) => t.id === timezone)?.label ?? timezone;
    if (frequency === 'daily') return `Every day at ${timeStr} ${tz}`;
    if (frequency === 'monthly') return `1st of every month at ${timeStr} ${tz}`;
    return `Every ${dayNames[dayOfWeek % 7]} at ${timeStr} ${tz}`;
  }, [frequency, dayOfWeek, hour, minute, timezone]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const resp = await fetch('./api/schedule-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          emails,
          frequency,
          dayOfWeek,
          hour,
          minute,
          timezone,
          reportSections: Array.from(selectedSections),
          hardwareTierId,
          userId: config?.user?.id ?? '',
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setSubmitResult({
          success: true,
          message: 'Report scheduled successfully!',
          details: `"${title}" will run ${scheduleDescription.toLowerCase()} and notify ${emails.join(', ')}.`,
        });
      } else {
        setSubmitResult({ success: false, message: data.error || 'Failed to create scheduled job.' });
      }
    } catch (e) {
      setSubmitResult({ success: false, message: String(e) });
    } finally {
      setSubmitting(false);
    }
  }, [title, emails, frequency, dayOfWeek, hour, minute, timezone, selectedSections, hardwareTierId, config, scheduleDescription]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="relative mx-4 flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[#DBE4E8] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-[#DBE4E8] bg-[#FAFAFA] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#2E2E38]">Schedule a Usage Report</h2>
              <p className="mt-0.5 text-xs text-[#7F8385]">
                Domino will automatically run this report and notify your recipients when it's ready.
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded p-1 text-[#7F8385] hover:bg-[#E8E8EE]" aria-label="Close">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Step indicator */}
          {!submitResult && (
            <div className="mt-4 flex gap-1">
              {STEPS.map((label, i) => (
                <div key={label} className="flex-1">
                  <div className={`h-1 rounded-full transition-colors ${i <= step ? 'bg-[#543FDE]' : 'bg-[#E0E0E0]'}`} />
                  <p className={`mt-1 text-[10px] ${i === step ? 'font-medium text-[#543FDE]' : 'text-[#9B9BAF]'}`}>{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-5">
          {configLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E0E0E0] border-t-[#543FDE]" />
              <p className="mt-3 text-sm text-[#7F8385]">Loading configuration from Domino...</p>
            </div>
          ) : configError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-700">Unable to load configuration</p>
              <p className="mt-1 text-xs text-red-600">{configError}</p>
              <p className="mt-2 text-xs text-[#7F8385]">
                Make sure DOMINO_API_HOST is set and you have permission to create scheduled jobs in this project.
              </p>
            </div>
          ) : submitResult ? (
            <SubmitResultView result={submitResult} onClose={onClose} />
          ) : step === 0 ? (
            <StepContent
              step={step}
              title={title}
              setTitle={setTitle}
              selectedSections={selectedSections}
              toggleSection={toggleSection}
            />
          ) : step === 1 ? (
            <StepRecipients
              emails={emails}
              emailInput={emailInput}
              setEmailInput={setEmailInput}
              addEmail={addEmail}
              removeEmail={removeEmail}
              currentUserEmail={config?.user?.email}
            />
          ) : step === 2 ? (
            <StepSchedule
              frequency={frequency}
              setFrequency={setFrequency}
              dayOfWeek={dayOfWeek}
              setDayOfWeek={setDayOfWeek}
              hour={hour}
              setHour={setHour}
              minute={minute}
              setMinute={setMinute}
              timezone={timezone}
              setTimezone={setTimezone}
              hardwareTierId={hardwareTierId}
              setHardwareTierId={setHardwareTierId}
              hardwareTiers={config?.hardwareTiers ?? []}
              scheduleDescription={scheduleDescription}
            />
          ) : (
            <StepReview
              title={title}
              emails={emails}
              selectedSections={selectedSections}
              scheduleDescription={scheduleDescription}
              hardwareTierName={config?.hardwareTiers?.find((t) => t.id === hardwareTierId)?.name ?? hardwareTierId}
              projectName={config?.projectName || 'Current project'}
              userName={config?.user?.fullName || config?.user?.userName || ''}
            />
          )}
        </div>

        {/* Footer */}
        {!configLoading && !configError && !submitResult && (
          <div className="flex items-center justify-between border-t border-[#DBE4E8] bg-[#FAFAFA] px-6 py-3">
            <button
              type="button"
              onClick={step === 0 ? onClose : () => setStep((s) => s - 1)}
              className="rounded border border-[#DBE4E8] bg-white px-4 py-2 text-sm text-[#3F4547] hover:bg-[#F5F5F7]"
            >
              {step === 0 ? 'Cancel' : 'Back'}
            </button>
            {step < 3 ? (
              <button
                type="button"
                disabled={!canAdvance}
                onClick={() => setStep((s) => s + 1)}
                className="rounded border border-[#543FDE] bg-[#543FDE] px-5 py-2 text-sm font-medium text-white hover:bg-[#3B23D1] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="rounded border border-[#543FDE] bg-[#543FDE] px-5 py-2 text-sm font-medium text-white hover:bg-[#3B23D1] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Creating...
                  </span>
                ) : (
                  'Schedule this report'
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


/* ─── Step 1: What to include ─── */

function StepContent({
  step: _step,
  title,
  setTitle,
  selectedSections,
  toggleSection,
}: {
  step: number;
  title: string;
  setTitle: (v: string) => void;
  selectedSections: Set<string>;
  toggleSection: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#2E2E38]">
          Report name
        </label>
        <p className="mb-2 text-xs text-[#7F8385]">
          Give your report a name so you can recognize it later. This shows up in Domino's scheduled jobs list.
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Weekly Usage Trends Report"
          className="w-full rounded-lg border border-[#DBE4E8] px-3 py-2.5 text-sm text-[#2E2E38] placeholder-[#B0B0C0] focus:border-[#543FDE] focus:outline-none focus:ring-1 focus:ring-[#543FDE]"
        />
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-[#2E2E38]">
          What should the report include?
        </p>
        <p className="mb-3 text-xs text-[#7F8385]">
          Select which sections to include in the report. Each section will be a separate sheet or section in the output.
        </p>
        <div className="space-y-2">
          {REPORT_SECTIONS.map((section) => (
            <label
              key={section.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                selectedSections.has(section.id)
                  ? 'border-[#543FDE] bg-[#F7F6FE]'
                  : 'border-[#DBE4E8] bg-white hover:border-[#B0B0C0]'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedSections.has(section.id)}
                onChange={() => toggleSection(section.id)}
                className="mt-0.5 h-4 w-4 rounded border-[#DBE4E8] text-[#543FDE] focus:ring-[#543FDE]"
              />
              <div>
                <p className="text-sm font-medium text-[#2E2E38]">{section.label}</p>
                <p className="mt-0.5 text-xs text-[#7F8385]">{section.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}


/* ─── Step 2: Recipients ─── */

function StepRecipients({
  emails,
  emailInput,
  setEmailInput,
  addEmail,
  removeEmail,
  currentUserEmail,
}: {
  emails: string[];
  emailInput: string;
  setEmailInput: (v: string) => void;
  addEmail: () => void;
  removeEmail: (email: string) => void;
  currentUserEmail?: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-1.5 text-sm font-medium text-[#2E2E38]">
          Who should receive this report?
        </p>
        <p className="mb-3 text-xs text-[#7F8385]">
          Enter the email addresses of everyone who should get notified when the report finishes.
          They'll receive a Domino notification with a link to download the results.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
          placeholder="name@company.com"
          type="email"
          className="flex-1 rounded-lg border border-[#DBE4E8] px-3 py-2.5 text-sm text-[#2E2E38] placeholder-[#B0B0C0] focus:border-[#543FDE] focus:outline-none focus:ring-1 focus:ring-[#543FDE]"
        />
        <button
          type="button"
          onClick={addEmail}
          disabled={!emailInput.trim().includes('@')}
          className="rounded-lg border border-[#543FDE] bg-[#543FDE] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#3B23D1] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {currentUserEmail && !emails.includes(currentUserEmail) && (
        <button
          type="button"
          onClick={() => { setEmailInput(currentUserEmail); }}
          className="text-xs text-[#543FDE] hover:underline"
        >
          + Add myself ({currentUserEmail})
        </button>
      )}

      {emails.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[#7F8385]">
            {emails.length} recipient{emails.length !== 1 ? 's' : ''} will be notified:
          </p>
          <div className="flex flex-wrap gap-2">
            {emails.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#DBE4E8] bg-[#F5F5F7] px-3 py-1 text-xs text-[#3F4547]"
              >
                {email}
                <button
                  type="button"
                  onClick={() => removeEmail(email)}
                  className="rounded-full p-0.5 text-[#9B9BAF] hover:bg-[#E0E0E0] hover:text-[#3F4547]"
                  aria-label={`Remove ${email}`}
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {emails.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#DBE4E8] bg-[#FAFAFA] p-4 text-center">
          <p className="text-sm text-[#9B9BAF]">No recipients added yet</p>
          <p className="mt-1 text-xs text-[#B0B0C0]">Type an email address above and press Enter or click Add</p>
        </div>
      )}
    </div>
  );
}


/* ─── Step 3: Schedule ─── */

function StepSchedule({
  frequency,
  setFrequency,
  dayOfWeek,
  setDayOfWeek,
  hour,
  setHour,
  minute,
  setMinute,
  timezone,
  setTimezone,
  hardwareTierId,
  setHardwareTierId,
  hardwareTiers,
  scheduleDescription,
}: {
  frequency: string;
  setFrequency: (v: string) => void;
  dayOfWeek: number;
  setDayOfWeek: (v: number) => void;
  hour: number;
  setHour: (v: number) => void;
  minute: number;
  setMinute: (v: number) => void;
  timezone: string;
  setTimezone: (v: string) => void;
  hardwareTierId: string;
  setHardwareTierId: (v: string) => void;
  hardwareTiers: { id: string; name: string; cores?: number; memory?: number }[];
  scheduleDescription: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-1.5 text-sm font-medium text-[#2E2E38]">How often?</p>
        <p className="mb-3 text-xs text-[#7F8385]">Choose how frequently you'd like the report generated.</p>
        <div className="grid grid-cols-3 gap-2">
          {FREQUENCIES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFrequency(f.id)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                frequency === f.id
                  ? 'border-[#543FDE] bg-[#F7F6FE]'
                  : 'border-[#DBE4E8] bg-white hover:border-[#B0B0C0]'
              }`}
            >
              <p className="text-sm font-medium text-[#2E2E38]">{f.label}</p>
              <p className="mt-0.5 text-[11px] text-[#7F8385]">{f.description}</p>
            </button>
          ))}
        </div>
      </div>

      {frequency === 'weekly' && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#2E2E38]">Which day?</label>
          <select
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(Number(e.target.value))}
            className="w-full rounded-lg border border-[#DBE4E8] px-3 py-2.5 text-sm text-[#2E2E38] focus:border-[#543FDE] focus:outline-none focus:ring-1 focus:ring-[#543FDE]"
          >
            {DAYS_OF_WEEK.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#2E2E38]">Time</label>
          <div className="flex gap-1.5">
            <select
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              className="flex-1 rounded-lg border border-[#DBE4E8] px-2 py-2.5 text-sm text-[#2E2E38] focus:border-[#543FDE] focus:outline-none focus:ring-1 focus:ring-[#543FDE]"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
              ))}
            </select>
            <span className="flex items-center text-sm text-[#7F8385]">:</span>
            <select
              value={minute}
              onChange={(e) => setMinute(Number(e.target.value))}
              className="flex-1 rounded-lg border border-[#DBE4E8] px-2 py-2.5 text-sm text-[#2E2E38] focus:border-[#543FDE] focus:outline-none focus:ring-1 focus:ring-[#543FDE]"
            >
              {[0, 15, 30, 45].map((m) => (
                <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#2E2E38]">Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded-lg border border-[#DBE4E8] px-3 py-2.5 text-sm text-[#2E2E38] focus:border-[#543FDE] focus:outline-none focus:ring-1 focus:ring-[#543FDE]"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.id} value={tz.id}>{tz.label}</option>
            ))}
          </select>
        </div>
      </div>

      {hardwareTiers.length > 0 && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#2E2E38]">
            Compute size
          </label>
          <p className="mb-2 text-xs text-[#7F8385]">
            Choose how much computing power to use. The smallest size is usually enough for reports.
          </p>
          <select
            value={hardwareTierId}
            onChange={(e) => setHardwareTierId(e.target.value)}
            className="w-full rounded-lg border border-[#DBE4E8] px-3 py-2.5 text-sm text-[#2E2E38] focus:border-[#543FDE] focus:outline-none focus:ring-1 focus:ring-[#543FDE]"
          >
            {hardwareTiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.cores ? ` (${t.cores} cores` : ''}{t.memory ? `, ${t.memory}` : ''}{t.cores ? ')' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="rounded-lg border border-[#E0E0E0] bg-[#F7F6FE] p-3">
        <p className="text-xs font-medium text-[#543FDE]">Schedule preview</p>
        <p className="mt-1 text-sm text-[#2E2E38]">{scheduleDescription}</p>
      </div>
    </div>
  );
}


/* ─── Step 4: Review ─── */

function StepReview({
  title,
  emails,
  selectedSections,
  scheduleDescription,
  hardwareTierName,
  projectName,
  userName,
}: {
  title: string;
  emails: string[];
  selectedSections: Set<string>;
  scheduleDescription: string;
  hardwareTierName: string;
  projectName: string;
  userName: string;
}) {
  const sections = REPORT_SECTIONS.filter((s) => selectedSections.has(s.id));

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#7F8385]">
        Please review the details below. When you click <strong>"Schedule this report"</strong>, Domino will create a
        scheduled job that automatically generates and distributes this report.
      </p>

      <div className="divide-y divide-[#E8E8EE] rounded-lg border border-[#DBE4E8] bg-white">
        <ReviewRow label="Report name" value={title} />
        <ReviewRow label="Includes" value={sections.map((s) => s.label).join(', ')} />
        <ReviewRow label="Recipients" value={emails.join(', ')} />
        <ReviewRow label="Schedule" value={scheduleDescription} />
        <ReviewRow label="Compute size" value={hardwareTierName} />
        <ReviewRow label="Project" value={projectName || '(current project)'} />
        {userName && <ReviewRow label="Scheduled by" value={userName} />}
      </div>

      <div className="rounded-lg border border-[#E0E0E0] bg-[#FFFBEB] p-3">
        <p className="text-xs text-[#92400E]">
          <strong>What happens next:</strong> Domino will run this report on the schedule above.
          Each time it runs, a job executes in your project, generates the report data, and sends
          a notification email to all recipients with a link to view/download the results.
        </p>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 px-4 py-2.5">
      <span className="w-28 shrink-0 text-xs font-medium text-[#7F8385]">{label}</span>
      <span className="text-sm text-[#2E2E38]">{value}</span>
    </div>
  );
}


/* ─── Result screen ─── */

function SubmitResultView({ result, onClose }: { result: { success: boolean; message: string; details?: string }; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      {result.success ? (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F5EE]">
            <svg className="h-7 w-7 text-[#28A464]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="mt-4 text-lg font-semibold text-[#2E2E38]">{result.message}</p>
          {result.details && <p className="mt-2 max-w-sm text-sm text-[#7F8385]">{result.details}</p>}
          <p className="mt-4 text-xs text-[#9B9BAF]">
            You can manage or pause this scheduled job from the project's Scheduled Jobs page in Domino.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 rounded border border-[#543FDE] bg-[#543FDE] px-5 py-2 text-sm font-medium text-white hover:bg-[#3B23D1]"
          >
            Done
          </button>
        </>
      ) : (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <svg className="h-7 w-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="mt-4 text-lg font-semibold text-[#2E2E38]">Could not schedule report</p>
          <p className="mt-2 max-w-sm text-sm text-red-600">{result.message}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 rounded border border-[#DBE4E8] bg-white px-5 py-2 text-sm text-[#3F4547] hover:bg-[#F5F5F7]"
          >
            Close
          </button>
        </>
      )}
    </div>
  );
}
