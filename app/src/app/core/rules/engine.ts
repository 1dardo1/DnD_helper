import { Character, FeatChoice } from '../models/character';
import {
  Ability,
  Background,
  ClassOption,
  DndClass,
  Feat,
  Feature,
  Item,
  Species,
  SpeciesVariant,
  Spellcasting,
  Subclass,
} from '../models/compendium';
import { wornGear } from '../characters/magic-base';
import { isCustomId } from '../homebrew/custom-background';
import {
  FeatSource,
  FeatSpellGrant,
  RuleText,
  abilityRule,
  featList,
  featPicks,
  featRules,
  slug,
  listOfFeatName,
} from './feat-effects';
import { multiclassGains } from './multiclass';
import { featureNumbers } from './feature-stats';
import { poolFor } from './pools';
import { proficientWith } from './attacks';
import { resolveTraitChoice, traitChoiceKey } from './trait-choices';
import { TraitRules, traitRules } from './trait-effects';
import { Bonus, Sheet, SheetFeatSpell, SheetFeatUse, SheetFeature, SheetWarning } from './sheet';
import { ABILITIES, MULTICLASS_SLOTS, SKILL_ABILITY, modifier, proficiencyBonus } from './tables';

/** The compendium entries the engine looks things up in, by id. */
export interface RulesData {
  classes: Map<string, DndClass>;
  subclasses: Map<string, Subclass>;
  species: Map<string, Species>;
  backgrounds: Map<string, Background>;
  feats: Map<string, Feat>;
  items: Map<string, Item>;
  /** Class options (invocations, maneuvers, metamagic...); absent = none known. */
  options?: Map<string, ClassOption>;
}

/** Progression columns that are spellcasting, not class resources. */
const SPELL_COLUMNS =
  /^(\d(st|nd|rd|th)|cantrips( known)?|prepared spells|spells known|spell slots|slot level)$/i;

/**
 * Computes the character sheet. Pure: same character + same data → same sheet.
 * The data is already adapted to the 2024 rules by the scraper, so no edition logic here.
 */
