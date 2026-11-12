import type { FeatureNote } from './feature-stats';
import type { SheetFeature } from './sheet';

/**
 * States the player switches on and off during play (Rage, Wild Shape, a Hex on a target...).
 * The list is closed: each state comes from one text of the compendium, and the `anchor` of its
 * definition is the sentence that says what it does or how long it lasts (a spec checks it
 * against data/*.json). The character keeps the ids that are on in `state.active` (Wild Shape
 * apart: `state.wildShape` says which form); the engine works out what each one changes.
 */
export type ActiveStateId = 'rage' | 'wildShape' | 'hex' | 'huntersMark' | 'innateSorcery';

export interface ActiveStateDef {
  id: ActiveStateId;
  /** The class feature that gives it, or the spell. */
  feature?: { cls: string; name: string };
  spell?: string;
  /** Sentence of the text that says how long it lasts (checked by a spec). */
  anchor: RegExp;
  /** The counter switching it on spends (PlayResource name), if any. */
  spends?: string;
  /**
   * Rests that end it: it can't outlast them (Rage: 10 minutes; Hex, Hunter's Mark: up to 1
   * hour; Innate Sorcery: 1 minute). Wild Shape lasts hours: play-state.ts compares its hours.
   */
  endsOn: ('short' | 'long')[];
}

export const ACTIVE_STATES: readonly ActiveStateDef[] = [
  {
    id: 'rage',
    feature: { cls: 'barbarian', name: 'Rage' },
    anchor: /You can maintain a Rage for up to 10 minutes/,
    spends: 'Rages',
    endsOn: ['short', 'long'],
  },
  {
    id: 'wildShape',
    feature: { cls: 'druid', name: 'Wild Shape' },
    anchor: /You stay in that form for a number of hours equal to half your Druid level/,
    spends: 'Wild Shape',
    endsOn: [],
  },
  {
    id: 'hex',
    spell: 'hex',
    anchor: /extra 1d6 Necrotic damage to the target whenever you hit it with an attack roll/,
    endsOn: ['short', 'long'],
  },
  {
    id: 'huntersMark',
    spell: 'hunters-mark',
    anchor: /extra 1d6 Force damage to the target whenever you hit it with an attack roll/,
    endsOn: ['short', 'long'],
  },
  {
    id: 'innateSorcery',
    feature: { cls: 'sorcerer', name: 'Innate Sorcery' },
    anchor: /unleash that magic for 1 minute/,
    spends: 'Innate Sorcery',
    endsOn: ['short', 'long'],
  },
];

export const ACTIVE_STATE_IDS = new Set<string>(ACTIVE_STATES.map((d) => d.id));

/** A state the character can switch, as the sheet shows it. */
export interface SheetActiveState {
  id: ActiveStateId;
  /** English name of the feature or spell it comes from. */
  source: string;
  /** Switched on by the player (state.active / state.wildShape). */
  on: boolean;
  /**
   * Switched on, but the text says it has ended: Rage with Heavy armor donned or with the
   * Incapacitated condition (Unconscious only, from Persistent Rage). Its effects don't apply.
   */
  ended: 'heavyArmor' | 'incapacitated' | 'unconscious' | null;
  /** The counter it spends when switched on. */
  spends?: string;
}

/** Conditions that include Incapacitated (2024 rules glossary). */
const INCAPACITATING = ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious'];

export interface ActiveStatesInput {
  features: Pick<SheetFeature, 'name' | 'source' | 'level'>[];
  classes: { id: string; level: number }[];
  /** Spell ids the character has. */
  spells: ReadonlySet<string>;
  /** state.active, state.wildShape and the conditions of the character. */
  active: readonly string[] | undefined;
  wildShape: unknown;
  conditions: readonly string[];
  heavyArmor: boolean;
}

const hasFeature = (input: ActiveStatesInput, cls: string, name: string) =>
  input.features.some((f) => f.name === name && f.source.type === 'class' && f.source.id === cls);

/** The states this character can switch on, and which of them are on. */
export function activeStatesOf(input: ActiveStatesInput): SheetActiveState[] {
  const on = new Set(input.active ?? []);
  const out: SheetActiveState[] = [];
  for (const def of ACTIVE_STATES) {
    let source: string | null = null;
    if (def.feature && hasFeature(input, def.feature.cls, def.feature.name))
      source = def.feature.name;
    // Hunter's Mark is always prepared with the Ranger's Favored Enemy
    if (def.id === 'huntersMark' && hasFeature(input, 'ranger', 'Favored Enemy'))
      source = "Hunter's Mark";
    if (def.spell && input.spells.has(def.spell))
      source = def.id === 'hex' ? 'Hex' : "Hunter's Mark";
    if (!source) continue;
    const isOn = def.id === 'wildShape' ? !!input.wildShape : on.has(def.id);
    let ended: SheetActiveState['ended'] = null;
    if (isOn && def.id === 'rage') {
      // "it ends early if you don Heavy armor or have the Incapacitated condition"; Persistent
      // Rage (Barbarian 15): "ends early if you have the Unconscious condition ... or don Heavy armor"
      const persistent = hasFeature(input, 'barbarian', 'Persistent Rage');
      if (input.heavyArmor) ended = 'heavyArmor';
      else if (persistent && input.conditions.includes('unconscious')) ended = 'unconscious';
      else if (!persistent && input.conditions.some((c) => INCAPACITATING.includes(c)))
        ended = 'incapacitated';
    }
    out.push({
      id: def.id,
      source,
      on: isOn,
      ended,
      ...(def.spends ? { spends: def.spends } : {}),
    });
  }
  return out;
}

/** The state is on and its effects apply. */
export const stateOn = (states: readonly SheetActiveState[] | undefined, id: ActiveStateId) =>
  !!states?.some((s) => s.id === id && s.on && !s.ended);

/**
 * Notes and stats of the features that only hold while a state is on (the text says "while your
 * Rage is active", "Until the spell ends"...): the id of the note → the state.
 */
export const NOTE_WHILE: Record<string, ActiveStateId> = {
  rage: 'rage',
  frenzy: 'rage',
  divineFury: 'rage',
  fanaticalFocus: 'rage',
  relentlessRage: 'rage',
  hex: 'hex',
  huntersMark: 'huntersMark',
  innateSorcery: 'innateSorcery',
  lunarForm: 'wildShape',
};

/** Marks each note with the state it depends on (FeatureNote.while). */
export function tagNotes(notes: FeatureNote[]): void {
  for (const n of notes) {
    const w = NOTE_WHILE[n.id];
    if (w) n.while = w;
  }
}

/** Damage types Rage gives Resistance to ("Bludgeoning, Piercing, and Slashing damage"). */
export const RAGE_RESISTANCES = ['bludgeoning', 'piercing', 'slashing'];
