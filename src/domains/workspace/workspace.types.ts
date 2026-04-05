export type WorkspaceConfig = {
  name: string;
  path: string;
};

export type ConfigFile = {
  workspaces: WorkspaceConfig[];
};

export type WorkspaceListing = WorkspaceConfig & {
  exists: boolean;
};

export type WorkspaceStatus = WorkspaceListing & {
  inboxCount: number;
  knowledgeCount: number;
  lastCompiled: string | null;
};

export type IngestResult = {
  file: string;
  workspace: string;
};

export type InboxFile = {
  path: string;
  size: number;
  modified: string;
};

export type InboxListResult = {
  files: InboxFile[];
};

export type ReadResult = {
  content: string;
  file: string;
};

export type WriteResult = {
  file: string;
  workspace: string;
};

export type ArchiveResult = {
  original: string;
  archived: string;
  workspace: string;
};

export type KnowledgeFile = {
  path: string;
  size: number;
  modified: string;
};

export type KnowledgeListResult = {
  files: KnowledgeFile[];
};

export type SearchResult = {
  file: string;
  excerpt: string;
  score: number;
};

export type SearchResults = {
  results: SearchResult[];
};
