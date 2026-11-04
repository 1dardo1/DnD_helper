import { Character } from '../models/character';
import { DndClass, Spell, Subclass } from '../models/compendium';
import { castingOf } from '../rules/engine';

/**
 * Which class each spell was chosen for.
 *
 * `choices.spells` is the flat list of spell ids the character has (what the older versions of the
 * app wrote, and what anything that only asks "does it know this spell?" reads).
 * `choices.spellsByClass` records the class every pick belongs to, so a Cantrip taken as an
 * Artificer and the same Cantrip taken as a Warlock are two picks (one per class allowance), not
 * one pick counted twice. The same spell can therefore appear under two classes; the flat list
 * has it once. Everything that changes spells goes through this module so both stay in step.
 */
export type SpellsByClass = Record<string, string[]>;

/** Spells whose class could not be told (no caster of the character has them on its list). */
export const UNASSIGNED = '*';

/** What a class can pick: its spell list and the allowance of each kind (null = no limit known). */
export interface SpellCaster {
  classId: string;
  /** The class whose spell list it uses (its own, or the one its subclass names). */
  list: string;
  cantrips: number | null;
  prepared: number | null;
}

/** The casters among a character's classes, in the order of `ch.classes`. */
export function spellCasters(
  ch: Pick<Character, 'classes'>,
  classes: ReadonlyMap<string, DndClass>,
  subclasses: ReadonlyMap<string, Subclass>,
): SpellCaster[] {
  const out: SpellCaster[] = [];
  for (const entry of ch.classes) {
    const cls = classes.get(entry.id);
    if (!cls) continue;
    const sc = castingOf(cls, entry.subclassId ? subclasses.get(entry.subclassId) : undefined);
    if (!sc) continue;
    out.push({
      classId: cls.id,
      list: cls.spellcasting ? cls.id : (sc.spellList ?? cls.id),
      cantrips: sc.cantripsByLevel?.[entry.level - 1] ?? null,
      prepared: sc.preparedByLevel?.[entry.level - 1] ?? null,
    });
  }
  return out;
}

type SpellInfo = Pick<Spell, 'level' | 'classes'>;

const unique = (xs: readonly string[]) => [...new Set(xs)];

/** The flat list: every spell the character has once, in the order of its classes' picks. */
export function flatSpells(by: SpellsByClass): string[] {
  return unique(Object.values(by).flat());
}

/** The pair of fields to store: the per-class picks and the flat list derived from them. */
export function spellFields(by: SpellsByClass): {
  spells: string[];
  spellsByClass: SpellsByClass;
} {
  const clean: SpellsByClass = {};
  for (const [k, ids] of Object.entries(by)) if (ids.length) clean[k] = unique(ids);
  return { spells: flatSpells(clean), spellsByClass: clean };
}

/** The picks of one class. */
export function spellsOf(by: SpellsByClass, classId: string): string[] {
  return by[classId] ?? [];
}

/** Whether the spell is picked for this very class. */
export function isChosenFor(by: SpellsByClass, classId: string, id: string): boolean {
  return spellsOf(by, classId).includes(id);
}

/** The other classes the spell is picked for ("ya elegido como Brujo"). */
export function chosenForOthers(by: SpellsByClass, classId: string, id: string): string[] {
  return Object.keys(by).filter((k) => k !== classId && by[k].includes(id));
}

/** Picks (or un-picks) a spell for one class only; the other classes keep theirs. */
export function toggleSpellFor(
  by: SpellsByClass,
  classId: string,
  id: string,
  on: boolean,
): SpellsByClass {
  const mine = spellsOf(by, classId).filter((s) => s !== id);
  return { ...by, [classId]: on ? [...mine, id] : mine };
}

/** Swaps a pick of one class for another one, in the same place. Nothing if it can't. */
export function replaceSpellFor(
  by: SpellsByClass,
  classId: string,
  out: string,
  inn: string,
): SpellsByClass {
  const mine = spellsOf(by, classId);
  if (!out || !inn || out === inn || !mine.includes(out) || mine.includes(inn)) return by;
  return { ...by, [classId]: mine.map((s) => (s === out ? inn : s)) };
}

/** Forgets the picks of a class that was removed or changed. */
export function dropClassSpells(by: SpellsByClass, classId: string): SpellsByClass {
  const { [classId]: _gone, ...rest } = by;
  return rest;
}

