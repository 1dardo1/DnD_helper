import { Character } from '../models/character';
import { Ability, Background, DndClass, Feat, Spell, Subclass } from '../models/compendium';
import { Sheet } from '../rules/sheet';
import { ABILITIES } from '../rules/tables';
import { SPECIES_SLOT, Step } from './creation-rules';
import { countsFor, spellCasters, spellsByClassOf } from './spell-choices';

/**
 * The live summary of the character being created: what is decided so far, read from the sheet
 * the rules engine computes and from the choices, in the form the wizard's summary panel and its
 * last step ("Revisar y crear") show it. Pure, so it is tested with the real compendium.
 */

export interface SummaryFeat {
  id: string;
  name: string;
  /** Where it comes from: the background, the species (Human's Versatile) or a class level. */
  from: 'background' | 'species' | 'class';
  /** Class feats: the class and its level that gave it. */
  classId?: string;
  level?: number;
}

export interface SummarySpells {
  classId: string;
  /** Picked for this class / what its table gives at its level (null = no fixed number). */
  cantrips: { chosen: number; max: number | null };
  prepared: { chosen: number; max: number | null };
  ability: Ability | null;
  saveDc: number | null;
  attack: number | null;
}

export interface WizardSummary {
  /** All six base scores are set. */
  abilitiesSet: boolean;
  /** Saving throws the character is proficient in. */
  saves: Ability[];
  /** Skills with proficiency (or Expertise), with their modifier. */
  skills: { id: string; modifier: number; expertise: boolean }[];
  feats: SummaryFeat[];
  spells: SummarySpells[];
  /** Inventory lines (the starting packages, purchases...). */
  items: number;
}

export interface SummaryContext {
  classes: ReadonlyMap<string, DndClass>;
  subclasses: ReadonlyMap<string, Subclass>;
  feats: ReadonlyMap<string, Feat>;
  spells: ReadonlyMap<string, Spell>;
  background?: Background;
}

export function summarize(ch: Character, sheet: Sheet, ctx: SummaryContext): WizardSummary {
  const base = ch.abilityScores?.base;
  const feats: SummaryFeat[] = [];
  const bgFeat = ctx.background?.featId ? ctx.feats.get(ctx.background.featId) : undefined;
  if (bgFeat) feats.push({ id: bgFeat.id, name: bgFeat.name, from: 'background' });
  for (const s of ch.choices.featSlots) {
    const feat = s.featId ? ctx.feats.get(s.featId) : undefined;
    if (!feat) continue;
    if (s.slot === SPECIES_SLOT) {
      feats.push({ id: feat.id, name: feat.name, from: 'species' });
      continue;
    }
    const [classId, level] = s.slot.split(':');
    feats.push({ id: feat.id, name: feat.name, from: 'class', classId, level: Number(level) });
  }
  feats.sort((a, b) => order(a) - order(b) || (a.level ?? 0) - (b.level ?? 0));

  const casters = spellCasters(ch, ctx.classes, ctx.subclasses);
  const by = spellsByClassOf(ch.choices, casters, ctx.spells);
  const spells = casters.map((caster) => {
    const n = countsFor(by, caster, ctx.spells);
    const sc = sheet.spellcasting.classes.find((k) => k.classId === caster.classId);
    return {
      classId: caster.classId,
      cantrips: { chosen: n.cantrips, max: caster.cantrips },
      prepared: { chosen: n.leveled, max: caster.prepared },
      ability: sc?.ability ?? null,
      saveDc: sc?.saveDc ?? null,
      attack: sc?.attack ?? null,
    };
  });

  return {
    abilitiesSet: !!base && ABILITIES.every((a) => base[a] > 0),
    saves: ABILITIES.filter((a) => sheet.savingThrows[a].proficient),
    skills: sheet.skills
      .filter((s) => s.proficiency === 'full' || s.proficiency === 'expertise')
      .map((s) => ({ id: s.id, modifier: s.modifier, expertise: s.proficiency === 'expertise' })),
    feats,
    spells,
    items: ch.inventory.length,
  };
}

const order = (f: SummaryFeat) => ({ background: 0, species: 1, class: 2 })[f.from];

/** The parts of the summary and the steps where they are decided (to mark them "pending"). */
export const SUMMARY_STEPS = {
  identity: ['class', 'background', 'species'],
  abilities: ['abilities'],
  proficiencies: ['background', 'species', 'choices'],
  feats: ['background', 'species', 'choices'],
  spells: ['spells'],
  equipment: ['equipment'],
} as const satisfies Record<string, readonly Step[]>;
