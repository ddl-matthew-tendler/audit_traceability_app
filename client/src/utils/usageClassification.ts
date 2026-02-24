export type UsageClass = 'SAS' | 'SLC' | 'Unknown';

// Keep these patterns centralized so stakeholders can tune them quickly.
export const USAGE_CLASS_PATTERNS: Record<Exclude<UsageClass, 'Unknown'>, RegExp[]> = {
  SAS: [
    /\bsas\b/i,
    /\bsas\s*studio\b/i,
    /\bsas\s*session\b/i,
    /\bproc\s+[a-z0-9_]+\b/i,
    /\bdata\s+\w+\s*;/i,
    /\blibname\b/i,
  ],
  SLC: [
    /\bpython\b/i,
    /\br\s*script\b/i,
    /\brstudio\b/i,
    /\bjupyter\b/i,
    /\bvscode\b/i,
    /\bnotebook\b/i,
    /\bapp\s*server\b/i,
  ],
};

export function inferUsageClass(
  commandOrRunContext: string | null | undefined,
  environmentName: string | null | undefined
): UsageClass {
  const primary = commandOrRunContext?.trim() ?? '';
  const secondary = environmentName?.trim() ?? '';

  const fromPrimary = classify(primary);
  if (fromPrimary !== 'Unknown') return fromPrimary;

  const fromSecondary = classify(secondary);
  if (fromSecondary !== 'Unknown') return fromSecondary;

  return 'Unknown';
}

function classify(input: string): UsageClass {
  if (!input) return 'Unknown';
  if (USAGE_CLASS_PATTERNS.SAS.some((pattern) => pattern.test(input))) return 'SAS';
  if (USAGE_CLASS_PATTERNS.SLC.some((pattern) => pattern.test(input))) return 'SLC';
  return 'Unknown';
}
