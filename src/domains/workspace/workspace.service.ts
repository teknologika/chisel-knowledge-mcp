import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve, join, relative, sep } from 'node:path';
import { execSync } from 'node:child_process';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type {
  ArchiveResult,
  CompileExtendResult,
  CompileNewResult,
  ConfigFile,
  DedupeContext,
  IngestResult,
  InboxFileWithContent,
  InboxListResult,
  KnowledgeFile,
  KnowledgeListResult,
  ReadResult,
  SearchResults,
  WorkspaceConfig,
  WorkspaceListing,
  WorkspaceStatus,
  WriteResult,
} from './workspace.types.js';
import { KnowledgeIndex } from './knowledge-index.js';
import { InboxIndex } from './inbox-index.js';
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
    const inboxRoot = join(workspace.path, 'inbox');
    const knowledgeRoot = join(workspace.path, 'knowledge');
    const inboxCount = exists && existsSync(inboxRoot)
      ? this.collectMarkdownFiles(workspace.path, inboxRoot, ['archived']).length
      : 0;
    const knowledgeCount = exists && existsSync(knowledgeRoot)
      ? this.collectMarkdownFiles(workspace.path, knowledgeRoot).length
      : 0;

    return {
      ...workspace,
      exists,
      inboxCount,
      knowledgeCount,
      lastCompiled: null,
    };
  }

  ingestText(name: string, content: string, title?: string): IngestResult {
    const workspace = this.resolve(name);
    const inboxPath = join(workspace.path, 'inbox');
    mkdirSync(inboxPath, { recursive: true });

    const filePath = join(inboxPath, `${currentDateStamp()}-${slugify(title)}.md`);
    writeFileSync(filePath, content, 'utf8');

    const index = new InboxIndex(workspace.path);
    try {
      index.indexFile(filePath);
    } finally {
      index.close();
    }

    return {
      file: relative(workspace.path, filePath),
      workspace: workspace.name,
    };
  }

  ingestClipboard(name: string, title?: string): IngestResult {
    let clipboard: string;
    try {
      clipboard = execSync('pbpaste', { encoding: 'utf8' });
    } catch {
      throw new McpError(
        ErrorCode.InternalError,
        'knowledge_ingest_clipboard requires macOS (pbpaste unavailable)',
      );
    }
    return this.ingestText(name, clipboard, title);
  }

  async ingestUrl(name: string, url: string, title?: string): Promise<IngestResult> {
    const jinaUrl = `https://r.jina.ai/${url}`;
    let response: Response;

    try {
      response = await fetch(jinaUrl, {
        headers: { Accept: 'text/markdown' },
      });
    } catch (err) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to fetch URL: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!response.ok) {
      throw new McpError(ErrorCode.InternalError, `Jina Reader returned ${response.status} for ${url}`);
    }

    const content = await response.text();
    const resolvedTitle = title ?? extractJinaTitle(content) ?? url;

    return this.ingestText(name, content, resolvedTitle);
  }

  search(name: string, query: string, limit = 10): SearchResults {
    const workspace = this.resolve(name);
    const knowledgeRoot = join(workspace.path, 'knowledge');

    if (!existsSync(knowledgeRoot)) {
      return { results: [] };
    }

    const index = new KnowledgeIndex(workspace.path);

    try {
      const files = this.collectMarkdownFiles(workspace.path, knowledgeRoot);
      for (const file of files) {
        index.indexFile(join(workspace.path, file.path));
      }

      return index.search(query, limit);
    } finally {
      index.close();
    }
  }

  searchInbox(name: string, query: string, limit = 10): SearchResults {
    const workspace = this.resolve(name);
    const inboxRoot = join(workspace.path, 'inbox');

    if (!existsSync(inboxRoot)) {
      return { results: [] };
    }

    const index = new InboxIndex(workspace.path);
    try {
      const files = this.collectMarkdownFiles(workspace.path, inboxRoot, ['archived']);
      for (const file of files) {
        index.indexFile(join(workspace.path, file.path));
      }
      return index.search(query, limit);
    } finally {
      index.close();
    }
  }

  getNextInboxFile(name: string): InboxFileWithContent | null {
    const workspace = this.resolve(name);
    const inboxRoot = join(workspace.path, 'inbox');

    if (!existsSync(inboxRoot)) {
      return null;
    }

    const files = this.collectMarkdownFiles(workspace.path, inboxRoot, ['archived']);
    if (files.length === 0) {
      return null;
    }

    const first = files[0]!;
    const absPath = join(workspace.path, first.path);
    const content = readFileSync(absPath, 'utf8');

    return {
      file: first.path,
      content,
      size: first.size,
      modified: first.modified,
    };
  }

  getDedupeContext(name: string, file: string, query: string): DedupeContext {
    const knowledgeMatches = this.search(name, query, 5);
    const inboxMatches = this.searchInbox(name, query, 5);

    return {
      file,
      knowledgeMatches: knowledgeMatches.results.filter((result) => result.file !== file),
      inboxMatches: inboxMatches.results.filter((result) => result.file !== file),
    };
  }

  compileNew(name: string, inboxFile: string, articlePath: string, content: string): CompileNewResult {
    const workspace = this.resolve(name);
    const knowledgeRoot = join(workspace.path, 'knowledge');
    mkdirSync(knowledgeRoot, { recursive: true });

    this.write(name, articlePath, content);

    const indexPath = join(knowledgeRoot, 'index.md');
    const current = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : null;
    const topic = articlePath.split('/')[0]!;
    const ref = articlePath.replace(/\.md$/, '');
    const summary = extractSummary(content);
    const updated = indexAddEntry(current, workspace.name, topic, ref, summary);
    writeFileSync(indexPath, updated, 'utf8');

    appendLog(
      join(knowledgeRoot, 'log.md'),
      `## [${nowISO()}] compile\n- Source: ${inboxFile}\n- Created: [[${ref}]]\n- Updated: index.md, log.md`,
    );

    this.archive(name, inboxFile);

    return { articlePath: `knowledge/${articlePath}`, inboxFile, workspace: name };
  }

  compileExtend(
    name: string,
    inboxFile: string,
    targetPath: string,
    updatedContent: string,
  ): CompileExtendResult {
    const workspace = this.resolve(name);
    const knowledgeRoot = join(workspace.path, 'knowledge');

    this.write(name, targetPath.replace(/^knowledge\//, ''), updatedContent);

    const indexPath = join(knowledgeRoot, 'index.md');
    if (existsSync(indexPath)) {
      const current = readFileSync(indexPath, 'utf8');
      const ref = targetPath.replace(/^knowledge\//, '').replace(/\.md$/, '');
      const summary = extractSummary(updatedContent);
      const updated = indexUpdateEntry(current, ref, summary);
      writeFileSync(indexPath, updated, 'utf8');
    }

    const ref = targetPath.replace(/^knowledge\//, '').replace(/\.md$/, '');
    appendLog(
      join(knowledgeRoot, 'log.md'),
      `## [${nowISO()}] extend\n- Source: ${inboxFile}\n- Updated: [[${ref}]]`,
    );

    this.archive(name, inboxFile);

    return { targetPath, inboxFile, workspace: name };
  }

  read(name: string, pathName: string): ReadResult {
    const workspace = this.resolve(name);
    const filePath = resolve(workspace.path, pathName);
    if (!filePath.startsWith(workspace.path + sep)) {
      throw new McpError(ErrorCode.InvalidParams, 'Path escapes workspace boundary');
    }
    const content = readFileSync(filePath, 'utf8');

    return {
      content,
      file: relative(workspace.path, filePath),
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

  listInbox(name: string): InboxListResult {
    const workspace = this.resolve(name);
    const inboxRoot = join(workspace.path, 'inbox');

    if (!existsSync(inboxRoot)) {
      return { files: [] };
    }

    const files = this.collectMarkdownFiles(workspace.path, inboxRoot, ['archived']);

    return {
      files,
    };
  }

  write(name: string, pathName: string, content: string): WriteResult {
    const workspace = this.resolve(name);
    const knowledgeRoot = join(workspace.path, 'knowledge');
    const target = join(knowledgeRoot, pathName);
    if (!target.startsWith(knowledgeRoot + sep)) {
      throw new McpError(ErrorCode.InvalidParams, 'Path escapes knowledge boundary');
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, 'utf8');

    return {
      file: relative(workspace.path, target),
      workspace: name,
    };
  }

  archive(name: string, file: string): ArchiveResult {
    const workspace = this.resolve(name);
    const inboxRoot = join(workspace.path, 'inbox');
    const source = resolve(workspace.path, file);
    if (!source.startsWith(inboxRoot + sep)) {
      throw new McpError(ErrorCode.InvalidParams, 'File must be within inbox/');
    }
    if (source.startsWith(join(inboxRoot, 'archived') + sep)) {
      throw new McpError(ErrorCode.InvalidParams, 'File is already archived');
    }

    if (!existsSync(source)) {
      throw new McpError(ErrorCode.InvalidParams, `File not found: ${file}`);
    }

    const archivedDir = join(inboxRoot, 'archived');
    mkdirSync(archivedDir, { recursive: true });

    let destination = join(archivedDir, basename(source));

    if (existsSync(destination)) {
      destination = join(archivedDir, `${Date.now()}-${basename(source)}`);
    }

    renameSync(source, destination);

    const index = new InboxIndex(workspace.path);
    try {
      index.removeFile(source);
    } finally {
      index.close();
    }

    return {
      original: relative(workspace.path, source),
      archived: relative(workspace.path, destination),
      workspace: name,
    };
  }

  private collectMarkdownFiles(
    workspaceRoot: string,
    directory: string,
    excludedDirectories: string[] = [],
  ): KnowledgeFile[] {
    const entries = readdirSync(directory, { withFileTypes: true });
    const files: KnowledgeFile[] = [];

    for (const entry of entries) {
      const entryPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        if (excludedDirectories.includes(entry.name)) {
          continue;
        }

        files.push(...this.collectMarkdownFiles(workspaceRoot, entryPath, excludedDirectories));
        continue;
      }

      if (!entry.name.endsWith('.md')) {
        continue;
      }

      if (entry.name === 'index.md' || entry.name === '_index.md') {
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

function extractJinaTitle(content: string): string | null {
  const match = /^Title:\s*(.+)$/m.exec(content);
  return match ? match[1]!.trim() : null;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowISO(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSummary(content: string): string {
  const takeaways = /## Key Takeaways\s*\n([\s\S]*?)(?=\n##|$)/.exec(content);
  if (takeaways) {
    const bullet = /^[-*]\s+(.+)$/m.exec(takeaways[1]!);
    if (bullet) return bullet[1]!.trim().slice(0, 100).replace(/\|/g, '\\|');
  }

  const detail = /## Detail\s*\n([\s\S]*?)(?=\n##|$)/.exec(content);
  if (detail) return detail[1]!.trim().split('\n')[0]?.slice(0, 100).replace(/\|/g, '\\|') ?? '';

  return '';
}

function appendLog(logPath: string, entry: string): void {
  if (!existsSync(logPath)) {
    writeFileSync(logPath, '# Build Log\n\n', 'utf8');
  }

  const current = readFileSync(logPath, 'utf8');
  writeFileSync(logPath, current.trimEnd() + '\n\n' + entry + '\n', 'utf8');
}

function indexAddEntry(
  current: string | null,
  workspaceName: string,
  topic: string,
  ref: string,
  summary: string,
): string {
  const today = todayISO();
  const bullet = `- [[${ref}]] — ${summary}`;

  if (!current) {
    return [
      `# Master Index — ${workspaceName}`,
      ``,
      `**Last compiled:** ${today}`,
      ``,
      `## Topics`,
      ``,
      `### ${topic}`,
      bullet,
      ``,
    ].join('\n');
  }

  let text = current.replace(/\*\*Last compiled:\*\*\s*.+/, `**Last compiled:** ${today}`);

  const topicRegex = new RegExp(`(### ${escapeRegex(topic)}\\n[\\s\\S]*?)(?=\\n###|\\s*$)`);
  if (topicRegex.test(text)) {
    text = text.replace(topicRegex, (section) => section.trimEnd() + '\n' + bullet);
  } else {
    text = text.trimEnd() + `\n\n### ${topic}\n${bullet}\n`;
  }

  return text;
}

function indexUpdateEntry(current: string, ref: string, summary: string): string {
  const today = todayISO();

  let text = current.replace(/\*\*Last compiled:\*\*\s*.+/, `**Last compiled:** ${today}`);

  text = text.replace(
    new RegExp(`(- \\[\\[${escapeRegex(ref)}\\]\\] — ).+`),
    `$1${summary}`,
  );

  return text;
}
