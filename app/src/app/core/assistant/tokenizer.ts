import { Lang } from './ports';

/** Lower case, no accents or diacritics: "Bola de Fuego" → "bola de fuego", "daño" → "dano". */
export function fold(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Function words that carry no meaning for a rules question. Folded like the text is.
const STOP_ES = fold(
  `a al algo ante antes aqui asi aun aunque cada como con contra cual cuales cuando cuanta cuantas
   cuanto cuantos de del desde donde dos el ella ellas ellos en entre era es esa esas ese eso esos esta
   estas este esto estos fue ha hace hacen hacer han hasta hay la las le les lo los mas me mi mis mucho
   muy ni no nos o os otra otras otro otros para pero poco por porque pues que quien quienes se sea
   segun ser si sin sobre son su sus tambien tan tanto te tengo tiene tienen todo todos tu tus un una
   uno unas unos usa usan usar uso va vez y ya yo puede pueden puedo podria debe deben`,
).split(/\s+/);

const STOP_EN = fold(
  `a about after all also am an and any are as at be been before but by can could did do does done for
   from get gets had has have he her his how i if in into is it its just may me might more most must my
   no not of on one only or other our out over own per s she should so some such than that the their
   them then there these they this those to too under up us was we were what when where which while who
   whom why will with would you your`,
).split(/\s+/);

const STOPWORDS: Record<Lang, ReadonlySet<string>> = {
  es: new Set(STOP_ES),
  en: new Set(STOP_EN),
};

const isVowel = (c: string) => 'aeiou'.includes(c);

/** Light Spanish stemmer: plural and gender/verb endings only (no lexicon, no library). */
function stemEs(w: string): string {
  if (w.length <= 3 || /\d/.test(w)) return w;
  if (w.endsWith('ciones')) w = w.slice(0, -6) + 'cion';
  else if (w.endsWith('ces')) w = w.slice(0, -3) + 'z';
  else if (w.length > 4 && w.endsWith('es') && !isVowel(w[w.length - 3])) w = w.slice(0, -2);
  else if (w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  if (w.length > 5 && /(ar|er|ir)$/.test(w)) return w.slice(0, -2);
  if (w.length > 4 && isVowel(w[w.length - 1])) return w.slice(0, -1);
  return w;
}

/** Light English stemmer: plural, -ing, -ed and a final -e. */
function stemEn(w: string): string {
  if (w.length <= 3 || /\d/.test(w)) return w;
  if (w.endsWith('ies') && w.length > 4) w = w.slice(0, -3) + 'y';
  else if (/(ss|x|z|ch|sh)es$/.test(w)) w = w.slice(0, -2);
  else if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  if (w.length > 4 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}

const STEMMERS: Record<Lang, (w: string) => string> = { es: stemEs, en: stemEn };

/**
 * Text → index terms: folded, split on anything that isn't a letter or digit, stopwords of the
 * language dropped, plural/ending stripped. Dice ("8d6") and numbers stay as they are.
 */
export function tokenise(text: string | null | undefined, lang: Lang): string[] {
  const out: string[] = [];
  const stop = STOPWORDS[lang];
  const stem = STEMMERS[lang];
  for (const raw of fold(text).split(/[^a-z0-9]+/)) {
    if (!raw || stop.has(raw)) continue;
    if (raw.length === 1 && !/\d/.test(raw)) continue;
    out.push(stem(raw));
  }
  return out;
}
