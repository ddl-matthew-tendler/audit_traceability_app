export type UsageClass = 'SAS' | 'SLC' | 'Unknown';

// Keep these patterns centralized so stakeholders can tune them quickly.
// SAS = SAS Institute product. SLC = SAS-language alternative (e.g. Altair SLC) used to limit SAS licenses.
export const USAGE_CLASS_PATTERNS: Record<Exclude<UsageClass, 'Unknown'>, RegExp[]> = {
  SAS: [
    /\bsas\b/i,
    /\bsas\s*studio\b/i,
    /\bsas\s*session\b/i,
    /\bproc\s+[a-z0-9_]+\b/i,
    /\bdata\s+\w+\s*;/i,
    /\blibname\b/i,
  ],
  // SLC = Altair SLC / SAS Language Compiler / other SAS-language alternatives (not Python, R, Jupyter, etc.)
  SLC: [
    /\bslc\b/i,
    /\baltair\b/i,
    /\bwps\b/i,
    /\bworld\s*programming\b/i,
    /\bsas\s*language\s*compiler\b/i,
    /\bsas\s*alternative\b/i,
    /\bhubcli\b/i,
    /\bslc\s*hub\b/i,
    /\baltair\s*slc\b/i,
  ],
};

export function inferUsageClass(
  commandOrRunContext: string | null | undefined,
  environmentName: string | null | undefined,
  targetName?: string | null | undefined
): UsageClass {
  const primary = commandOrRunContext?.trim() ?? '';
  const secondary = environmentName?.trim() ?? '';
  const tertiary = targetName?.trim() ?? '';

  const fromPrimary = classify(primary);
  if (fromPrimary !== 'Unknown') return fromPrimary;

  const fromSecondary = classify(secondary);
  if (fromSecondary !== 'Unknown') return fromSecondary;

  const fromTarget = classify(tertiary);
  if (fromTarget !== 'Unknown') return fromTarget;

  return 'Unknown';
}

function classify(input: string): UsageClass {
  if (!input) return 'Unknown';
  if (USAGE_CLASS_PATTERNS.SAS.some((pattern) => pattern.test(input))) return 'SAS';
  if (USAGE_CLASS_PATTERNS.SLC.some((pattern) => pattern.test(input))) return 'SLC';
  return 'Unknown';
}
