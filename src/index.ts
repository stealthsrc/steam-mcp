// Route uncaught errors to stderr — stdout is reserved for MCP stdio protocol
process.on('uncaughtException', (err) => {
  process.stderr.write(`FATAL uncaughtException: ${err.stack ?? String(err)}\n`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  process.stderr.write(`FATAL unhandledRejection: ${String(reason)}\n`);
  process.exit(1);
});

// Config must load first — will exit(1) if STEAM_API_KEY is missing
import './config.js';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  logger.info('steam-mcp server started', { transport: 'stdio' });
}

main().catch((err) => {
  process.stderr.write(`FATAL: failed to start server: ${String(err)}\n`);
  process.exit(1);
});
