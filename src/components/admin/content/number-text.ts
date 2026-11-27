/**
 * Reads what an editor typed into a number box of the content forms.
 *
 * A native `type="number"` box hands back `''` for text the browser dislikes and
 * reads `50.000` as fifty in some locales, so a Vietnamese editor's "50.000 đ"
 * was saved as 50 or as nothing. These boxes are plain text instead, and this
 * reads them: thousands groups are removed from whole numbers, a decimal comma
 * becomes a point, and anything else stays a string so the form can say so.
 */
export type NumberText = number | string | null;

const GROUPED = /^-?\d{1,3}(?:[.,]\d{3})+$/;
const DECIMAL = /^-?\d+(?:\.\d+)?$/;

export function parseNumberText(text: string, integer: boolean): NumberText {
  const trimmed = text.replace(/[\s ]/g, '').replace(/[₫đĐ]|vnd$/i, '');
  if (trimmed === '') return null;
  // "50.000" / "1,250,000": whole đồng with separators, never a fraction.
  if (integer && GROUPED.test(trimmed)) return Number(trimmed.replace(/[.,]/g, ''));
  const point = /^-?\d+,\d+$/.test(trimmed) ? trimmed.replace(',', '.') : trimmed;
  return DECIMAL.test(point) ? Number(point) : text;
}

/** Text shown for a stored value: the raw string the editor typed, or the number. */
export function numberToText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}
