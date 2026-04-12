import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WorkspaceService } from '../../domains/workspace/index.js';
import {
  KnowledgeArchiveSchema,
  KnowledgeCompileExtendSchema,
  KnowledgeCompileNewSchema,
  KnowledgeGetDedupeContextSchema,
  KnowledgeGetNextInboxFileSchema,
  KnowledgeIngestClipboardSchema,
  KnowledgeIngestTextSchema,
  KnowledgeIngestUrlSchema,
  KnowledgeListInboxSchema,
  KnowledgeListSchema,
  KnowledgeListWorkspacesSchema,
  KnowledgeReadSchema,
  KnowledgeSearchInboxSchema,
  KnowledgeSearchSchema,
  KnowledgeWorkspaceStatusSchema,
  KnowledgeWriteSchema,
} from './tool-schemas.js';

function textContent(value: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

export function createMcpServer(): McpServer {
  const service = new WorkspaceService();
  const server = new McpServer({
    name: 'chisel-knowledge-mcp',
    version: '0.1.0',
  });

  server.tool(
    'knowledge_list_workspaces',
    'List configured workspaces.',
    KnowledgeListWorkspacesSchema,
    async () => textContent(service.listWorkspaces()),
  );

  server.tool(
    'knowledge_workspace_status',
    'Inspect a workspace.',
    KnowledgeWorkspaceStatusSchema,
    async ({ workspace }) => textContent(service.status(workspace)),
  );

  server.tool(
    'knowledge_ingest_text',
    'Write raw text into a workspace inbox.',
    KnowledgeIngestTextSchema,
    async ({ workspace, content, title }) => textContent(service.ingestText(workspace, content, title)),
  );

  server.tool(
    'knowledge_ingest_clipboard',
    'Read clipboard text and write it into a workspace inbox.',
    KnowledgeIngestClipboardSchema,
    async ({ workspace, title }) => textContent(service.ingestClipboard(workspace, title)),
  );

  server.tool(
    'knowledge_ingest_url',
    'Ingest a URL into a workspace inbox.',
    KnowledgeIngestUrlSchema,
    async ({ workspace, url, title }) => textContent(await service.ingestUrl(workspace, url, title)),
  );

  server.tool(
    'knowledge_search',
    'Search workspace knowledge.',
    KnowledgeSearchSchema,
    async ({ workspace, query, limit }) => textContent(service.search(workspace, query, limit)),
  );

  server.tool(
    'knowledge_search_inbox',
    'Full-text search over uncompiled inbox files in a workspace. Use this before compiling to check if an inbox file overlaps with existing inbox content.',
    KnowledgeSearchInboxSchema,
    async ({ workspace, query, limit }) => textContent(service.searchInbox(workspace, query, limit)),
  );

  server.tool(
    'knowledge_get_next_inbox_file',
    'Get the next unprocessed inbox file and its content. Returns null when inbox is empty. Call this to start processing one file.',
    KnowledgeGetNextInboxFileSchema,
    async ({ workspace }) => textContent(service.getNextInboxFile(workspace)),
  );

  server.tool(
    'knowledge_get_dedupe_context',
    'Run FTS searches against knowledge/ and inbox/ for a given query and return results. Call this after reading an inbox file to check for overlap before deciding whether to compile new, extend, or skip.',
    KnowledgeGetDedupeContextSchema,
    async ({ workspace, file, query }) => textContent(service.getDedupeContext(workspace, file, query)),
  );

  server.tool(
    'knowledge_compile_new',
    'Write a compiled article to knowledge/, update index.md, append to log.md, and archive the inbox file. Call this when decision is "new". Provide the article content you have written and the target path within knowledge/.',
    KnowledgeCompileNewSchema,
    async ({ workspace, inbox_file, article_path, content }) =>
      textContent(service.compileNew(workspace, inbox_file, article_path, content)),
  );

  server.tool(
    'knowledge_compile_extend',
    'Write an updated article to knowledge/, update the Updated column in index.md, append to log.md, and archive the inbox file. Call this when decision is "extend". Provide the full updated article content.',
    KnowledgeCompileExtendSchema,
    async ({ workspace, inbox_file, target_path, content }) =>
      textContent(service.compileExtend(workspace, inbox_file, target_path, content)),
  );

  server.tool(
    'knowledge_list_inbox',
    'List uncompiled files in a workspace inbox.',
    KnowledgeListInboxSchema,
    async ({ workspace }) => textContent(service.listInbox(workspace)),
  );

  server.tool(
    'knowledge_write',
    'Write a compiled article into the workspace knowledge directory.',
    KnowledgeWriteSchema,
    async ({ workspace, path, content }) => textContent(service.write(workspace, path, content)),
  );

  server.tool(
    'knowledge_archive',
    'Move a processed inbox file to inbox/archived/.',
    KnowledgeArchiveSchema,
    async ({ workspace, file }) => textContent(service.archive(workspace, file)),
  );

  server.tool(
    'knowledge_read',
    'Read a knowledge file from a workspace.',
    KnowledgeReadSchema,
    async ({ workspace, path }) => textContent(service.read(workspace, path)),
  );

  server.tool(
    'knowledge_list',
    'List markdown files in a workspace knowledge directory.',
    KnowledgeListSchema,
    async ({ workspace, directory }) => textContent(service.list(workspace, directory)),
  );

  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
