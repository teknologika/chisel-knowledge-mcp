import { logger } from '../shared/logging/index.js';
import { startMcpServer } from '../infrastructure/mcp/index.js';

async function main(): Promise<void> {
  await startMcpServer();
}

main().catch((error: unknown) => {
  logger.error({ error }, 'Failed to start chisel-knowledge-mcp');
  process.exitCode = 1;
});
