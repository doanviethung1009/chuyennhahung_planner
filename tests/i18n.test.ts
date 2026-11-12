import { describe, expect, it } from 'vitest';
import en from '../messages/en.json';
import vi from '../messages/vi.json';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

const viFlat = flatten(vi as Tree);
const enFlat = flatten(en as Tree);

/** ICU placeholders like {count}; ignores the `{'...'}` escape form. */
function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)[^}]*\}/g)]
    .map((match) => match[1]!)
    .sort();
}

describe('message catalogues', () => {
  it('define exactly the same keys in both locales', () => {
    expect(Object.keys(enFlat).sort()).toEqual(Object.keys(viFlat).sort());
  });

  it('has no empty or whitespace-only value', () => {
    for (const [locale, flat] of [
      ['vi', viFlat],
      ['en', enFlat],
    ] as const) {
      for (const [key, value] of Object.entries(flat)) {
        expect(value.trim(), `${locale}.${key} is empty`).not.toBe('');
      }
    }
  });

  it('uses the same ICU placeholders in both locales', () => {
    for (const key of Object.keys(viFlat)) {
      expect(placeholders(enFlat[key]!), `placeholders differ for "${key}"`).toEqual(
        placeholders(viFlat[key]!),
      );
    }
  });

  it('keeps Vietnamese as the untranslated-string canary', () => {
    // A Vietnamese value copied verbatim into English is almost always an
    // untranslated string. Brand names are the legitimate exception.
    const allowed = new Set([
      'home.hero.eyebrow',
      'locale.vi',
      'locale.en',
      'footer.aboutHeading',
      // Language names are written in their own language in both catalogues.
      'adminContent.form.langVi',
    ]);

    const copied = Object.keys(viFlat).filter(
      (key) =>
        !allowed.has(key) &&
        viFlat[key] === enFlat[key] &&
        /[ăâđêôơưĂÂĐÊÔƠƯàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/.test(
          viFlat[key]!,
        ),
    );

    expect(copied).toEqual([]);
  });
});
