const key = process.env['STEAM_API_KEY'];
if (!key || key.trim() === '') {
  process.stderr.write('FATAL: STEAM_API_KEY environment variable is required but not set.\n');
  process.exit(1);
}

export const config = {
  steamApiKey: key,
  logLevel: (process.env['LOG_LEVEL'] ?? 'info') as 'debug' | 'info' | 'warn' | 'error',
  rateLimitRpm: parseInt(process.env['RATE_LIMIT_RPM'] ?? '100', 10),
  requestTimeoutMs: parseInt(process.env['REQUEST_TIMEOUT_MS'] ?? '10000', 10),
  cacheTtlSeconds: parseInt(process.env['CACHE_TTL_SECONDS'] ?? '300', 10),
} as const;
