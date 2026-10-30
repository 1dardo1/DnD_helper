import { DndClass } from '../models/compendium';

/** What a class grants when it isn't the starting class (2024 "As a Multiclass Character"). */
export interface MulticlassGains {
  armor: string[];
  weapons: string[];
  tools: string[];
  /** One extra skill: from the class list, from any skill, or none. */
  skill: 'list' | 'any' | null;
  /** One Musical Instrument of your choice (Bard). */
  instrument: boolean;
  /** False when the class has no multiclass text (e.g. 2014 classes): nothing is known. */
  known: boolean;
  /** True when the data only estimates it (no text nor manual entry in the scraper). */
  estimated: boolean;
}

/**
 * Reads the first bullet of the class's multiclass text, e.g. "Gain the following traits from the
 * Core Ranger Traits table: Hit Point Die, proficiency with Martial weapons, proficiency in one
 * skill of your choice from the Ranger's skill list, training with Light and Medium Armor and Shields."
 */
export function multiclassGains(cls: DndClass): MulticlassGains {
  // The scraper already resolves it (text, its multiclass.yaml table, or an estimate).
  const g = cls.multiclass.gains;
  if (g) {
    const { origin, ...rest } = g;
    return { ...rest, known: true, estimated: origin === 'estimate' };
  }
  return fromText(cls);
}

/** Older data without multiclass.gains: read the text here. */
function fromText(cls: DndClass): MulticlassGains {
  const text =
    (cls.multiclass.proficienciesGained ?? '').split(/\n|- Gain the \w[\w ]*'s level 1/)[0] ?? '';
  const gains: MulticlassGains = {
    armor: [],
    weapons: [],
    tools: [],
    skill: null,
    instrument: false,
    known: !!text.trim(),
    estimated: false,
  };
  const training = text.match(/training with ([^.]*?)(?:\.|$)/i)?.[1] ?? '';
  for (const kind of ['Light', 'Medium', 'Heavy']) {
    if (new RegExp(`\\b${kind}\\b`, 'i').test(training)) gains.armor.push(`${kind} armor`);
  }
  if (/shields?/i.test(training)) gains.armor.push('Shields');
  if (/martial weapons/i.test(text)) gains.weapons.push('Martial weapons');
  for (const tool of ["Thieves' Tools", "Tinker's Tools"]) {
    if (new RegExp(tool.replace("'", "['’]"), 'i').test(text)) gains.tools.push(tool);
  }
  if (/one skill of your choice from the [\w ']+ skill list/i.test(text)) gains.skill = 'list';
  else if (/one skill of your choice/i.test(text)) gains.skill = 'any';
  gains.instrument = /one musical instrument/i.test(text);
  return gains;
}
