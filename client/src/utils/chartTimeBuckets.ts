import {
  startOfDay,
  startOfHour,
  addDays,
  addHours,
  differenceInDays,
  format,
} from 'date-fns';
import type { TimeRange } from '../components/TimeRangePicker';

export interface TimeBucket {
  /** Start of bucket (ms) */
  value: number;
  /** Display label */
  label: string;
  /** For Highcharts x-axis */
  name: string;
}

/** Get time buckets for the x-axis based on selected time range. */
export function getTimeBucketsForRange(range: TimeRange): TimeBucket[] {
  const start = range.start.getTime();
  const end = range.end.getTime();
  const days = Math.ceil((end - start) / (24 * 60 * 60 * 1000));

  switch (range.preset) {
    case 'last24h': {
      const buckets: TimeBucket[] = [];
      let d = startOfHour(new Date(start));
      const endDate = new Date(end);
      for (let i = 0; i < 24; i++) {
        const ts = d.getTime();
        if (ts <= endDate.getTime()) {
          buckets.push({
            value: ts,
            label: format(d, 'ha'),
            name: format(d, 'MMM d ha'),
          });
        }
        d = addHours(d, 1);
      }
      return buckets.length > 0 ? buckets : _dailyBuckets(start, end);
    }
    case 'today': {
      const buckets: TimeBucket[] = [];
      let d = startOfHour(new Date(start));
      const endDate = new Date(end);
      for (let i = 0; i < 24; i++) {
        const ts = d.getTime();
        if (ts <= endDate.getTime()) {
          buckets.push({
            value: ts,
            label: format(d, 'ha'),
            name: format(d, 'MMM d ha'),
          });
        }
        d = addHours(d, 1);
      }
      return buckets.length > 0 ? buckets : _dailyBuckets(start, end);
    }
    case 'last7d': {
      return _dailyBuckets(start, end, 1);
    }
    case 'last30d': {
      return _dailyBuckets(start, end, 1);
    }
    case 'custom': {
      if (days <= 31) return _dailyBuckets(start, end, 1);
      if (days <= 90) return _dailyBuckets(start, end, Math.ceil(days / 30));
      return _weeklyOrMonthlyBuckets(start, end, days);
    }
    case 'all': {
      const totalDays = differenceInDays(new Date(end), new Date(start));
      return _weeklyOrMonthlyBuckets(start, end, totalDays);
    }
    default:
      return _dailyBuckets(start, end, 1);
  }
}

function _dailyBuckets(startMs: number, endMs: number, stepDays = 1): TimeBucket[] {
  const buckets: TimeBucket[] = [];
  let d = startOfDay(new Date(startMs));
  const endDate = new Date(endMs);
  while (d.getTime() <= endDate.getTime()) {
    buckets.push({
      value: d.getTime(),
      label: format(d, 'M/d'),
      name: format(d, 'MMM d, yyyy'),
    });
    d = addDays(d, stepDays);
  }
  return buckets;
}

function _weeklyOrMonthlyBuckets(startMs: number, endMs: number, days: number): TimeBucket[] {
  const buckets: TimeBucket[] = [];
  let d = startOfDay(new Date(startMs));
  const endDate = new Date(endMs);
  const stepDays = days > 365 ? 30 : 7;
  while (d.getTime() <= endDate.getTime()) {
    buckets.push({
      value: d.getTime(),
      label: format(d, 'M/d'),
      name: format(d, 'MMM d, yyyy'),
    });
    d = addDays(d, stepDays);
  }
  return buckets;
}

/** Bucket events into time buckets. Returns map of bucket value (ms) -> count. */
export function bucketEventsByTime(
  events: { timestamp?: number }[],
  buckets: TimeBucket[]
): Map<number, number> {
  const map = new Map<number, number>();
  for (const b of buckets) map.set(b.value, 0);
  const sorted = [...buckets].sort((a, b) => a.value - b.value);
  for (const ev of events) {
    if (!ev.timestamp) continue;
    const ts = ev.timestamp;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (ts >= sorted[i].value) {
        map.set(sorted[i].value, (map.get(sorted[i].value) ?? 0) + 1);
        break;
      }
    }
  }
  return map;
}
