/**
 * Strips long book-reference tables out of a feature's markdown before it goes on the PDF. Some
 * features (the Artificer's Replicate Magic Item is the clearest case) come straight from the book
 * with a table listing *every* option that exists at that level, with a Yes/No column such as
 * Attunement — dozens of lines that do not depend on the character at all. What the player needs on
 * the sheet is what their own character knows (computed elsewhere), not the whole book table, so
 * this drops any two-column table shaped like that (and the heading that only introduced it) while
 * leaving the rest of the feature's text, and any other table, untouched.
 */

const TABLE_ROW = /^\|(.+)\|$/;
const SEPARATOR_ROW = /^\|[\s:-]+\|[\s:-]+\|$/;
const HEADING = /^#{1,6}\s/;

/** Short boolean-ish column values this trims on, English and Spanish, accents ignored. */
const BOOLEAN_VALUES = new Set(['yes', 'no', 'varies', 'si', 'varia']);

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function isBooleanValue(s: string): boolean {
  return BOOLEAN_VALUES.has(stripAccents(s.trim().toLowerCase()));
}

/** A two-column markdown table row ("| Name | Value |"), trimmed; null if not that shape. */
function twoCols(line: string): [string, string] | null {
  const m = TABLE_ROW.exec(line.trim());
  if (!m) return null;
  const cols = m[1].split('|');
  return cols.length === 2 ? [cols[0].trim(), cols[1].trim()] : null;
}

/** Data rows a table needs before it counts as a reference table worth dropping. */
const MIN_ROWS = 3;

export function stripReferenceTables(markdown: string): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (twoCols(lines[i]) && SEPARATOR_ROW.test((lines[i + 1] ?? '').trim())) {
      let j = i + 2;
      let rows = 0;
      while (j < lines.length) {
        const row = twoCols(lines[j]);
        if (!row || !isBooleanValue(row[1])) break;
        rows++;
        j++;
      }
      if (rows >= MIN_ROWS) {
        // the heading right above (if any) only introduced this table: drop it too
        while (out.length && !out[out.length - 1].trim()) out.pop();
        if (out.length && HEADING.test(out[out.length - 1].trim())) out.pop();
        i = j;
        while (i < lines.length && !lines[i].trim()) i++;
        continue;
      }
    }
    out.push(lines[i]);
    i++;
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
