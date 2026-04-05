import { startMcpServer } from './infrastructure/mcp/index.js';

startMcpServer().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Fatal: ${message}\n`);
  process.exit(1);
});
