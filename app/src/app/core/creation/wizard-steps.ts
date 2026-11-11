import { Note, STEPS, Step, StepNotes } from './creation-rules';

/**
 * How the creation wizard shows its progress: which steps it has, the state of each one, and where
 * each note of review() (creation-rules.ts) is solved (the step and the part of it, so a tap on
 * "elige 2 habilidades" lands on the skills). Pure: the wizard and its tests share it.
 */

/**
 * todo: something still to choose (or nothing chosen yet); warn: complete but with a requirement
 * not met; done: complete; optional: nothing required and nothing chosen (it can be skipped).
 */
export type StepState = 'todo' | 'warn' | 'done' | 'optional';

export interface StepView {
  id: Step;
  state: StepState;
  missing: Note[];
  issues: Note[];
}

/** Steps with nothing required: the equipment can be written later on the sheet. */
export const OPTIONAL_STEPS: readonly Step[] = ['equipment'];

/** The steps this character goes through: the spells step only when one of its classes casts. */
export function wizardSteps(hasCasters: boolean): Step[] {
  return STEPS.filter((s) => s !== 'spells' || hasCasters);
}

export function stepState(notes: readonly Note[], optional: boolean, filled: boolean): StepState {
  if (notes.some((n) => n.kind === 'missing')) return 'todo';
  if (!filled) return optional ? 'optional' : 'todo';
  if (notes.some((n) => n.kind === 'issue')) return 'warn';
  return 'done';
}

/**
 * The state of every step. `filled` tells whether anything was chosen in a step (equipment: a
 * package or an item; class choices and spells: a class to choose for).
 */
export function stepViews(
  steps: readonly Step[],
  notes: StepNotes,
  filled: (s: Step) => boolean,
): StepView[] {
  return steps.map((id) => {
    const list = notes[id] ?? [];
    return {
      id,
      state: stepState(list, OPTIONAL_STEPS.includes(id), filled(id)),
      missing: list.filter((n) => n.kind === 'missing'),
      issues: list.filter((n) => n.kind === 'issue'),
    };
  });
}

/** Steps complete (done, or optional and skipped) out of all. */
export function progressOf(views: readonly StepView[]): { done: number; total: number } {
  return {
    done: views.filter((v) => v.state === 'done' || v.state === 'warn').length,
    total: views.length,
  };
}

/** Where a note is solved: a step and the `data-anchor` of the part of it to scroll to. */
export interface NoteTarget {
  step: Step;
  anchor: string;
}

const ANCHORS: Record<string, string> = {
  'create.missing.class': 'class',
  'create.missing.subclass': 'subclass',
  'create.issue.levelCap': 'class',
  'create.issue.multiclassEstimated': 'class',
  'create.issue.multiclassUnknown': 'class',
  'create.missing.background': 'background',
  'create.missing.backgroundIncreases': 'bg-increases',
  'create.missing.species': 'species',
  'create.missing.variant': 'variant',
  'create.missing.traitChoice': 'species-traits',
  'create.missing.traitPick': 'species-traits',
  'create.missing.speciesAbility': 'species-ability',
  'create.missing.size': 'size',
  'create.missing.languages': 'languages',
  'create.issue.tooManyLanguages': 'languages',
  'create.issue.rareLanguage': 'languages',
  'create.missing.speciesFeat': 'species-feat',
  'create.missing.abilities': 'abilities',
  'create.missing.pointBuy': 'abilities',
  'create.missing.hpRoll': 'hp',
  'create.missing.skills': 'skills',
  'create.issue.tooManySkills': 'skills',
  'create.missing.weaponMasteries': 'masteries',
  'create.issue.tooManyWeaponMasteries': 'masteries',
  'create.missing.feats': 'feats',
  'create.issue.featLevel': 'feats',
  'create.issue.featAbility': 'feats',
  'create.issue.featSpecies': 'feats',
  'create.issue.featSpellcasting': 'feats',
  'create.issue.featProficiency': 'feats',
  'create.missing.cantrips': 'spells',
  'create.missing.spells': 'spells',
  'create.issue.tooManyCantrips': 'spells',
  'create.issue.tooManySpells': 'spells',
  'create.missing.name': 'name',
};

/**
 * Where to go to solve a note listed in `step`. A multiclass requirement (INT 13...) is listed with
 * the classes but is met by raising the scores; what a feat asks goes to that feat.
 */
export function noteTarget(note: Note, step: Step): NoteTarget {
  if (note.key === 'create.issue.multiclass') return { step: 'abilities', anchor: 'abilities' };
  if (note.key.startsWith('create.missing.feat.'))
    return {
      step,
      anchor: step === 'background' ? 'bg-feat' : step === 'species' ? 'species-feat' : 'feats',
    };
  if (note.key === 'create.missing.tools' || note.key === 'create.issue.tooManyTools')
    return { step, anchor: step === 'background' ? 'bg-tools' : 'tools' };
  return { step, anchor: ANCHORS[note.key] ?? step };
}

export interface PendingNote {
  note: Note;
  target: NoteTarget;
}

/** Everything still to do or flagged, step by step (in the wizard's order), with its target. */
export function pendingBySteps(
  steps: readonly Step[],
  notes: StepNotes,
): { step: Step; items: PendingNote[] }[] {
  return steps
    .map((step) => ({
      step,
      items: (notes[step] ?? []).map((note) => ({ note, target: noteTarget(note, step) })),
    }))
    .filter((g) => g.items.length > 0);
}
