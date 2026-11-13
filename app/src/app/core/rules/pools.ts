import { SheetFeature } from './sheet';

/**
 * Pools of dice that a subclass feature gives (Psionic Energy Dice, the Zealot's d12s, the
 * Celestial Warlock's d6s). Their size and number are read from the text of the feature itself
 * (a table by level, "a pool of four d12s ... levels 6 (5 dice)...", "1 plus your Warlock
 * level"). The generic "uses" reader counts them as one use, which is wrong for a pool.
 */

export interface PoolDef {
  subclassId: string;
  /** English name of the feature that holds the text. */
  feature: string;
  /** English name of the resource (the key of its rest rule in play/rest-rules.ts). */
  name: string;
  /** Key of the UI text for the name of the resource ("play.res.psionicEnergyDice"). */
  labelKey: string;
  /** Class level that gives it. */
  from: number;
  /** Size and number of the dice at this class level, from the feature's text. */
  read: (text: string, level: number) => { die: string; count: number } | null;
}

const WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
};

/** "| 9 | D8 | 8 |" rows of the Energy Dice table: the last row at or below the level. */
export function energyDiceTable(text: string, level: number) {
  let best: { die: string; count: number } | null = null;
  for (const m of text.matchAll(/^\|\s*(\d+)\s*\|\s*(D\d+)\s*\|\s*(\d+)\s*\|/gim))
    if (Number(m[1]) <= level) best = { die: m[2].toLowerCase(), count: Number(m[3]) };
  return best;
}

/** "a pool of four d12s ... increases by one when you reach levels 6 (5 dice), 12 (6 dice)". */
function growingPool(text: string, level: number) {
  const start = /pool of (\w+) (d\d+)s/i.exec(text);
  if (!start || !(start[1].toLowerCase() in WORDS)) return null;
  let count = WORDS[start[1].toLowerCase()];
  for (const m of text.matchAll(/(\d+) \((\d+) dice\)/g))
    if (Number(m[1]) <= level) count = Number(m[2]);
  return { die: start[2].toLowerCase(), count };
}

export const POOLS: PoolDef[] = [
  {
    subclassId: 'rogue/soulknife',
    feature: 'Psionic Power',
    name: 'Psionic Energy Dice',
    labelKey: 'play.res.psionicEnergyDice',
    from: 3,
    read: energyDiceTable,
  },
  {
    subclassId: 'fighter/psi-warrior',
    feature: 'Psionic Power',
    name: 'Psionic Energy Dice',
    labelKey: 'play.res.psionicEnergyDice',
    from: 3,
    read: energyDiceTable,
  },
  {
    subclassId: 'barbarian/path-of-the-zealot',
    feature: 'Warrior of the Gods',
    name: 'Warrior of the Gods',
    labelKey: 'play.res.warriorOfTheGods',
    from: 3,
    read: growingPool,
  },
  {
    // "The number of dice in the pool equals 1 plus your Warlock level"
    subclassId: 'warlock/celestial-patron',
    feature: 'Healing Light',
    name: 'Healing Light',
    labelKey: 'play.res.healingLight',
    from: 3,
    read: (text, level) => {
      const m = /pool of (d\d+)s/i.exec(text);
      return m && /equals 1 plus your Warlock level/i.test(text)
        ? { die: m[1].toLowerCase(), count: 1 + level }
        : null;
    },
  },
  {
    // "| Fighter Level | Dice Size | Number |" table: "| 3 | D8 | 3 |" (the same shape as Psionic Power)
    subclassId: 'fighter/sorrow-knight',
    feature: 'Despairing Strikes',
    name: 'Despairing Strike Dice',
    labelKey: 'play.res.despairingStrikeDice',
    from: 3,
    read: energyDiceTable,
  },
];

export function poolFor(subclassId: string | null | undefined, feature: string) {
  return POOLS.find((p) => p.subclassId === subclassId && p.feature === feature);
}

/** The pools a character has: the feature must be on the sheet, at this class level. */
export function poolsOf(
  features: Pick<SheetFeature, 'name' | 'description' | 'source' | 'level'>[],
  classes: { id: string; level: number; subclassId?: string | null }[],
) {
  const out: { def: PoolDef; die: string; count: number; classId: string }[] = [];
  for (const c of classes) {
    for (const def of POOLS) {
      if (def.subclassId !== c.subclassId || c.level < def.from) continue;
      const f = features.find((x) => x.source.id === def.subclassId && x.name === def.feature);
      const dice = f ? def.read(f.description, c.level) : null;
      if (dice) out.push({ def, ...dice, classId: c.id });
    }
  }
  return out;
}
