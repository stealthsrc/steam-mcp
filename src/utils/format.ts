export type OutputFormat = 'markdown' | 'json';

export function formatOutput(value: unknown, format: OutputFormat, markdown: string): string {
  return format === 'json' ? JSON.stringify(value, null, 2) : markdown;
}

export function markdownTable(headers: string[], rows: Array<Array<string | number>>): string[] {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(String).join(' | ')} |`),
  ];
}

export function formatDate(ts?: number): string {
  if (!ts) return 'Unknown';
  return new Date(ts * 1000).toISOString().split('T')[0]!;
}

export function formatPlaytime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
