import { useState, useCallback } from 'react';
import {
  subDays,
  subHours,
  startOfDay,
  endOfDay,
  startOfToday,
  endOfToday,
  format,
  isAfter,
  differenceInDays,
  differenceInHours,
} from 'date-fns';

export type TimeRangePreset = 'all' | 'today' | 'last24h' | 'last7d' | 'last30d' | 'custom';

export interface TimeRange {
  start: Date;
  end: Date;
  preset: TimeRangePreset;
}

const PRESETS: { id: TimeRangePreset; label: string; getValue: () => { start: Date; end: Date } }[] = [
  {
    id: 'all',
    label: 'All time',
    getValue: () => ({ start: subDays(new Date(), 365 * 2), end: new Date() }),
  },
  { id: 'today', label: 'Today', getValue: () => ({ start: startOfToday(), end: endOfToday() }) },
  {
    id: 'last24h',
    label: 'Last 24h',
    getValue: () => ({ end: new Date(), start: subHours(new Date(), 24) }),
  },
  {
    id: 'last7d',
    label: 'Last 7 days',
    getValue: () => ({ end: new Date(), start: subDays(new Date(), 7) }),
  },
  {
    id: 'last30d',
    label: 'Last 30 days',
    getValue: () => ({ end: new Date(), start: subDays(new Date(), 30) }),
  },
  { id: 'custom', label: 'Custom', getValue: () => ({ start: subDays(new Date(), 7), end: new Date() }) },
];

interface TimeRangePickerProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  disabled?: boolean;
}

export function TimeRangePicker({ value, onChange, disabled }: TimeRangePickerProps) {
  const [preset, setPreset] = useState<TimeRangePreset>(value.preset);
  const [customStart, setCustomStart] = useState(format(value.start, 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(value.end, 'yyyy-MM-dd'));
  const [showCustom, setShowCustom] = useState(value.preset === 'custom');

  const applyPreset = useCallback(
    (p: TimeRangePreset) => {
      if (p === 'custom') {
        setShowCustom(true);
        const start = new Date(customStart);
        const end = new Date(customEnd);
        if (isAfter(start, end)) {
          const s = end;
          const e = start;
          setCustomStart(format(s, 'yyyy-MM-dd'));
          setCustomEnd(format(e, 'yyyy-MM-dd'));
          onChange({ start: startOfDay(s), end: endOfDay(e), preset: 'custom' });
        } else {
          onChange({ start: startOfDay(start), end: endOfDay(end), preset: 'custom' });
        }
        setPreset('custom');
        return;
      }
      setShowCustom(false);
      const { start, end } = PRESETS.find((x) => x.id === p)!.getValue();
      setPreset(p);
      onChange({ start, end, preset: p });
    },
    [customStart, customEnd, onChange]
  );

  const onCustomApply = useCallback(() => {
    const start = startOfDay(new Date(customStart));
    const end = endOfDay(new Date(customEnd));
    if (isAfter(start, end)) {
      onChange({ start: end, end: start, preset: 'custom' });
    } else {
      onChange({ start, end, preset: 'custom' });
    }
    setPreset('custom');
  }, [customStart, customEnd, onChange]);

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Time range">
      {PRESETS.filter((p) => p.id !== 'custom').map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => applyPreset(p.id)}
          disabled={disabled}
          aria-pressed={preset === p.id && !showCustom}
          className={`rounded border px-2 py-1 text-sm ${
            preset === p.id && !showCustom
              ? 'border-domino-primary bg-domino-primary text-white'
              : 'border-domino-border bg-domino-container text-domino-text hover:bg-domino-bg'
          }`}
        >
          {p.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => {
          setShowCustom(true);
          setPreset('custom');
        }}
        disabled={disabled}
        aria-pressed={preset === 'custom'}
        className={`rounded border px-2 py-1 text-sm ${
          preset === 'custom'
            ? 'border-domino-primary bg-domino-primary text-white'
            : 'border-domino-border bg-domino-container text-domino-text hover:bg-domino-bg'
        }`}
      >
        Custom
      </button>
      {showCustom && (
        <div className="ml-2 flex items-center gap-2 border-l border-domino-border pl-2">
          <label className="sr-only" htmlFor="custom-start">
            Start date
          </label>
          <input
            id="custom-start"
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            disabled={disabled}
            className="rounded border border-domino-border bg-white px-2 py-1 text-sm text-domino-text"
          />
          <span className="text-domino-text-body">to</span>
          <label className="sr-only" htmlFor="custom-end">
            End date
          </label>
          <input
            id="custom-end"
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            disabled={disabled}
            className="rounded border border-domino-border bg-white px-2 py-1 text-sm text-domino-text"
          />
          <button
            type="button"
            onClick={onCustomApply}
            disabled={disabled}
            className="rounded border border-domino-secondaryBorder bg-domino-secondarySurface px-2 py-1 text-sm text-domino-secondaryText"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

export function getDefaultTimeRange(): TimeRange {
  const end = new Date();
  const start = subDays(end, 7);
  return { start, end, preset: 'last7d' };
}

export function timeRangeToParams(range: TimeRange): { startTimestamp: number; endTimestamp: number } {
  return {
    startTimestamp: range.start.getTime(),
    endTimestamp: range.end.getTime(),
  };
}

/** Previous period of same duration, ending when current period starts. Returns null for "all" preset. */
export function getPreviousPeriodParams(
  range: TimeRange
): { startTimestamp: number; endTimestamp: number } | null {
  if (range.preset === 'all') return null;
  const duration = range.end.getTime() - range.start.getTime();
  if (duration <= 0) return null;
  const prevEnd = range.start.getTime();
  const prevStart = prevEnd - duration;
  return { startTimestamp: prevStart, endTimestamp: prevEnd };
}

/** Human-readable label for the comparison period (e.g. "previous 30 days") */
export function getPreviousPeriodLabel(range: TimeRange): string {
  switch (range.preset) {
    case 'today':
      return 'previous day';
    case 'last24h':
      return 'previous 24 hours';
    case 'last7d':
      return 'previous 7 days';
    case 'last30d':
      return 'previous 30 days';
    case 'custom': {
      const days = differenceInDays(range.end, range.start);
      const hours = differenceInHours(range.end, range.start);
      if (days >= 1) return `previous ${days} days`;
      if (hours >= 1) return `previous ${hours} hours`;
      return 'previous period';
    }
    default:
      return 'previous period';
  }
}
