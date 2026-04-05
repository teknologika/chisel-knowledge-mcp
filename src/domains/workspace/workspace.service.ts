import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { execSync } from 'node:child_process';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type {
  ConfigFile,
  IngestResult,
  KnowledgeFile,
  KnowledgeListResult,
  ReadResult,
  SearchResults,
  WorkspaceConfig,
  WorkspaceListing,
  WorkspaceStatus,
} from './workspace.types.js';
import { loadConfig } from '../../shared/config/index.js';

export class WorkspaceService {
  constructor(private readonly config: ConfigFile = loadConfig()) {}

  getConfig(): ConfigFile {
    return this.config;
  }

  resolve(name: string): WorkspaceConfig {
    const workspace = this.config.workspaces.find((entry) => entry.name === name);

    if (!workspace) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown workspace: ${name}`);
    }

    return workspace;
  }

  listWorkspaces(): WorkspaceListing[] {
    return this.config.workspaces.map((workspace) => ({
      ...workspace,
      exists: existsSync(workspace.path),
    }));
  }

  status(name: string): WorkspaceStatus {
    const workspace = this.resolve(name);
    const exists = existsSync(workspace.path);

    return {
      ...workspace,
      exists,
      inboxCount: 0,
      knowledgeCount: 0,
      lastCompiled: null,
    };
  }

  ingestText(name: string, content: string, title?: string): IngestResult {
    const workspace = this.resolve(name);
    const inboxPath = join(workspace.path, 'inbox');
    mkdirSync(inboxPath, { recursive: true });

    const filePath = join(inboxPath, `${currentDateStamp()}-${slugify(title)}.md`);
    writeFileSync(filePath, content, 'utf8');

    return {
      file: filePath,
      workspace: workspace.name,
    };
  }

  ingestClipboard(name: string, title?: string): IngestResult {
    const clipboard = execSync('pbpaste', { encoding: 'utf8' });
    return this.ingestText(name, clipboard, title);
  }

  ingestUrl(_name: string, _url: string, _title?: string): never {
    throw new McpError(ErrorCode.InternalError, 'URL ingestion not yet implemented');
  }

  search(_name: string, _query: string, _limit?: number): SearchResults {
    return { results: [] };
  }

  read(name: string, pathName: string): ReadResult {
    const workspace = this.resolve(name);
    const filePath = resolve(workspace.path, pathName);
    const content = readFileSync(filePath, 'utf8');

    return {
      content,
      file: filePath,
    };
  }

  list(name: string, directory?: string): KnowledgeListResult {
    const workspace = this.resolve(name);
    const knowledgeRoot = directory ? resolve(workspace.path, directory) : join(workspace.path, 'knowledge');

    if (!existsSync(knowledgeRoot)) {
      return { files: [] };
    }

    const files = this.collectMarkdownFiles(workspace.path, knowledgeRoot);

    return {
      files,
    };
  }

  private collectMarkdownFiles(workspaceRoot: string, directory: string): KnowledgeFile[] {
    const entries = readdirSync(directory, { withFileTypes: true });
    const files: KnowledgeFile[] = [];

    for (const entry of entries) {
      const entryPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        files.push(...this.collectMarkdownFiles(workspaceRoot, entryPath));
        continue;
      }

      if (!entry.name.endsWith('.md')) {
        continue;
      }

      const stats = statSync(entryPath);
      files.push({
        path: relative(workspaceRoot, entryPath),
        size: stats.size,
        modified: stats.mtime.toISOString(),
      });
    }

    return files.sort((left, right) => left.path.localeCompare(right.path));
  }
}

function currentDateStamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get('year')}-${byType.get('month')}-${byType.get('day')}`;
}

function slugify(title?: string): string {
  const raw = (title ?? 'untitled').toLowerCase();
  const slug = raw
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

  return slug || 'untitled';
}
