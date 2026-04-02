import { config } from '../config.js';

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof LEVELS;

function log(level: Level, message: string, meta?: Record<string, unknown>): void {
  if (LEVELS[level] < LEVELS[config.logLevel]) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(meta ?? {}),
  };
  // MUST write to stderr — stdout is reserved for MCP stdio protocol
  process.stderr.write(JSON.stringify(entry) + '\n');
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
  info:  (msg: string, meta?: Record<string, unknown>) => log('info',  msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => log('warn',  msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
};