export function computeSheet(ch: Character, data: RulesData): Sheet {
  const warnings: SheetWarning[] = [];
  const find = <T>(
    map: Map<string, T>,
    id: string | null | undefined,
    what: string,
  ): T | undefined => {
    if (!id) return undefined;
    const found = map.get(id);
    if (!found) {
      // a custom background that isn't on this device (not synced yet): say so, don't just fail
      const custom = what === 'background' && isCustomId(id);
      warnings.push({
        key: custom ? 'sheet.warn.customBackgroundMissing' : 'sheet.warn.notFound',
        params: { what, id },
      });
    }
    return found;
  };

  // -- what the character is made of ---------------------------------------------------
  const classes = ch.classes
    .map((c) => ({
      ...c,
      cls: find(data.classes, c.id, 'class'),
      sub: find(data.subclasses, c.subclassId, 'subclass'),
    }))
    .filter((c): c is typeof c & { cls: DndClass } => !!c.cls);
  const totalLevel = classes.reduce((n, c) => n + c.level, 0);
  const pb = proficiencyBonus(totalLevel);
  const species = find(data.species, ch.species?.id, 'species');
  const background = find(data.backgrounds, ch.background?.id, 'background');
  // background origin feat + the species' feat (Human's Versatile) + feats taken at ASI / Fighting
  // Style / Epic Boon levels + any other. Each remembers where it came from: its choices are kept
  // under that key (character.choices.featChoices).
  const featSources: FeatSource[] = [];
  const addFeat = (key: string, id: string | null | undefined, fixedList?: string) => {
    const feat = find(data.feats, id, 'feat');
    if (!feat) return;
    // only a repeatable feat (Magic Initiate) can be taken twice
    if (featSources.some((x) => x.feat.id === feat.id) && !feat.repeatable) return;
    featSources.push({ key, feat, fixedList });
  };
  addFeat('background', background?.featId, listOfFeatName(background?.feat));
  for (const s of ch.choices.featSlots ?? []) if (s.featId) addFeat(s.slot, s.featId);
  for (const id of ch.choices.feats) addFeat(`feat:${id}`, id);
  const feats = featSources.map((x) => x.feat);
  const choiceOf = (src: FeatSource): FeatChoice => ch.choices.featChoices?.[src.key] ?? {};

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
      warnings.push({
        key: 'sheet.warn.noSubclass',
        params: { cls: c.cls.name, title: c.cls.subclassTitle },
      });
  }
  // A trait whose text embeds its own choice (a lineage, a reprint's internal tribe/creed...):
  // resolve it against the character's pick before it's shown or read for spells/skills/uses.
  const resolveSpeciesTrait = (t: Feature, variantName: string | null): Feature => {
    const key = traitChoiceKey(species!.id, variantName, t.name);
    const r = resolveTraitChoice(t, key, ch.choices.traitChoices?.[key]);
    if (r.split && r.missing)
      warnings.push({ key: 'sheet.warn.traitChoiceMissing', params: { trait: t.name } });
    return r.split ? { ...t, description: r.text } : t;
  };
  if (species) {
    features.push(
      ...gained(
        species.traits.map((t) => resolveSpeciesTrait(t, null)),
        totalLevel,
        { type: 'species', id: species.id, name: species.name },
      ),
    );
    const variant = chosenVariant(species, ch.species?.variant);
    if (variant) {
      features.push({
        name: variant.name,
        level: 1,
        source: { type: 'species', id: species.id, name: species.name },
        description: variant.description,
      });
      features.push(
        ...gained(
          variant.traits.map((t) => resolveSpeciesTrait(t, variant.name)),
          totalLevel,
          { type: 'species', id: species.id, name: variant.name },
        ),
      );
    }
  }
  for (const src of featSources) {
    const f = src.feat;
    // Magic Initiate (Cleric) / Magic Initiate (Wizard): the same feat twice, told apart by its list
    const list = f.repeatable ? featList(src, choiceOf(src)) : null;
    const name =
      list && !f.name.includes('(')
        ? `${f.name} (${list[0].toUpperCase()}${list.slice(1)})`
        : f.name;
    features.push({
      name,
      level: 1,
      source: { type: 'feat', id: f.id, name },
      description: f.description,
    });
  }
  // chosen class options (invocations, maneuvers, metamagic...) are listed with the class
  const chosenOptions: { opt: ClassOption; classLevel: number; classId: string }[] = [];
  for (const id of ch.choices.options ?? []) {
    const opt = data.options?.get(id);
    const c = opt && classes.find((k) => k.cls.id === opt.classId);
    if (!opt || !c) continue;
    chosenOptions.push({ opt, classLevel: c.level, classId: c.cls.id });
    const sub = opt.subclassId ? data.subclasses.get(opt.subclassId) : undefined;
    features.push({
      name: opt.name,
      level: opt.prerequisites?.level ?? 1,
      source: sub
        ? { type: 'subclass', id: sub.id, name: sub.name }
        : { type: 'class', id: c.cls.id, name: c.cls.name },
      description: opt.description,
    });
  }
  const has = (name: string) => features.some((f) => f.name.toLowerCase() === name.toLowerCase());

  // -- what the text of every trait, feature, option and feat gives -----------------------------
  const traits = traitSources(
    classes,
    species,
    ch.species?.variant ?? null,
    totalLevel,
    chosenOptions,
    featSources,
    ch.choices.traitChoices,
  );
  const fx = (t: TraitSource): TraitRules => traitRules(t.text, { situational: t.situational });

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
  // Resilient: proficiency in the saving throw of the ability it raised
  for (const inc of ch.choices.abilityIncreases)
    if (inc.source === 'resilient') saveProf.add(inc.ability);
  for (const a of ABILITIES) {
    savingThrows[a] = {
      proficient: saveProf.has(a),
      modifier: mod(a) + (saveProf.has(a) ? pb : 0),
    };
  }
  const traitSkills = traits.flatMap((t) => fx(t).skills);
  const proficient = new Set([...(background?.skills ?? []), ...ch.choices.skills, ...traitSkills]);
  const expertise = new Set(ch.choices.expertise);
  // Feats that choose a single skill out of a closed list ("Acrobatics or Athletics", "Insight,
  // Investigation, or Perception"): only the chosen one applies. Keen Mind / Observant upgrade it
  // to Expertise instead when the character is already proficient from elsewhere.
  for (const src of featSources) {
    const picks = featPicks(src.feat);
    const chosen = choiceOf(src).skills ?? [];
    // Skilled: any mix of skills/tools, no closed list and no Expertise upgrade.
    if (picks.skillsOrTools) {
      for (const id of chosen) proficient.add(id);
      continue;
    }
    if (!picks.skills) continue;
    for (const id of chosen.slice(0, picks.skills.count)) {
      if (picks.skills.upgrade && proficient.has(id)) expertise.add(id);
      else proficient.add(id);
    }
  }
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
  const iniPb = alert || traits.some((t) => fx(t).initiative.pb);
  const iniAbilities = new Set(traits.flatMap((t) => fx(t).initiative.abilities));
  const initiative =
    mod('DEX') + (iniPb ? pb : 0) + [...iniAbilities].reduce((n, a) => n + mod(a), 0);

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
  // Tough (twice the level), Boon of Fortitude (+40): read from the feats' text
  for (const f of feats) hpMax += featRules(f).hpPerLevel * totalLevel + featRules(f).hpFlat;
  // Dwarven Toughness, Draconic Resilience...: "increases by N, and by M whenever you gain a level"
  for (const t of traits) {
    const g = fx(t).hpGrowth;
    if (g) hpMax += g.base + g.per * Math.max(0, t.scope - t.level);
  }
  const dice = new Map<number, number>();
  for (const c of classes) dice.set(c.cls.hitDie, (dice.get(c.cls.hitDie) ?? 0) + c.level);

  // -- armor class and speed -------------------------------------------------------------
  // magic armor (Armor +1, Armor of Resistance...) is worn as the base armor the player chose
  const worn = wornGear(ch, data.items);
  const armor = worn.armor;
  const shield = worn.shield;
  if (worn.unresolved)
    warnings.push({ key: 'sheet.warn.armorBase', params: { name: worn.unresolved } });
  const magic = worn.armorBonus + Math.max(0, shield - 2);
  const plus = magic ? ` + ${magic}` : '';
  let armorClass: Sheet['armorClass'];
  if (armor && armor.kind !== 'shield' && armor.baseAC !== null) {
    const dex = armor.dexCap === null ? mod('DEX') : Math.min(mod('DEX'), armor.dexCap);
    // Defense (+1 while wearing armor)
    const defense = feats.reduce((n, f) => n + featRules(f).ac, 0);
    armorClass = {
      value: armor.baseAC + worn.armorBonus + dex + shield + defense,
      // heavy armor adds no Dexterity; medium armor caps it
      formula: `${armor.baseAC}${armor.dexCap === 0 ? '' : armor.dexCap === null ? ' + DEX' : ` + DEX (max ${armor.dexCap})`}${plus}${shield ? ' + shield' : ''}${defense ? ` + ${defense}` : ''}`,
    };
  } else {
    // no armor: 10 + DEX, or the best "base Armor Class" a feature gives (Unarmored Defense,
    // Draconic Resilience...), or Mage Armor cast at will (Armor of Shadows)
    const alts = traits.flatMap((t) => fx(t).unarmored);
    const mageArmor = traits.some((t) =>
      featRules(t.text).spells.some((sp) => sp.id === 'mage-armor' && sp.atWill),
    );
    if (mageArmor) alts.push({ base: 13, abilities: ['DEX'], shield: true });
    const tail = `${plus}${shield ? ' + shield' : ''}`;
    armorClass = { value: 10 + mod('DEX') + shield, formula: `10 + DEX${tail}` };
    for (const u of alts) {
      if (!u.shield && shield) continue;
      const value = u.base + u.abilities.reduce((n, x) => n + mod(x), 0) + shield;
      if (value > armorClass.value)
        armorClass = { value, formula: `${u.base} + ${u.abilities.join(' + ')}${tail}` };
    }
  }

  const speed: Record<string, number> = { ...(species?.speed ?? { walk: 30 }) };
  // "Your Speed increases to 35 feet" (Wood Elf)
  speed['walk'] = Math.max(speed['walk'], ...traits.map((t) => fx(t).speedTo));
  // Fast Movement, Roving: lost in Heavy armor
  for (const t of traits)
    for (const b of fx(t).armorSpeed)
      if (b.unless === 'heavy' ? armor?.kind !== 'heavy' : !armor && !shield)
        speed['walk'] += b.amount;
  // Speedy (+10), Transmuted Anatomy (+5)
  speed['walk'] += feats.reduce((n, f) => n + featRules(f).speed, 0);
  const monk = classes.find((c) => c.cls.id === 'monk');
  if (monk && !armor && !shield) {
    const bonus = parseInt(
      monk.cls.progression.rows[monk.level - 1]?.values['Unarmored Movement'] ?? '',
      10,
    );
    if (bonus) speed['walk'] += bonus;
  }
  // Fly / Swim / Climb Speed ("equal to your Speed" or a number of feet)
  for (const t of traits)
    for (const m of fx(t).speeds) {
      const v = m.value === 'speed' ? speed['walk'] : m.value;
      speed[m.kind] = Math.max(speed[m.kind] ?? 0, v);
    }

  // -- senses --------------------------------------------------------------------------------
  const senses: Sheet['senses'] = [];
  if (species?.darkvision)
    senses.push({ kind: 'darkvision', range: species.darkvision, source: species.name });
  for (const t of traits)
    for (const x of fx(t).senses) {
      const have = senses.find((y) => y.kind === x.kind);
      if (!have) senses.push({ ...x, source: t.name });
      else if (x.range > have.range) Object.assign(have, { range: x.range, source: t.name });
    }
  const darkvision = senses.find((x) => x.kind === 'darkvision')?.range ?? null;

  // -- spellcasting --------------------------------------------------------------------
  // A class casts through its own table, or through its subclass's (Eldritch Knight, Profane Soul...).
  const casters = classes
    .map((c) => ({ ...c, sc: castingOf(c.cls, c.sub) }))
    .filter((c): c is typeof c & { sc: Spellcasting } => !!c.sc);
  const spellClasses = casters.map((c) => {
    const chosen = c.spellAbility && c.sc.abilityChoices?.includes(c.spellAbility);
    const ability = (chosen ? c.spellAbility : c.sc.ability) ?? c.cls.primaryAbility[0] ?? 'INT';
    return {
      classId: c.cls.id,
      ability,
      saveDc: 8 + pb + mod(ability),
      attack: pb + mod(ability),
      cantrips: c.sc.cantripsByLevel?.[c.level - 1] ?? null,
      prepared: c.sc.preparedByLevel?.[c.level - 1] ?? null,
    };
  });
  const slotCasters = casters.filter((c) => c.sc.kind !== 'pact');
  let slots = Array(9).fill(0);
  if (slotCasters.length === 1) {
    const c = slotCasters[0];
    slots = [...(c.sc.slotsByLevel[c.level - 1] ?? slots)];
  } else if (slotCasters.length > 1) {
    // Multiclass Spellcaster: full levels + half (rounded up) + a third (rounded down)
    const casterLevel = slotCasters.reduce((n, c) => {
      const kind = c.sc.kind;
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
  const pactCasters = casters.filter((c) => c.sc.kind === 'pact');
  let pact: Sheet['spellcasting']['pact'] = null;
  for (const c of pactCasters) {
    const row = c.sc.slotsByLevel[c.level - 1] ?? [];
    const idx = row.findIndex((n) => n > 0);
    // with two Pact Magic sources keep the better one (combining them isn't computed)
    if (idx >= 0 && (!pact || idx + 1 > pact.level)) pact = { slots: row[idx], level: idx + 1 };
  }
  if (pactCasters.length > 1) warnings.push({ key: 'sheet.warn.twoPacts' });

  // -- what the feats give: spells, uses, proficiencies ----------------------------------------
  const granted = featGrants(featSources, ch, abilities, pb, totalLevel);
  const fromTraits = traitGrants({
    traits,
    species,
    variantName: ch.species?.variant ?? null,
    subclasses: classes.flatMap((c) => (c.sub ? [{ sub: c.sub, level: c.level }] : [])),
    ch,
    abilities,
    spellAbility: (classId) => spellClasses.find((x) => x.classId === classId)?.ability,
    pb,
    totalLevel,
  });
  granted.spells.push(...fromTraits.spells);
  granted.uses.push(...fromTraits.uses);
  granted.missing.push(...fromTraits.missing);
  const resistances = [
    ...new Set([
      ...granted.resistances,
      ...traits.flatMap((t) => fx(t).resistances),
      ...fromTraits.resistances,
    ]),
  ];
  const traitTools = traits.flatMap((t) => fx(t).tools);

  // -- proficiencies (needed by Weapon Mastery below, as well as the sheet itself) -------------
  const profs = proficiencies(
    ch,
    classes.map((c) => c.cls),
    background,
    [...granted.tools, ...traitTools],
    featSources.flatMap((x) => featRules(x.feat).weapons),
    feats,
  );

  // -- fighting styles and class numbers that go into the attacks ------------------------------
  const combat = combatOf(
    classes,
    traits.map((t) => ({ t, r: fx(t) })),
    abilities,
    chosenOptions,
    profs.weapons,
    data.items,
    ch.choices.weaponMasteries ?? [],
    {
      features,
      pb,
      spellDc: (classId) => spellClasses.find((x) => x.classId === classId)?.saveDc ?? null,
      spells: new Set([...(ch.choices.spells ?? []), ...granted.spells.map((x) => x.id)]),
    },
  );
  if (combat.masterySlots > 0 && combat.masteryChosen.length < combat.masterySlots)
    warnings.push({ key: 'sheet.warn.weaponMastery' });

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

  return {
    name: ch.name,
    totalLevel,
    proficiencyBonus: pb,
    classes: classes.map((c) => ({
      id: c.cls.id,
      name: c.cls.name,
      level: c.level,
      subclass: c.sub?.name ?? null,
      subclassId: c.sub?.id ?? null,
    })),
    species: species?.name ?? null,
    background: background?.name ?? null,
    backgroundHomebrew: background?.custom
      ? background.dmApproved
        ? 'approved'
        : 'pending'
      : null,
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
    darkvision,
    senses: senses.filter((x) => x.kind !== 'darkvision'),
    size: ch.size ? [ch.size] : (species?.size ?? []),
    spellcasting: { classes: spellClasses, slots, pact },
    proficiencies: profs,
    // Common, the chosen ones, and those a feature teaches (Druid's Druidic, Rogue's Thieves' Cant)
    languages: [
      ...new Set([
        'Common',
        ...ch.choices.languages,
        ...FEATURE_LANGUAGES.filter((l) => features.some((f) => f.name === l)),
        ...granted.languages(ch.choices.languages),
      ]),
    ],
    resources,
    features,
    featSpells: granted.spells,
    featUses: granted.uses,
    resistances,
    combat,
    featMissing: granted.missing,
    warnings,
  };
}

/** Languages that come with a class feature of the same name. */
const FEATURE_LANGUAGES = ['Druidic', "Thieves' Cant"];

/** "Choose one kind of Gaming Set", "one type of Artisan's Tools of your choice"... */
export const TOOL_CHOICE = /choose|of your choice/i;

/**
 * Armor, weapons and tools: all of the starting class, what each later class grants when
 * multiclassing, the background's tool, and the tools picked where a choice was offered.
 */
function proficiencies(
  ch: Character,
  classes: DndClass[],
  background: Background | undefined,
  featTools: string[] = [],
  featWeapons: string[] = [],
  feats: Feat[] = [],
): Sheet['proficiencies'] {
  const [first, ...rest] = classes;
  const armor = [...(first?.proficiencies.armor ?? [])];
  const weapons = [...(first?.proficiencies.weapons ?? [])];
  const tools = [
    ...(first?.proficiencies.tools ?? []),
    ...(background?.tools ? [background.tools] : []),
  ].filter((t) => !TOOL_CHOICE.test(t));
  for (const cls of rest) {
    const g = multiclassGains(cls);
    armor.push(...g.armor);
    weapons.push(...g.weapons);
    tools.push(...g.tools);
  }
  tools.push(...ch.choices.toolChoices.flatMap((c) => c.tools), ...featTools);
  weapons.push(...featWeapons);
  // Lightly / Moderately / Heavily Armored, Martial Weapon Training, Chef, Poisoner
  for (const f of feats) {
    const t = f.description ?? '';
    for (const m of t.matchAll(/training with (Light|Medium|Heavy) armor( and Shields)?/gi)) {
      armor.push(`${m[1]} armor`);
      if (m[2]) armor.push('Shields');
    }
    if (/proficiency with Martial weapons/i.test(t)) weapons.push('Martial weapons');
    for (const tool of ["Cook's Utensils", "Poisoner's Kit"])
      if (new RegExp(`proficiency with ${tool}`, 'i').test(t)) tools.push(tool);
  }
  const unique = (xs: string[]) => [...new Map(xs.map((x) => [x.toLowerCase(), x])).values()];
  return {
    armor: unique(armor.flatMap(armorName)),
    weapons: unique(weapons.map(weaponName)),
    tools: unique(tools),
  };
}

/** Class tables write "Light", "Medium armor", "All armor"; the multiclass text "Light armor". */
function armorName(raw: string): string[] {
  const s = raw.trim();
  if (/^all armor/i.test(s)) return ['Light armor', 'Medium armor', 'Heavy armor'];
  const kind = s.match(/^(light|medium|heavy)\b/i)?.[1];
  if (kind) return [`${kind[0].toUpperCase()}${kind.slice(1).toLowerCase()} armor`];
  if (/^shields?$/i.test(s)) return ['Shields'];
  return [s];
}

/** "Simple" / "Martial" (from "Simple and Martial weapons") → "Simple weapons" / "Martial weapons". */
function weaponName(raw: string): string {
  const s = raw.trim();
  const kind = s.match(/^(all )?(simple|martial)( weapons)?$/i)?.[2];
  return kind ? `${kind[0].toUpperCase()}${kind.slice(1).toLowerCase()} weapons` : s;
}

/** The class's own spellcasting, or else its subclass's (only once the subclass is chosen). */
export function castingOf(cls: DndClass, sub: Subclass | undefined): Spellcasting | null {
  return cls.spellcasting ?? sub?.spellcasting ?? null;
}

function gained(list: Feature[], level: number, source: SheetFeature['source']): SheetFeature[] {
  return list
    .filter((f) => f.level <= level)
    .map((f) => ({ name: f.name, level: f.level, source, description: f.description }));
}

// -- feats ----------------------------------------------------------------------------------------

const SLOTLESS_FREE = /without (?:expending )?a spell slot/i;

/**
 * Everything the feats give besides their text: the spells (and the casting ability, DC and
 * attack of each), the counters of free casts and of "PB times per rest" benefits, the tools,
 * languages and damage resistances the player picked, and the choices not made yet.
 */
function featGrants(
  sources: FeatSource[],
  ch: Character,
  abilities: Sheet['abilities'],
  pb: number,
  totalLevel: number,
) {
  const spells: SheetFeatSpell[] = [];
  const uses: SheetFeatUse[] = [];
  const tools: string[] = [];
  const langs: string[] = [];
  const resistances: string[] = [];
  const missing: Sheet['featMissing'] = [];
  let draconic = false;
  const pickedLang: string[] = [];

  // INT, WIS or CHA: the best one when the player hasn't chosen yet
  const best = (['INT', 'WIS', 'CHA'] as Ability[]).reduce((a, b) =>
    abilities[b].modifier > abilities[a].modifier ? b : a,
  );

  for (const src of sources) {
    const feat = src.feat;
    const rules = featRules(feat);
    const picks = featPicks(feat);
    const choice = ch.choices.featChoices?.[src.key] ?? {};
    const need = (what: Sheet['featMissing'][number]['what']) =>
      missing.push({ feat: feat.name, key: src.key, what });

    // spellcasting ability
    const rule = abilityRule(feat);
    let ability: Ability = best;
    let chosen = true;
    if (rule.mode === 'fixed') ability = rule.ability;
    else if (rule.mode === 'increased')
      ability = ch.choices.abilityIncreases.find((i) => i.source === feat.id)?.ability ?? best;
    else if (rule.mode === 'choice') {
      if (choice.ability) ability = choice.ability;
      else chosen = false;
    } else {
      // "the one chosen for the Faithful Companion benefit of your Familiar Friend feat"
      const other = sources.find((o) => o !== src && ch.choices.featChoices?.[o.key]?.ability);
      if (other) ability = ch.choices.featChoices![other.key].ability!;
    }
    const dc = 8 + pb + abilities[ability].modifier;
    const attack = pb + abilities[ability].modifier;
    const key = (what: string) => `feat:${src.key}:${what}`;

    const addSpell = (g: {
      id: string;
      name: string;
      cantrip: boolean | null;
      free: boolean;
      slots: boolean;
      atWill?: boolean;
      freeUses?: 1 | 'mod' | 'pb';
    }) => {
      const freeKey = g.free ? key(g.id) : null;
      spells.push({
        id: g.id,
        name: g.name,
        cantrip: g.cantrip,
        feat: { id: feat.id, name: feat.name },
        sourceKey: src.key,
        ability,
        abilityChosen: chosen,
        saveDc: dc,
        attack,
        freeKey,
        slots: g.slots,
        atWill: g.atWill,
      });
      if (freeKey)
        uses.push({
          key: freeKey,
          label: g.name,
          labelKey: null,
          feat: feat.name,
          kind: 'spell',
          max:
            g.freeUses === 'mod'
              ? Math.max(1, abilities[ability].modifier)
              : g.freeUses === 'pb'
                ? pb
                : 1,
          rest: 'long',
        });
    };

    // the spells the text names
    for (const g of rules.spells) if (g.minLevel <= totalLevel) addSpell(g);

    // the spells the player picked
    const list = featList(src, choice);
    const text = feat.description ?? '';
    if (picks.list && !list) need('list');
    if (picks.cantrips) {
      const got = (choice.cantrips ?? []).slice(0, picks.cantrips.count);
      if (got.length < picks.cantrips.count) need('cantrips');
      for (const id of got)
        addSpell({ id, name: nameOf(id), cantrip: true, free: false, slots: false });
    }
    if (picks.spell) {
      if (!choice.spell) need('spell');
      else {
        // Magic Initiate / Fey Touched: cast once without a slot per Long Rest, or with slots
        const free = SLOTLESS_FREE.test(text) && /Long Rest/i.test(text);
        addSpell({
          id: choice.spell,
          name: nameOf(choice.spell),
          cantrip: false,
          free,
          slots: true,
        });
      }
    }
    if (!chosen && (rules.spells.length || picks.cantrips || picks.spell)) need('ability');

    // uses: Luck Points, "PB times per Long Rest", "once per Long Rest"
    const several = rules.uses.length > 1;
    for (const u of rules.uses)
      uses.push({
        key: key(slugOf(u.label)),
        label: several ? `${feat.name}: ${u.label}` : feat.name,
        labelKey: feat.id === 'lucky' ? 'play.res.luckPoints' : null,
        feat: feat.name,
        kind: 'use',
        max:
          u.max === 'pb'
            ? pb
            : typeof u.max === 'string'
              ? Math.max(1, abilities[u.max].modifier)
              : u.max,
        rest: u.rest,
      });

    // proficiencies and the rest of the picks
    const wantSkills = (picks.skills?.count ?? 0) + (picks.skillsOrTools ?? 0);
    const gotSkills =
      (choice.skills ?? []).length + (picks.skillsOrTools ? (choice.tools ?? []).length : 0);
    const wantTools = picks.tools?.count ?? 0;
    const gotTools = picks.tools ? (choice.tools ?? []).length : 0;
    if (gotSkills < wantSkills || gotTools < wantTools) need('proficiencies');
    tools.push(...(choice.tools ?? []));
    if (picks.language) {
      draconic = true;
      pickedLang.push(...(choice.languages ?? []));
    }
    langs.push(...rules.languages);
    if (picks.resistance) {
      if (choice.resistance) resistances.push(choice.resistance);
      else need('resistance');
    }
    resistances.push(...rules.resistances);
  }

  return {
    spells,
    uses,
    tools,
    resistances,
    missing,
    /**
     * The languages the feats teach: Thieves' Cant (Harper Agent), and Draconic (Cult of the
     * Dragon Initiate) or, when the character already knows it, the language the player picked.
     */
    languages: (known: string[]): string[] => {
      const out = langs.filter((l) => !known.includes(l) || l === "Thieves' Cant");
      if (draconic) out.push(...(known.includes('Draconic') ? pickedLang : ['Draconic']));
      return out;
    },
  };
}

const slugOf = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** "minor-illusion" -> "Minor Illusion" (the compendium's own name replaces it on screen). */
function nameOf(id: string): string {
  return id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// -- traits: species, class, subclass, options and feats read for what their text gives ----------

/** A piece of text that can give something: a trait, a feature, a chosen option, a feat. */
interface TraitSource {
  kind: 'class' | 'subclass' | 'species' | 'option' | 'feat';
  name: string;
  text: RuleText;
  /** Level it is gained at (class level for class features; 1 for species). */
  level: number;
  /** Levels the character has in what grants it (class level, or the total level). */
  scope: number;
  classId?: string;
  /** Id of the subclass a 'subclass' feature belongs to. */
  subId?: string;
  /** Only holds in a situation (Rage, Wild Shape, a form): resistances and senses are not applied. */
  situational: boolean;
}

const SITUATIONAL = /\bRage\b|Wild Shape|Starry Form|transform/i;

/**
 * The chosen lineage/legacy/ancestry of a species, by name — never a "variant" that's only the
 * same species reprinted in another book (those aren't a player choice and must never be applied).
 */
export function chosenVariant(
  species: Species | undefined,
  variantName: string | null | undefined,
): SpeciesVariant | undefined {
  return species?.variants.find((v) => v.name === variantName && !v.reprint);
}

/** "**Level 3:** Ray of Sickness" lines of a species variant (lineage, legacy, ancestry). */
export function variantLines(text: string): { level: number; text: string }[] {
  return [...text.matchAll(/\*\*Level (\d+):\*\*\s*(.+)/g)].map((m) => ({
    level: Number(m[1]),
    text: m[2].trim(),
  }));
}

function traitSources(
  classes: { cls: DndClass; sub?: Subclass; level: number }[],
  species: Species | undefined,
  variantName: string | null,
  totalLevel: number,
  options: { opt: ClassOption; classLevel: number; classId: string }[],
  feats: FeatSource[],
  traitChoices: Record<string, string> | undefined,
): TraitSource[] {
  const out: TraitSource[] = [];
  const resolved = (t: Feature, variantName: string | null): RuleText => {
    if (!species) return t;
    const key = traitChoiceKey(species.id, variantName, t.name);
    const r = resolveTraitChoice(t, key, traitChoices?.[key]);
    return r.split ? { name: t.name, description: r.text } : t;
  };
  for (const c of classes) {
    for (const f of c.cls.features)
      if (f.level <= c.level)
        out.push({
          kind: 'class',
          name: f.name,
          text: f,
          level: f.level,
          scope: c.level,
          classId: c.cls.id,
          situational: SITUATIONAL.test(f.description),
        });
    for (const f of c.sub?.features ?? [])
      if (f.level <= c.level)
        out.push({
          kind: 'subclass',
          name: f.name,
          text: f,
          level: f.level,
          scope: c.level,
          classId: c.cls.id,
          subId: c.sub!.id,
          situational: SITUATIONAL.test(f.description),
        });
  }
  const specie = (name: string, text: RuleText) =>
    out.push({ kind: 'species', name, text, level: 1, scope: totalLevel, situational: false });
  for (const t of species?.traits ?? []) specie(t.name, resolved(t, null));
  const variant = chosenVariant(species, variantName);
  if (variant) {
    const lines = variantLines(variant.description);
    if (lines.length) {
      for (const l of lines)
        if (l.level === 1) specie(variant.name, { name: variant.name, description: l.text });
    } else specie(variant.name, { name: variant.name, description: variant.description });
    for (const t of variant.traits) specie(t.name, resolved(t, variant.name));
  }
  for (const o of options)
    out.push({
      kind: 'option',
      name: o.opt.name,
      text: o.opt,
      level: o.opt.prerequisites?.level ?? 1,
      scope: o.classLevel,
      classId: o.classId,
      situational: false,
    });
  for (const f of feats)
    out.push({
      kind: 'feat',
      name: f.feat.name,
      text: f.feat,
      level: 1,
      scope: totalLevel,
      situational: false,
    });
  return out;
}

/** Spells, uses and resistances that species, classes, subclasses and options give. */
function traitGrants(a: {
  traits: TraitSource[];
  species: Species | undefined;
  variantName: string | null;
  subclasses: { sub: Subclass; level: number }[];
  ch: Character;
  abilities: Sheet['abilities'];
  spellAbility: (classId: string) => Ability | undefined;
  pb: number;
  totalLevel: number;
}) {
  const spells: SheetFeatSpell[] = [];
  const uses: SheetFeatUse[] = [];
  const resistances: string[] = [];
  const missing: Sheet['featMissing'] = [];
  const mod = (x: Ability) => a.abilities[x].modifier;
  const best = (['INT', 'WIS', 'CHA'] as Ability[]).reduce((x, y) => (mod(y) > mod(x) ? y : x));

  // species: one spellcasting ability for the lineage / legacy / ancestry, chosen by the player
  const speciesRules = (a.species?.traits ?? []).map((t) => featRules(t));
  const speciesChoice = speciesRules.some((r) => r.ability.mode === 'choice');
  const speciesPicked = a.ch.choices.featChoices?.['species']?.ability;
  const speciesFixed = speciesRules.find((r) => r.ability.mode === 'fixed')?.ability;

  const add = (
    t: { kind: TraitSource['kind']; name: string; id: string; classId?: string },
    g: FeatSpellGrant,
    over: { always?: boolean; own?: Ability | null } = {},
  ) => {
    let ability: Ability = best;
    let chosen = true;
    if (over.own) ability = over.own;
    else if (t.kind === 'species') {
      if (speciesPicked) ability = speciesPicked;
      else if (speciesChoice) chosen = false;
      else if (speciesFixed && speciesFixed.mode === 'fixed') ability = speciesFixed.ability;
    } else {
      const c = t.classId ? a.spellAbility(t.classId) : undefined;
      if (c) ability = c;
    }
    const free = g.free && t.kind !== 'class';
    const key = `trait:${t.kind}:${t.id}:${g.id}`;
    spells.push({
      id: g.id,
      name: g.name,
      cantrip: g.cantrip,
      feat: { id: t.id, name: t.name },
      sourceKey: `${t.kind}:${t.id}`,
      origin: t.kind === 'feat' ? 'feat' : t.kind,
      always: over.always ?? (g.cantrip === false && !g.free && !g.atWill),
      atWill: g.atWill,
      ability,
      abilityChosen: chosen,
      saveDc: 8 + a.pb + mod(ability),
      attack: a.pb + mod(ability),
      freeKey: free ? key : null,
      slots: g.slots,
    });
    if (free)
      uses.push({
        key,
        label: g.name,
        labelKey: null,
        feat: t.name,
        kind: 'spell',
        max:
          g.freeUses === 'pb'
            ? a.pb
            : g.freeUses === 'mod'
              ? Math.max(1, mod(g.freeAbility ?? ability))
              : 1,
        rest: 'long',
      });
  };

  for (const t of a.traits) {
    if (t.kind === 'feat') continue;
    const rules = featRules(t.text);
    const id = slugOf(t.name);
    const own = rules.ability.mode === 'fixed' ? rules.ability.ability : null;
    for (const g of rules.spells) if (g.minLevel <= a.totalLevel) add({ ...t, id }, g, { own });
    if (t.kind === 'class') continue; // class counters come from the class table / play-state
    if (t.kind === 'subclass' && poolFor(t.subId, t.name)) continue; // a pool of dice (rules/pools.ts)
    const several = rules.uses.length > 1;
    for (const u of rules.uses) {
      const ability = typeof u.max === 'string' && u.max !== 'pb' ? u.max : null;
      uses.push({
        key: `trait:${t.kind}:${id}:${slugOf(u.label)}`,
        label: several ? `${t.name}: ${u.label}` : t.name,
        labelKey: null,
        feat: t.name,
        kind: 'use',
        max: u.max === 'pb' ? a.pb : ability ? Math.max(1, mod(ability)) : (u.max as number),
        rest: u.rest,
      });
    }
  }

  // lineage / legacy spells of a species variant: "Level 3: Faerie Fire", "Level 5: Darkness"
  const variant = chosenVariant(a.species, a.variantName);
  if (a.species && variant) {
    const trait = a.species.traits.find((t) =>
      /always have that spell prepared/i.test(t.description),
    );
    const text = trait?.description ?? '';
    const free = /without a spell slot/i.test(text) && /Long Rest/i.test(text);
    const slots = /using any spell slots/i.test(text);
    for (const l of variantLines(variant.description))
      if (l.level > 1 && l.level <= a.totalLevel)
        for (const name of l.text.split(/\s*,\s*|\s+and\s+/).map((n) => n.trim())) {
          if (!/^[A-Z]/.test(name)) continue;
          add(
            { kind: 'species', name: variant.name, id: slugOf(variant.name) },
            {
              name,
              id: slug(name),
              minLevel: l.level,
              cantrip: false,
              free,
              atWill: false,
              slots,
              freeUses: 1,
            },
            { always: true },
          );
        }
  }

  // domain, oath, circle... spells: always prepared from the class level in the table
  for (const { sub, level } of a.subclasses)
    for (const row of sub.spells ?? [])
      if (row.classLevel <= level)
        for (const name of row.spells)
          add(
            { kind: 'subclass', name: sub.name, id: slugOf(sub.name), classId: sub.classId },
            {
              name,
              id: slug(name),
              minLevel: 1,
              cantrip: null,
              free: false,
              atWill: false,
              slots: true,
              freeUses: 1,
            },
            { always: true },
          );
  return { spells, uses, resistances, missing };
}

// -- combat ----------------------------------------------------------------------------------------

/** Notes for the effects a fighting style or feat has that the attack table can't apply by itself. */
const COMBAT_NOTES: Record<string, string> = {
  'Great Weapon Fighting': 'gwf',
  'Two-Weapon Fighting': 'twf',
  Protection: 'protection',
  Interception: 'interception',
  'Great Weapon Master': 'gwm',
  Sharpshooter: 'sharpshooter',
  'Unarmed Fighting': 'unarmed',
};

/**
 * How many kinds of weapon one class's Weapon Mastery lets a character use the mastery property
 * of, at this level. Barbarian and Fighter grow with level, through a "Weapon Mastery" column in
 * their Features table; Paladin, Ranger and Rogue have no such column because their count never
 * grows — it's a fixed two kinds from the level 1 feature of the same name.
 */
function weaponMasterySlots(
  cls: DndClass,
  level: number,
  col: (cls: DndClass, level: number, name: string) => string,
): number {
  if (cls.progression.columns.includes('Weapon Mastery'))
    return parseInt(col(cls, level, 'Weapon Mastery'), 10) || 0;
  const granted = cls.progression.rows
    .slice(0, level)
    .some((r) => r.features.includes('Weapon Mastery'));
  return granted ? 2 : 0;
}

function combatOf(
  classes: { cls: DndClass; sub?: Subclass; level: number }[],
  traits: { t: TraitSource; r: TraitRules }[],
  abilities: Sheet['abilities'],
  options: { opt: ClassOption }[],
  weaponProficiencies: string[],
  items: Map<string, Item>,
  weaponMasteryChoices: string[],
  extra: {
    features: SheetFeature[];
    pb: number;
    spellDc: (classId: string) => number | null;
    /** Ids of the spells the character has chosen or is given. */
    spells: Set<string>;
  },
): Sheet['combat'] {
  const col = (cls: DndClass, level: number, name: string) =>
    cls.progression.rows[level - 1]?.values[name] ?? '';
  const monk = classes.find((c) => c.cls.id === 'monk');
  const martial = monk ? col(monk.cls, monk.level, 'Martial Arts').toLowerCase() : '';
  const soulknife = classes.find((c) => c.sub?.id === 'rogue/soulknife');
  const masterySlots = classes.reduce((n, c) => n + weaponMasterySlots(c.cls, c.level, col), 0);
  // the player's choice, kept only while it's still valid: a weapon with a mastery property, with
  // proficiency, and no more of them than the slots the classes currently grant
  const masteryChosen = weaponMasteryChoices
    .filter((id) => {
      const item = items.get(id);
      return !!item?.weapon?.mastery && proficientWith(weaponProficiencies, item);
    })
    .slice(0, masterySlots);
  const combat: Sheet['combat'] = {
    rangedAttack: traits.reduce((n, x) => n + x.r.attack.ranged, 0),
    duelingDamage: traits.reduce((n, x) => n + x.r.attack.duelingDamage, 0),
    thrownDamage: traits.reduce((n, x) => n + x.r.attack.thrownDamage, 0),
    martialArts: /^\d+d\d+$/.test(martial) ? martial : null,
    unarmedFighting: traits.some((x) => x.t.kind === 'feat' && x.t.name === 'Unarmed Fighting'),
    masterySlots,
    masteryChosen,
    psychicBlades: !!soulknife && soulknife.level >= 3,
    soulBlades: !!soulknife && soulknife.level >= 9,
    critRange: critRangeOf(extra.features),
    notes: [],
    stats: [],
  };
  for (const { t } of traits) {
    const id = t.kind === 'feat' ? COMBAT_NOTES[t.name] : undefined;
    if (id) combat.notes.push({ id, source: t.name });
  }
  const barb = classes.find((c) => c.cls.id === 'barbarian');
  let rageDamage = 0;
  if (barb) {
    const dmg = col(barb.cls, barb.level, 'Rage Damage');
    rageDamage = parseInt(dmg, 10) || 0;
    if (dmg) combat.notes.push({ id: 'rage', source: 'Rage', params: { n: dmg } });
  }
  const rogue = classes.find((c) => c.cls.id === 'rogue');
  if (rogue) {
    const dice = col(rogue.cls, rogue.level, 'Sneak Attack');
    if (dice) combat.notes.push({ id: 'sneak', source: 'Sneak Attack', params: { n: dice } });
  }
  for (const { opt } of options)
    if (opt.id === 'eldritch-invocation/agonizing-blast')
      combat.notes.push({
        id: 'agonizing',
        source: opt.name,
        params: { n: Math.max(0, abilities.CHA.modifier) },
      });
  // damage on top of a hit, healing, temporary hit points, bonuses and DCs of class features
  const numbers = featureNumbers({
    classes: classes.map((c) => ({ id: c.cls.id, level: c.level, subclassId: c.sub?.id ?? null })),
    features: extra.features,
    pb: extra.pb,
    abilities,
    martialArts: combat.martialArts,
    rageDamage,
    spellDc: extra.spellDc,
  });
  combat.notes.push(...numbers.notes);
  combat.stats.push(...numbers.stats);
  // spells that add damage to every hit (Hex), when the character has them
  if (extra.spells.has('hex')) combat.notes.push({ id: 'hex', source: 'Hex' });
  return combat;
}

/**
 * The d20 roll from which attacks score a critical hit: "Your attack rolls with weapons and
 * Unarmed Strikes can score a Critical Hit on a roll of 19 or 20" (Improved Critical) or "18-20"
 * (Superior Critical). The lowest the sheet's features give.
 */
export function critRangeOf(features: Pick<SheetFeature, 'name' | 'description'>[]): number {
  let range = 20;
  for (const f of features) {
    if (f.name !== 'Improved Critical' && f.name !== 'Superior Critical') continue;
    const m = /Critical Hit on a roll of (\d+)(?: or |-)20/i.exec(f.description);
    if (m) range = Math.min(range, Number(m[1]));
  }
  return range;
}