/** How many of the class' picks are cantrips and how many are leveled spells. */
export function countsFor(
  by: SpellsByClass,
  caster: SpellCaster,
  spells: ReadonlyMap<string, SpellInfo>,
): { cantrips: number; leveled: number } {
  let cantrips = 0;
  let leveled = 0;
  for (const id of spellsOf(by, caster.classId)) {
    const sp = spells.get(id);
    if (!sp || !sp.classes.includes(caster.list)) continue;
    if (sp.level === 0) cantrips++;
    else leveled++;
  }
  return { cantrips, leveled };
}

/**
 * The per-class picks of a character: the stored ones, or (old characters, or a flat list edited
 * by an older version of the app) the ones worked out from the flat list. Never loses a spell.
 *
 * Working out the class of a spell the flat list has but no pick records (deterministic):
 *  1. a spell only one caster has on its list goes to that caster;
 *  2. a spell on several lists goes to the first of them (in class order) that still has room for
 *     its kind (cantrip or leveled) in its allowance;
 *  3. if all are full, to the first of them; a spell on no caster's list goes under UNASSIGNED.
 */
export function spellsByClassOf(
  choices: Pick<Character['choices'], 'spells'> & { spellsByClass?: SpellsByClass },
  casters: readonly SpellCaster[],
  spells: ReadonlyMap<string, SpellInfo>,
): SpellsByClass {
  const flat = unique(choices.spells ?? []);
  const have = new Set(flat);
  const by: SpellsByClass = {};
  // what is stored, minus what the flat list no longer has
  for (const [k, ids] of Object.entries(choices.spellsByClass ?? {})) {
    const kept = unique(ids.filter((id) => have.has(id)));
    if (kept.length) by[k] = kept;
  }
  const recorded = new Set(Object.values(by).flat());
  const extra = flat.filter((id) => !recorded.has(id));
  if (!extra.length) return by;

  const kind = (id: string) => (spells.get(id)?.level === 0 ? 'cantrips' : 'prepared');
  const used = (c: SpellCaster, k: 'cantrips' | 'prepared') =>
    spellsOf(by, c.classId).filter((id) => kind(id) === k).length;
  const candidates = (id: string) => {
    const sp = spells.get(id);
    return sp ? casters.filter((c) => sp.classes.includes(c.list)) : [];
  };
  const put = (c: string, id: string) => (by[c] = [...(by[c] ?? []), id]);

  const shared: string[] = [];
  for (const id of extra) {
    const cs = candidates(id);
    if (!cs.length) put(UNASSIGNED, id);
    else if (cs.length === 1) put(cs[0].classId, id);
    else shared.push(id);
  }
  for (const id of shared) {
    const cs = candidates(id);
    const k = kind(id);
    const room = cs.find((c) => c[k] === null || used(c, k) < c[k]!);
    put((room ?? cs[0]).classId, id);
  }
  return by;
}

/** How many spells are picked for more than one class (one spell, a pick from each class). */
export function sharedCount(by: SpellsByClass): number {
  const seen = new Map<string, number>();
  for (const ids of Object.values(by)) for (const id of ids) seen.set(id, (seen.get(id) ?? 0) + 1);
  return [...seen.values()].filter((n) => n > 1).length;
}

/**
 * For every caster, the notes for the spells picked for ANOTHER class ("ya elegido como Brujo",
 * or "también" when it is picked for this one too). They are notes only: such a spell is not
 * selected, nor counted, in this class.
 */
export function spellMarks(
  by: SpellsByClass,
  casters: readonly SpellCaster[],
  className: (classId: string) => string,
  text: (alsoHere: boolean, classes: string) => string,
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const c of casters) {
    const names: Record<string, string[]> = {};
    for (const [other, ids] of Object.entries(by))
      if (other !== c.classId)
        for (const id of ids) (names[id] ??= []).push(other === UNASSIGNED ? '' : className(other));
    const mine = new Set(spellsOf(by, c.classId));
    out[c.classId] = Object.fromEntries(
      Object.entries(names).map(([id, cs]) => [
        id,
        text(mine.has(id), cs.filter(Boolean).join(', ')),
      ]),
    );
  }
  return out;
}
