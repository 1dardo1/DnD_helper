/** Text helpers for the PDF export (pure: no DOM, no PDF library). */

export type PdfColor = 'ink' | 'muted' | 'accent' | 'tint' | 'white' | 'line' | 'soft';

/** A piece of a line with its own style (a bold name followed by plain text). */
export interface Seg {
  t: string;
  b?: boolean;
  c?: PdfColor;
}

/** Width in points of a text at a size; the renderer uses the real font, tests an estimate. */
export type Measure = (text: string, size: number, bold: boolean) => number;

const WIN_1252_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

const REPLACEMENTS: Record<string, string> = {
  '→': '->',
  '←': '<-',
  '↔': '<->',
  '≤': '<=',
  '≥': '>=',
  '≠': '!=',
  '≈': '~',
  '−': '-',
  '‐': '-',
  '‑': '-',
  '‒': '-',
  '―': '-',
  '✦': '*',
  '✓': 'v',
  '✔': 'v',
  '✗': 'x',
  '●': '•',
  '○': 'o',
  '◆': '•',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅛': '1/8',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
  '​': '',
  '‍': '',
  '️': '',
  '\t': ' ',
};

/**
 * The text as the PDF's standard fonts (WinAnsi: Latin-1 plus the usual typographic signs) can
 * write it. Accents and ñ pass through; arrows, ≤ and similar get an ASCII form; a letter with a
 * mark that Latin-1 lacks loses the mark; anything else becomes "?".
 */
export function toWinAnsi(text: string): string {
  let out = '';
  for (const ch of text.normalize('NFC')) {
    const code = ch.codePointAt(0)!;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) out += ch;
    else if (WIN_1252_EXTRA.has(ch)) out += ch;
    else if (ch in REPLACEMENTS) out += REPLACEMENTS[ch];
    else {
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      out += base.length && base.charCodeAt(0) < 0x7f && base.charCodeAt(0) >= 0x20 ? base : '?';
    }
  }
  return out;
}

/** Markdown of the game texts as plain paragraphs (lists with a bullet, table rows with bars). */
export function plainText(md: string): string[] {
  const out: string[] = [];
  for (const raw of md.replace(/\r/g, '').split('\n')) {
    let l = raw.trim();
    if (!l) continue;
    if (/^[\s:|-]+$/.test(l) && l.includes('-')) continue; // table separator / rule
    if (l.startsWith('|')) {
      l = l
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean)
        .join(' | ');
    }
    l = l
      .replace(/^#{1,6}\s*/, '')
      .replace(/^[-*+]\s+/, '• ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/(\*\*|__)(.+?)\1/g, '$2')
      .replace(/(^|[\s(])[*_]([^*_\s][^*_]*?)[*_](?=$|[\s).,;:!?])/g, '$1$2')
      .replace(/\s+/g, ' ')
      .trim();
    if (l) out.push(l);
  }
  return out;
}

/** The first sentence of a text and whether there is more after it. */
export function firstSentence(paragraphs: string[]): { text: string; more: boolean } {
  const first = paragraphs[0] ?? '';
  const m = /^(.+?[.!?])(?=\s|$)/.exec(first);
  const text = m ? m[1] : first;
  return { text, more: text.length < first.length || paragraphs.length > 1 };
}

export function segsWidth(segs: Seg[], size: number, measure: Measure): number {
  return segs.reduce((n, s) => n + measure(s.t, size, !!s.b), 0);
}

/** Breaks styled text into lines no wider than `width` (a word wider than that is cut). */
export function wrapSegs(segs: Seg[], width: number, size: number, measure: Measure): Seg[][] {
  const lines: Seg[][] = [];
  let line: Seg[] = [];
  let w = 0;
  const push = (t: string, s: Seg) => {
    const last = line[line.length - 1];
    if (last && last.b === s.b && last.c === s.c) last.t += t;
    else line.push({ t, b: s.b, c: s.c });
  };
  const flush = () => {
    if (line.length) {
      const last = line[line.length - 1];
      last.t = last.t.replace(/\s+$/, '');
      lines.push(line);
    }
    line = [];
    w = 0;
  };
  for (const s of segs) {
    const bold = !!s.b;
    for (const token of s.t.split(/(\s+)/)) {
      if (!token) continue;
      if (/^\s+$/.test(token)) {
        if (!line.length) continue;
        const sw = measure(' ', size, bold);
        if (w + sw <= width) {
          push(' ', s);
          w += sw;
        }
        continue;
      }
      let word = token;
      let ww = measure(word, size, bold);
      if (w + ww > width && line.length) flush();
      while (ww > width && word.length > 1) {
        // a word wider than the line: cut it where it fits
        let n = word.length - 1;
        while (n > 1 && measure(word.slice(0, n), size, bold) > width) n--;
        push(word.slice(0, n), s);
        flush();
        word = word.slice(n);
        ww = measure(word, size, bold);
      }
      push(word, s);
      w += ww;
    }
  }
  flush();
  return lines;
}

/** One line of text in a width: shrinks it down to `min`, then cuts it with "…". */
export function fitText(
  text: string,
  width: number,
  size: number,
  min: number,
  measure: Measure,
  bold = false,
): { text: string; size: number; cut: boolean } {
  let s = size;
  while (s > min && measure(text, s, bold) > width) s = Math.max(min, +(s - 0.25).toFixed(2));
  if (measure(text, s, bold) <= width) return { text, size: s, cut: false };
  let t = text;
  while (t.length > 1 && measure(t + '…', s, bold) > width) t = t.slice(0, -1);
  return { text: t.trimEnd() + '…', size: s, cut: true };
}
