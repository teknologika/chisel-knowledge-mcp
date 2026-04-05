// Library entry point — exports the service layer for direct use in Chisel
// and other consumers without requiring the MCP protocol.
export { WorkspaceService } from './domains/workspace/workspace.service.js';
export { KnowledgeIndex } from './domains/workspace/knowledge-index.js';
export type {
  WorkspaceConfig,
  ConfigFile,
  WorkspaceListing,
  WorkspaceStatus,
  IngestResult,
  InboxFile,
  InboxListResult,
  ReadResult,
  WriteResult,
  ArchiveResult,
  KnowledgeFile,
  KnowledgeListResult,
  SearchResult,
  SearchResults,
} from './domains/workspace/workspace.types.js';
