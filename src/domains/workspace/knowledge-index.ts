import Database from 'better-sqlite3';
import { readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { SearchResults } from './workspace.types.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS chunks (
    id       INTEGER PRIMARY KEY,
    path     TEXT NOT NULL,
    heading  TEXT,
    body     TEXT NOT NULL,
    mtime    INTEGER NOT NULL
  );
  CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
    path, heading, body,
    content='chunks', content_rowid='id'
  );
  CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
    INSERT INTO chunks_fts(rowid, path, heading, body)
    VALUES (new.id, new.path, new.heading, new.body);
  END;
  CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
    INSERT INTO chunks_fts(chunks_fts, rowid, path, heading, body)
    VALUES ('delete', old.id, old.path, old.heading, old.body);
  END;
  CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
    INSERT INTO chunks_fts(chunks_fts, rowid, path, heading, body)
    VALUES ('delete', old.id, old.path, old.heading, old.body);
    INSERT INTO chunks_fts(rowid, path, heading, body)
    VALUES (new.id, new.path, new.heading, new.body);
  END;
`;

export class KnowledgeIndex {
  private readonly db: Database.Database;

  constructor(private readonly workspacePath: string) {
    const dbPath = join(workspacePath, '.knowledge-index.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(SCHEMA);
  }

  indexFile(absPath: string): void {
    const path = relative(this.workspacePath, absPath);
    const mtime = statSync(absPath).mtimeMs;

    const existing = this.db
      .prepare('SELECT mtime FROM chunks WHERE path = ? LIMIT 1')
      .get(path) as { mtime: number } | undefined;

    if (existing && existing.mtime === mtime) return;

    this.db.prepare('DELETE FROM chunks WHERE path = ?').run(path);

    const raw = readFileSync(absPath, 'utf8');
    const chunks = chunkMarkdown(raw);

    const insert = this.db.prepare(
      'INSERT INTO chunks (path, heading, body, mtime) VALUES (?, ?, ?, ?)',
    );
    const insertMany = this.db.transaction((items: RawChunk[]) => {
      for (const chunk of items) insert.run(path, chunk.heading ?? null, chunk.body, mtime);
    });

    insertMany(chunks);
  }

  removeFile(absPath: string): void {
    const path = relative(this.workspacePath, absPath);
    this.db.prepare('DELETE FROM chunks WHERE path = ?').run(path);
  }

  search(query: string, limit = 10): SearchResults {
    const normalized = normalizeFtsQuery(query);
    if (!normalized) return { results: [] };

    const rows = this.db
      .prepare(`
        SELECT c.path, c.heading,
               snippet(chunks_fts, 2, '[', ']', '...', 16) AS excerpt
        FROM chunks_fts f
        JOIN chunks c ON c.id = f.rowid
        WHERE chunks_fts MATCH ?
        ORDER BY bm25(chunks_fts)
        LIMIT ?
      `)
      .all(normalized, limit) as Array<{
      path: string;
      heading: string | null;
      excerpt: string;
    }>;

    return {
      results: rows.map((row, index) => ({
        file: row.path,
        excerpt: row.heading ? `**${row.heading}**\n${row.excerpt}` : row.excerpt,
        score: 1 - index / Math.max(rows.length, 1),
      })),
    };
  }

  close(): void {
    this.db.close();
  }
}

interface RawChunk {
  heading: string | null;
  body: string;
}

function chunkMarkdown(content: string): RawChunk[] {
  const stripped = content.replace(/^---[\s\S]*?---\n?/, '');

  const cleaned = stripped
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  const lines = cleaned.split('\n');
  const chunks: RawChunk[] = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    const body = currentLines.join('\n').trim();
    if (!body) return;

    if (body.length > 1500) {
      const paragraphs = body.split(/\n{2,}/);
      let acc = '';
      for (const para of paragraphs) {
        if (acc.length + para.length > 1500 && acc.length > 0) {
          chunks.push({ heading: currentHeading, body: acc.trim() });
          acc = para;
        } else {
          acc = acc ? `${acc}\n\n${para}` : para;
        }
      }

      if (acc.trim()) chunks.push({ heading: currentHeading, body: acc.trim() });
    } else {
      chunks.push({ heading: currentHeading, body });
    }

    currentLines = [];
  };

  for (const line of lines) {
    const headingMatch = /^(#{1,3})\s+(.+)/.exec(line);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[2]!.trim();
    } else {
      currentLines.push(line);
    }
  }

  flush();

  return chunks;
}

function normalizeFtsQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-zA-Z0-9_]/g, ''))
    .filter((token) => token.length > 0)
    .map((token) => `${token}*`)
    .join(' ');
}
