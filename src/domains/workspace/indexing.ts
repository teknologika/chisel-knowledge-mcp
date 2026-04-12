export interface RawChunk {
  heading: string | null;
  body: string;
}

export function chunkMarkdown(content: string): RawChunk[] {
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

export function normalizeFtsQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-zA-Z0-9_]/g, ''))
    .filter((token) => token.length > 0)
    .map((token) => `${token}*`)
    .join(' ');
}
