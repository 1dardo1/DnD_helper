import { Character } from '../models/character';
import {
  Ability,
  Background,
  DndClass,
  Feat,
  Feature,
  Item,
  Species,
  Subclass,
} from '../models/compendium';
import { Bonus, Sheet, SheetFeature } from './sheet';
import { ABILITIES, MULTICLASS_SLOTS, SKILL_ABILITY, modifier, proficiencyBonus } from './tables';

/** The compendium entries the engine looks things up in, by id. */
export interface RulesData {
  classes: Map<string, DndClass>;
  subclasses: Map<string, Subclass>;
  species: Map<string, Species>;
  backgrounds: Map<string, Background>;
  feats: Map<string, Feat>;
  items: Map<string, Item>;
}

/** Progression columns that are spellcasting, not class resources. */
const SPELL_COLUMNS =
  /^(\d(st|nd|rd|th)|cantrips( known)?|prepared spells|spells known|spell slots|slot level)$/i;

/**
 * Computes the character sheet. Pure: same character + same data → same sheet.
 * The data is already adapted to the 2024 rules by the scraper, so no edition logic here.
 */
export function computeSheet(ch: Character, data: RulesData): Sheet {
  const warnings: string[] = [];
  const find = <T>(
    map: Map<string, T>,
    id: string | null | undefined,
    what: string,
  ): T | undefined => {
    if (!id) return undefined;
    const found = map.get(id);
    if (!found) warnings.push(`${what} "${id}" is not in the compendium`);
    return found;
  };

  // -- what the character is made of ---------------------------------------------------
  const classes = ch.classes
    .map((c) => ({
      ...c,
      cls: find(data.classes, c.id, 'Class'),
      sub: find(data.subclasses, c.subclassId, 'Subclass'),
    }))
    .filter((c): c is typeof c & { cls: DndClass } => !!c.cls);
  const totalLevel = classes.reduce((n, c) => n + c.level, 0);
  const pb = proficiencyBonus(totalLevel);
  const species = find(data.species, ch.species?.id, 'Species');
  const background = find(data.backgrounds, ch.background?.id, 'Background');
  // background origin feat + feats taken at ASI / Fighting Style / Epic Boon levels + any other
  const slotFeats = (ch.choices.featSlots ?? [])
    .map((s) => s.featId)
    .filter((id): id is string => !!id);
  const featIds = [
    ...new Set([
      ...(background?.featId ? [background.featId] : []),
      ...slotFeats,
      ...ch.choices.feats,
    ]),
  ];
  const feats = featIds.map((id) => find(data.feats, id, 'Feat')).filter((f): f is Feat => !!f);

  // -- features ------------------------------------------------------------------------
  const features: SheetFeature[] = [];
  for (const c of classes) {
    features.push(
      ...gained(c.cls.features, c.level, { type: 'class', id: c.cls.id, name: c.cls.name }),
    );
    if (c.sub)
      features.push(
        ...gained(c.sub.features, c.level, { type: 'subclass', id: c.sub.id, name: c.sub.name }),
      );
    if (!c.sub && c.level >= c.cls.subclassLevel)
      warnings.push(`${c.cls.name}: no ${c.cls.subclassTitle} chosen`);
  }
  if (species) {
    features.push(
      ...gained(species.traits, totalLevel, {
        type: 'species',
        id: species.id,
        name: species.name,
      }),
    );
    const variant = species.variants.find((v) => v.name === ch.species?.variant);
    if (variant) {
      features.push({
        name: variant.name,
        level: 1,
        source: { type: 'species', id: species.id, name: species.name },
        description: variant.description,
      });
      features.push(
        ...gained(variant.traits, totalLevel, {
          type: 'species',
          id: species.id,
          name: variant.name,
        }),
      );
    }
  }
  for (const f of feats) {
    features.push({
      name: f.name,
      level: 1,
      source: { type: 'feat', id: f.id, name: f.name },
      description: f.description,
    });
  }
  const has = (name: string) => features.some((f) => f.name.toLowerCase() === name.toLowerCase());

  // -- abilities -----------------------------------------------------------------------
  const epicSources = new Set(feats.filter((f) => f.category === 'epic-boon').map((f) => f.id));
  const abilities = {} as Sheet['abilities'];
  for (const a of ABILITIES) {
    const base = ch.abilityScores?.base[a] ?? 10;
    const bonuses: Bonus[] = [];
    const bg = ch.background?.abilityIncreases[a];
    if (bg) bonuses.push({ source: background?.name ?? 'Background', amount: bg });
    let cap = 20;
    for (const inc of ch.choices.abilityIncreases.filter((i) => i.ability === a)) {
      bonuses.push({ source: data.feats.get(inc.source)?.name ?? inc.source, amount: inc.amount });
      if (epicSources.has(inc.source)) cap = 30;
    }
    const raised = bonuses.reduce((n, b) => n + b.amount, base);
    const score = Math.min(raised, Math.max(cap, base));
    abilities[a] = { score, modifier: modifier(score), base, bonuses };
  }
  const mod = (a: Ability) => abilities[a].modifier;

  // -- saves, skills, initiative -------------------------------------------------------
  const saveProf = new Set<Ability>([...(classes[0]?.cls.savingThrows ?? []), ...ch.choices.saves]);
  const savingThrows = {} as Sheet['savingThrows'];
  for (const a of ABILITIES) {
    savingThrows[a] = {
      proficient: saveProf.has(a),
      modifier: mod(a) + (saveProf.has(a) ? pb : 0),
    };
  }
  const proficient = new Set([...(background?.skills ?? []), ...ch.choices.skills]);
  const expertise = new Set(ch.choices.expertise);
  const jack = has('Jack of All Trades');
  const skills = Object.entries(SKILL_ABILITY).map(([id, ability]) => {
    const level: Sheet['skills'][number]['proficiency'] = expertise.has(id)
      ? 'expertise'
      : proficient.has(id)
        ? 'full'
        : jack
          ? 'half'
          : 'none';
    const bonus = { none: 0, half: Math.floor(pb / 2), full: pb, expertise: pb * 2 }[level];
    return { id, ability, proficiency: level, modifier: mod(ability) + bonus };
  });
  const perception = skills.find((s) => s.id === 'perception')!.modifier;
  // 2024 Alert: "Initiative Proficiency"
  const alert = feats.some((f) => /initiative proficiency/i.test(f.description));
  const initiative = mod('DEX') + (alert ? pb : 0);

  // -- hit points ----------------------------------------------------------------------
  let hpMax = 0;
  classes.forEach((c, i) => {
    for (let lvl = 0; lvl < c.level; lvl++) {
      const rolled = c.hp[lvl];
      const gainedHp =
        i === 0 && lvl === 0 ? c.cls.hitDie : (rolled ?? Math.floor(c.cls.hitDie / 2) + 1);
      hpMax += Math.max(gainedHp + mod('CON'), 1);
    }
  });
  if (feats.some((f) => f.id === 'tough')) hpMax += 2 * totalLevel;
  if (has('Dwarven Toughness')) hpMax += totalLevel;
  const dice = new Map<number, number>();
  for (const c of classes) dice.set(c.cls.hitDie, (dice.get(c.cls.hitDie) ?? 0) + c.level);

  // -- armor class and speed -------------------------------------------------------------
  const armor = find(data.items, ch.equipped.armorId, 'Armor')?.armor;
  const shield = ch.equipped.shield ? 2 : 0;
  let armorClass: Sheet['armorClass'];
  if (armor && armor.kind !== 'shield' && armor.baseAC !== null) {
    const dex = armor.dexCap === null ? mod('DEX') : Math.min(mod('DEX'), armor.dexCap);
    armorClass = {
      value: armor.baseAC + dex + shield,
      formula: `${armor.baseAC} + DEX${shield ? ' + shield' : ''}`,
    };
  } else if (has('Unarmored Defense') && classes.some((c) => c.cls.id === 'monk') && !shield) {
    armorClass = { value: 10 + mod('DEX') + mod('WIS'), formula: '10 + DEX + WIS' };
  } else if (has('Unarmored Defense')) {
    armorClass = {
      value: 10 + mod('DEX') + mod('CON') + shield,
      formula: `10 + DEX + CON${shield ? ' + shield' : ''}`,
    };
  } else {
    armorClass = {
      value: 10 + mod('DEX') + shield,
      formula: `10 + DEX${shield ? ' + shield' : ''}`,
    };
  }

  const speed: Record<string, number> = { ...(species?.speed ?? { walk: 30 }) };
  if (has('Fast Movement') && armor?.kind !== 'heavy') speed['walk'] += 10;
  const monk = classes.find((c) => c.cls.id === 'monk');
  if (monk && !armor && !shield) {
    const bonus = parseInt(
      monk.cls.progression.rows[monk.level - 1]?.values['Unarmored Movement'] ?? '',
      10,
    );
    if (bonus) speed['walk'] += bonus;
  }

  // -- spellcasting --------------------------------------------------------------------
  const casters = classes.filter((c) => c.cls.spellcasting);
  const spellClasses = casters.map((c) => {
    const sc = c.cls.spellcasting!;
    const ability = sc.ability ?? c.cls.primaryAbility[0] ?? 'INT';
    return {
      classId: c.cls.id,
      ability,
      saveDc: 8 + pb + mod(ability),
      attack: pb + mod(ability),
      cantrips: sc.cantripsByLevel?.[c.level - 1] ?? null,
      prepared: sc.preparedByLevel?.[c.level - 1] ?? null,
    };
  });
  const slotCasters = casters.filter((c) => c.cls.spellcasting!.kind !== 'pact');
  let slots = Array(9).fill(0);
  if (slotCasters.length === 1) {
    const c = slotCasters[0];
    slots = [...(c.cls.spellcasting!.slotsByLevel[c.level - 1] ?? slots)];
  } else if (slotCasters.length > 1) {
    const casterLevel = slotCasters.reduce((n, c) => {
      const kind = c.cls.spellcasting!.kind;
      return (
        n +
        (kind === 'full'
          ? c.level
          : kind === 'half'
            ? Math.ceil(c.level / 2)
            : kind === 'third'
              ? Math.floor(c.level / 3)
              : 0)
      );
    }, 0);
    if (casterLevel > 0) slots = [...MULTICLASS_SLOTS[Math.min(casterLevel, 20) - 1]];
  }
  const pactClass = casters.find((c) => c.cls.spellcasting!.kind === 'pact');
  let pact: Sheet['spellcasting']['pact'] = null;
  if (pactClass) {
    const row = pactClass.cls.spellcasting!.slotsByLevel[pactClass.level - 1] ?? [];
    const idx = row.findIndex((n) => n > 0);
    if (idx >= 0) pact = { slots: row[idx], level: idx + 1 };
  }

  // -- class resources -----------------------------------------------------------------
  const resources = classes.flatMap((c) =>
    c.cls.progression.columns
      .filter((col) => !SPELL_COLUMNS.test(col))
      .map((col) => ({
        classId: c.cls.id,
        name: col,
        value: c.cls.progression.rows[c.level - 1]?.values[col] ?? '',
      }))
      .filter((r) => r.value && r.value !== '-'),
  );

  const first = classes[0]?.cls;
  return {
    name: ch.name,
    totalLevel,
    proficiencyBonus: pb,
    classes: classes.map((c) => ({
      id: c.cls.id,
      name: c.cls.name,
      level: c.level,
      subclass: c.sub?.name ?? null,
    })),
    species: species?.name ?? null,
    background: background?.name ?? null,
    abilities,
    savingThrows,
    skills,
    passivePerception: 10 + perception,
    initiative,
    hitPoints: {
      max: hpMax,
      current: ch.state.hpCurrent ?? hpMax,
      temp: ch.state.hpTemp,
      hitDice: [...dice.entries()].map(([die, count]) => ({ die, count })),
    },
    armorClass,
    speed,
    darkvision: species?.darkvision ?? null,
    size: species?.size ?? [],
    spellcasting: { classes: spellClasses, slots, pact },
    proficiencies: {
      armor: first?.proficiencies.armor ?? [],
      weapons: first?.proficiencies.weapons ?? [],
      tools: [
        ...(first?.proficiencies.tools ?? []),
        ...(background?.tools ? [background.tools] : []),
      ],
    },
    resources,
    features,
    warnings,
  };
}

function gained(list: Feature[], level: number, source: SheetFeature['source']): SheetFeature[] {
  return list
    .filter((f) => f.level <= level)
    .map((f) => ({ name: f.name, level: f.level, source, description: f.description }));
}
