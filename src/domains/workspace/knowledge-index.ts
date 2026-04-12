import { readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { SearchResults } from './workspace.types.js';
import { chunkMarkdown, normalizeFtsQuery } from './indexing.js';

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
  private readonly db: DatabaseSync;

  constructor(private readonly workspacePath: string) {
    const dbPath = join(workspacePath, '.knowledge-index.db');
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL');
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

    const insert = this.db.prepare('INSERT INTO chunks (path, heading, body, mtime) VALUES (?, ?, ?, ?)');

    this.db.exec('BEGIN');
    try {
      for (const chunk of chunks) {
        insert.run(path, chunk.heading ?? null, chunk.body, mtime);
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
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
