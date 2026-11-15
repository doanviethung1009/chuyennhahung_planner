import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { isRunbookDoc } from '@/server/runbook/docs';

/**
 * A small Markdown renderer for the repository's own runbooks (admin-only
 * page). It builds React elements — never HTML strings — so nothing in a
 * document can inject markup or script. Supported: headings, paragraphs,
 * lists, tables, fenced code, blockquotes, rules, and inline code, bold and
 * links. A link is kept only when it is `http(s)` or points at another
 * allow-listed runbook; any other target is shown as plain text.
 */

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'code'; lang: string; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'rule' }
  | { kind: 'paragraph'; text: string };

const PIPE = '\u0000';

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed
    .replace(/\\\|/g, PIPE)
    .split('|')
    .map((cell) => cell.replaceAll(PIPE, '|').trim());
}

const isDivider = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    const fence = /^```\s*([\w-]*)/.exec(line);
    if (fence) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) {
        body.push(lines[i] ?? '');
        i += 1;
      }
      i += 1;
      blocks.push({ kind: 'code', lang: fence[1] ?? '', text: body.join('\n') });
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1]!.length, text: heading[2]!.trim() });
      i += 1;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ kind: 'rule' });
      i += 1;
      continue;
    }

    if (line.includes('|') && isDivider(lines[i + 1] ?? '')) {
      const head = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && (lines[i] ?? '').includes('|') && (lines[i] ?? '').trim()) {
        rows.push(splitRow(lines[i] ?? ''));
        i += 1;
      }
      blocks.push({ kind: 'table', head, rows });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] ?? '')) {
        body.push((lines[i] ?? '').replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ kind: 'quote', text: body.join(' ').trim() });
      continue;
    }

    const listMatch = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(line);
    if (listMatch) {
      const ordered = /\d/.test(listMatch[1]!);
      const items: string[] = [];
      while (i < lines.length) {
        const current = lines[i] ?? '';
        const item = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(current);
        if (item) {
          items.push(item[2]!);
          i += 1;
        } else if (/^\s{2,}\S/.test(current) && items.length) {
          items[items.length - 1] += ` ${current.trim()}`;
          i += 1;
        } else break;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }

    const body: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() &&
      !/^(#{1,6}\s|```|>|\s*([-*]|\d+\.)\s)/.test(lines[i] ?? '') &&
      !((lines[i] ?? '').includes('|') && isDivider(lines[i + 1] ?? ''))
    ) {
      body.push((lines[i] ?? '').trim());
      i += 1;
    }
    if (body.length === 0) {
      // A line no rule above claimed: consume it so the loop always advances.
      body.push(line.trim());
      i += 1;
    }
    blocks.push({ kind: 'paragraph', text: body.join(' ') });
  }
  return blocks;
}

/** The runbook a relative `.md` link points at, or `null` when it is not an allow-listed one. */
export function runbookTarget(href: string): string | null {
  const path = href.split('#')[0] ?? '';
  const match = /(?:^|\/)([\w-]+?)(?:\.vi)?\.md$/.exec(path);
  const stem = match?.[1];
  return stem && isRunbookDoc(stem) ? stem : null;
}

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|\[((?:[^[\]`]|`[^`]*`)+)\]\(([^)\s]+)\)/g;

function renderInline(text: string, keyBase: string, allowLinks = true): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    const key = `${keyBase}-${n++}`;
    if (match[1]) {
      out.push(
        <code key={key} className="rounded-sm bg-surface-muted px-1.5 py-0.5 font-mono text-[0.9em] break-words">
          {match[1].slice(1, -1)}
        </code>,
      );
    } else if (match[2]) {
      out.push(<strong key={key}>{renderInline(match[2].slice(2, -2), key, allowLinks)}</strong>);
    } else {
      const label = match[3] ?? '';
      const href = match[4] ?? '';
      const inner = renderInline(label, key, false);
      const doc = runbookTarget(href);
      if (allowLinks && /^https?:\/\//.test(href)) {
        out.push(
          <a key={key} href={href} rel="noopener noreferrer" target="_blank" className="text-primary-strong underline underline-offset-2">
            {inner}
          </a>,
        );
      } else if (allowLinks && doc) {
        out.push(
          <Link
            key={key}
            href={{ pathname: '/admin/runbook', query: { doc } }}
            className="text-primary-strong underline underline-offset-2"
          >
            {inner}
          </Link>,
        );
      } else {
        out.push(<span key={key}>{inner}</span>);
      }
    }
    last = index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, tableLabel }: { source: string; tableLabel: string }) {
  const blocks = parseMarkdown(source);
  return (
    <div className="grid gap-4 leading-relaxed">
      {blocks.map((block, index) => {
        const key = `b${index}`;
        switch (block.kind) {
          case 'heading': {
            // The page owns the single <h1>; a document's `#` becomes an h2.
            const level = Math.min(block.level + 1, 6);
            const Tag = `h${level}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
            const size = level <= 2 ? 'text-2xl' : level === 3 ? 'text-xl' : 'text-lg';
            return (
              <Tag key={key} className={`font-display ${size} mt-4 font-semibold`}>
                {renderInline(block.text, key)}
              </Tag>
            );
          }
          case 'code':
            return (
              <pre
                key={key}
                tabIndex={0}
                className="overflow-x-auto rounded-md border border-border-subtle bg-surface-muted p-4 text-sm"
              >
                <code className="font-mono">{block.text}</code>
              </pre>
            );
          case 'table':
            return (
              <div key={key} tabIndex={0} role="region" aria-label={tableLabel} className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr>
                      {block.head.map((cell, c) => (
                        <th key={c} scope="col" className="border-b border-border-strong px-3 py-2 font-semibold">
                          {renderInline(cell, `${key}h${c}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r} className="border-b border-border-subtle align-top">
                        {row.map((cell, c) => (
                          <td key={c} className="px-3 py-2">
                            {renderInline(cell, `${key}r${r}c${c}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'list': {
            const Tag = block.ordered ? 'ol' : 'ul';
            return (
              <Tag key={key} className={`grid gap-1.5 pl-6 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>
                {block.items.map((item, k) => (
                  <li key={k}>{renderInline(item, `${key}i${k}`)}</li>
                ))}
              </Tag>
            );
          }
          case 'quote':
            return (
              <blockquote key={key} className="border-l-4 border-primary pl-4 text-foreground-muted">
                {renderInline(block.text, key)}
              </blockquote>
            );
          case 'rule':
            return <hr key={key} className="border-border-subtle" />;
          default:
            return <p key={key}>{renderInline(block.text, key)}</p>;
        }
      })}
    </div>
  );
}
