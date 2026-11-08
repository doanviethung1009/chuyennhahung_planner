import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Documentation is a product surface here, so it is enforced the way the
 * message catalogues are: every document exists in both languages, keeps the
 * same structure in both, and is registered in an index.
 *
 * See CLAUDE.md "Documentation" and docs/README.md.
 */
const root = resolve(import.meta.dirname, '..');
const docsDir = resolve(root, 'docs');

/** Sections every feature document must carry, in the English original. */
const FEATURE_SECTIONS = [
  'Summary',
  'Routes',
  'Data',
  'How it works',
  'Files',
  'Tests',
  'Limits and open questions',
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return path.endsWith('.md') ? [path] : [];
  });
}

const allDocs = walk(docsDir).sort();
const rel = (path: string) => relative(root, path);

const isVietnamese = (path: string) => path.endsWith('.vi.md');
const twinOf = (path: string) =>
  isVietnamese(path) ? path.replace(/\.vi\.md$/, '.md') : path.replace(/\.md$/, '.vi.md');

const englishDocs = allDocs.filter((path) => !isVietnamese(path));
const read = (path: string) => readFileSync(path, 'utf8');

/** Heading depths, in order, ignoring fenced code blocks. */
function headingSkeleton(source: string): number[] {
  const depths: number[] = [];
  let inFence = false;

  for (const line of source.split('\n')) {
    if (line.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^(#{1,6})\s+\S/.exec(line);
    if (match) depths.push(match[1]!.length);
  }

  return depths;
}

/** `## Heading` texts, ignoring fenced code blocks. */
function sections(source: string): string[] {
  const out: string[] = [];
  let inFence = false;

  for (const line of source.split('\n')) {
    if (line.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (match) out.push(match[1]!);
  }

  return out;
}

/** Every markdown link target in the document. */
function linkTargets(source: string): string[] {
  return [...source.matchAll(/\]\(([^)\s]+)\)/g)].map((match) => match[1]!);
}

const featureDocs = englishDocs.filter(
  (path) =>
    dirname(path) === resolve(docsDir, 'features') &&
    !basename(path).startsWith('README') &&
    !basename(path).startsWith('_'),
);

describe('documentation', () => {
  it('has at least the core documents and one feature document', () => {
    for (const path of ['README.md', 'architecture.md', 'usage.md']) {
      expect(existsSync(resolve(docsDir, path)), `docs/${path} is missing`).toBe(true);
    }
    expect(featureDocs.length).toBeGreaterThan(0);
  });

  it('ships every document in Vietnamese as well as English', () => {
    for (const path of allDocs) {
      const twin = twinOf(path);
      expect(
        existsSync(twin),
        `${rel(path)} has no counterpart at ${rel(twin)}`,
      ).toBe(true);
    }
  });

  it('keeps the same heading structure in both languages', () => {
    for (const path of englishDocs) {
      expect(
        headingSkeleton(read(twinOf(path))),
        `${rel(twinOf(path))} does not mirror the structure of ${rel(path)}`,
      ).toEqual(headingSkeleton(read(path)));
    }
  });

  it('starts every document with a single top-level heading', () => {
    for (const path of allDocs) {
      const depths = headingSkeleton(read(path));
      expect(depths[0], `${rel(path)} does not start with an h1`).toBe(1);
      expect(
        depths.filter((depth) => depth === 1).length,
        `${rel(path)} has more than one h1`,
      ).toBe(1);
    }
  });

  it('links each document to its translation', () => {
    for (const path of allDocs) {
      const twin = basename(twinOf(path));
      expect(
        linkTargets(read(path)),
        `${rel(path)} does not link to ${twin}`,
      ).toContain(twin);
    }
  });

  it('gives every feature document the required sections', () => {
    const template = resolve(docsDir, 'features/_template.md');
    for (const path of [...featureDocs, template]) {
      expect(sections(read(path)), `${rel(path)} is missing a section`).toEqual(
        FEATURE_SECTIONS,
      );
    }
  });

  it('registers every feature document in the feature index', () => {
    const indexes = {
      en: read(resolve(docsDir, 'features/README.md')),
      vi: read(resolve(docsDir, 'features/README.vi.md')),
    };

    for (const path of featureDocs) {
      const name = basename(path);
      expect(
        linkTargets(indexes.en),
        `${name} is not listed in docs/features/README.md`,
      ).toContain(name);
      expect(
        linkTargets(indexes.vi),
        `${basename(twinOf(path))} is not listed in docs/features/README.vi.md`,
      ).toContain(basename(twinOf(path)));
    }
  });

  it('registers every core document and ADR in its index', () => {
    const docsIndex = linkTargets(read(resolve(docsDir, 'README.md')));
    for (const path of englishDocs) {
      if (dirname(path) !== docsDir || basename(path) === 'README.md') continue;
      expect(
        docsIndex,
        `${basename(path)} is not listed in docs/README.md`,
      ).toContain(basename(path));
    }

    const adrIndex = linkTargets(read(resolve(docsDir, 'adr/README.md')));
    for (const path of englishDocs) {
      if (dirname(path) !== resolve(docsDir, 'adr')) continue;
      if (basename(path).startsWith('README') || basename(path).startsWith('_')) continue;
      expect(
        adrIndex,
        `${basename(path)} is not listed in docs/adr/README.md`,
      ).toContain(basename(path));
    }
  });

  it('points every relative link at something that exists', () => {
    for (const path of allDocs) {
      for (const target of linkTargets(read(path))) {
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        const [pathPart] = target.split('#');
        if (!pathPart) continue;

        const resolved = resolve(dirname(path), pathPart);
        expect(
          existsSync(resolved),
          `${rel(path)} links to "${target}", which does not exist`,
        ).toBe(true);
      }
    }
  });
});
