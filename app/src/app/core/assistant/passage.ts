import { Lang } from './ports';
import { tokenise } from './tokenizer';

/** Markdown of the compendium → plain text (tables as "a · b · c" rows, lists as bullets). */
export function plainText(md: string | null | undefined): string {
  return (md ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^[\s|:-]*-{3,}[\s|:-]*$/gm, '') // table separator rows
    .replace(/^\s*\|\s*|\s*\|\s*$/gm, '')
    .replace(/\s*\|\s*/g, ' · ')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*+/g, '')
    .replace(/(^|\s)_+|_+(?=\s|$|[.,;:])/g, '$1')
    .replace(/^\s*[-+]\s+/gm, '• ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Paragraphs, long ones cut at sentence ends so that no piece passes `max` characters. */
function units(text: string, max: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n{2,}/)) {
    const p = para.trim();
    if (!p) continue;
    if (p.length <= max) {
      out.push(p);
      continue;
    }
    let cur = '';
    for (const sentence of p.split(/(?<=[.!?:;])\s+|\n/)) {
      if (cur && cur.length + sentence.length + 1 > max) {
        out.push(cur);
        cur = '';
      }
      // a sentence longer than max (a table row, a list): cut it
      for (let s = sentence; s; s = s.slice(max)) {
        if (s.length <= max) {
          cur = cur ? `${cur} ${s}` : s;
          break;
        }
        if (cur) {
          out.push(cur);
          cur = '';
        }
        out.push(s.slice(0, max));
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

/**
 * At most `budget` characters of `text`: all of it when it fits, otherwise the paragraphs that
 * mention the most query terms (the start when none does), in their original order, with "…"
 * where something was left out.
 */
export function bestPassage(
  text: string,
  queryTokens: string[],
  lang: Lang,
  budget: number,
): string {
  if (text.length <= budget) return text;
  const wanted = new Set(queryTokens);
  const parts = units(text, Math.max(200, Math.floor(budget / 3)));
  const scored = parts.map((p, i) => {
    const hit = new Set(tokenise(p, lang).filter((t) => wanted.has(t)));
    return { i, p, score: hit.size };
  });
  const order = [...scored].sort((a, b) => b.score - a.score || a.i - b.i);
  const chosen: typeof scored = [];
  let used = 0;
  for (const u of order) {
    if (used + u.p.length + 2 > budget) continue;
    chosen.push(u);
    used += u.p.length + 2;
  }
  chosen.sort((a, b) => a.i - b.i);
  let out = '';
  let prev = -1;
  for (const u of chosen) {
    out += (prev >= 0 && u.i !== prev + 1 ? '\n… ' : out ? '\n\n' : '') + u.p;
    prev = u.i;
  }
  if (chosen.length && chosen[0].i > 0) out = '… ' + out;
  return out.length > budget ? out.slice(0, budget - 1) + '…' : out;
}

/** A short passage (~`max` characters) around where the query terms are densest. */
export function snippetOf(text: string, queryTokens: string[], lang: Lang, max = 220): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const wanted = new Set(queryTokens);
  const words = flat.split(' ');
  // window of words with the most distinct query terms
  const size = Math.max(8, Math.round(max / 6));
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < words.length; i += 3) {
    const hit = new Set(
      tokenise(words.slice(i, i + size).join(' '), lang).filter((t) => wanted.has(t)),
    );
    if (hit.size > bestScore) {
      bestScore = hit.size;
      best = i;
    }
    if (bestScore === wanted.size) break;
  }
  if (bestScore <= 0) best = 0;
  else best = Math.max(0, best - 2);
  let out = words.slice(best).join(' ');
  if (out.length > max) {
    out = out.slice(0, max);
    out = out.slice(0, out.lastIndexOf(' ') > max / 2 ? out.lastIndexOf(' ') : max) + '…';
  }
  return (best > 0 ? '… ' : '') + out;
}
