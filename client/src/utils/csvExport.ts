export interface CsvColumn<T> {
  key: keyof T | string;
  header: string;
  getValue?: (row: T) => unknown;
}

export function exportToCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  const header = columns.map((column) => escapeCsv(column.header)).join(',');
  const lines = rows.map((row) => {
    return columns
      .map((column) => {
        const raw =
          typeof column.getValue === 'function'
            ? column.getValue(row)
            : (row as Record<string, unknown>)[column.key as string];
        return escapeCsv(maskSensitiveValue(column.header, raw));
      })
      .join(',');
  });

  const csv = [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? '');
  const escaped = text.replace(/"/g, '""');
  if (/[",\n]/.test(escaped)) return `"${escaped}"`;
  return escaped;
}

function maskSensitiveValue(header: string, value: unknown): string {
  const label = header.toLowerCase();
  if (
    label.includes('token') ||
    label.includes('secret') ||
    label.includes('password') ||
    label.includes('api key') ||
    label.includes('apikey')
  ) {
    return '[MASKED]';
  }
  return String(value ?? '');
}
