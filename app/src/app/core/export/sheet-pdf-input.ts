import { knownPlans } from '../artificer/plans';
import { enhancementsByHost } from '../characters/enhancement';
import { gearOf } from '../characters/magic-base';
import { spellCasters, spellsByClassOf, spellsOf } from '../creation/spell-choices';
import { TermDomain } from '../i18n/glossary';
import { TranslationKey } from '../i18n/i18n.service';
import { Character } from '../models/character';
import { Ability, Entry, EntryType, Spell } from '../models/compendium';
import { WeaponEntry, attacksFor } from '../rules/attacks';
import { RulesData } from '../rules/engine';
import { Sheet } from '../rules/sheet';
import { ABILITIES } from '../rules/tables';
import { stripReferenceTables } from './reference-tables';
import {
  PDF_LABEL_KEYS,
  PdfFeature,
  PdfLabels,
  PdfSpell,
  PdfSpellRow,
  SheetPdfInput,
} from './sheet-pdf';

/** The two features whose book text is a full table of every magic item plan that exists. */
const MAGIC_ITEM_PLANS_FEATURES = new Set(['Replicate Magical Item', 'Magic Item Tinker']);

/** What the PDF needs to know about the app: the character and its data, and the language. */
export interface PdfSource {
  character: Character;
  sheet: Sheet;
  rules: RulesData;
  spells: Spell[];
  /** UI texts. */
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  /** Translated name of a game thing ("Bola de fuego"), the English one when there is none. */
  shortName: (english: string | null | undefined) => string;
  /** Translated game text. */
  text: (english: string | null | undefined) => string;
  /** The translated entry (same id), or the English one. */
  entry: <T extends Entry>(type: EntryType, e: T) => T;
  term: (domain: TermDomain, value: string | null | undefined) => string;
}

const join = (xs: string[], sep = ', ') => xs.filter(Boolean).join(sep);

/** Everything the sheet shows, as the text and numbers that go on the PDF. */
export function buildSheetPdfInput(src: PdfSource): SheetPdfInput {
  const { character: ch, sheet: s, t, shortName } = src;
  const labels = Object.fromEntries(
    PDF_LABEL_KEYS.map((k) => [k, t(`pdf.${k}` as TranslationKey)]),
  ) as PdfLabels;
  const has = (list: string[], word: string) => list.some((a) => a.toLowerCase().includes(word));

  const speed = Object.entries(s.speed).map(([kind, n]) =>
    kind === 'walk'
      ? t('sheet.feet', { n })
      : `${src.term('speed', kind)} ${t('sheet.feet', { n })}`,
  );

  return {
    labels,
    name: s.name,
    background: shortName(s.background),
    classes: join(
      s.classes.map((c) => `${shortName(c.name)} ${c.level}`),
      ' / ',
    ),
    subclass: join(s.classes.map((c) => (c.subclass ? shortName(c.subclass) : ''))),
    species: shortName(s.species),
    level: s.totalLevel,
    armorClass: s.armorClass.value,
    shield: ch.equipped.shield,
    hp: { current: s.hitPoints.current, max: s.hitPoints.max, temp: s.hitPoints.temp },
    hitDice: {
      total: join(
        s.hitPoints.hitDice.map((d) => `${d.count}d${d.die}`),
        ' + ',
      ),
      spent: Object.values(ch.state.hitDiceSpent ?? {}).reduce((n, v) => n + v, 0),
    },
    deathSaves: ch.state.deathSaves,
    proficiencyBonus: s.proficiencyBonus,
    initiative: s.initiative,
    speed: join(speed),
    size: join(
      s.size.map((v) => src.term('size', v)),
      ' / ',
    ),
    passivePerception: s.passivePerception,
    inspiration: ch.state.heroicInspiration,
    abilities: ABILITIES.map((a: Ability) => ({
      name: t(`ability.${a}` as TranslationKey),
      score: s.abilities[a].score,
      modifier: s.abilities[a].modifier,
      save: s.savingThrows[a],
      skills: s.skills
        .filter((sk) => sk.ability === a)
        .map((sk) => ({
          name: t(`skill.${sk.id}` as TranslationKey),
          modifier: sk.modifier,
          proficiency: sk.proficiency,
        })),
    })),
    attacks: attacksOf(src),
    features: featuresOf(src),
    armorTraining: {
      light: has(s.proficiencies.armor, 'light'),
      medium: has(s.proficiencies.armor, 'medium'),
      heavy: has(s.proficiencies.armor, 'heavy'),
      shields: has(s.proficiencies.armor, 'shield'),
    },
    weapons: join(s.proficiencies.weapons.map((w) => src.term('weapon', w))),
    tools: join(s.proficiencies.tools.map((w) => src.term('tool', w))),
    languages: join(s.languages.map((l) => src.term('language', l))),
    ...spellsOf_(src),
    equipment: equipmentOf(src),
    coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0, ...ch.money },
    notes: ch.notes ?? '',
  };
}

function attacksOf(src: PdfSource): SheetPdfInput['attacks'] {
  const { character: ch, sheet: s, t, shortName } = src;
  const byId = src.rules.items;
  const byHost = enhancementsByHost(ch.inventory, byId);
  const weapons: WeaponEntry[] = [];
  for (const e of ch.inventory) {
    const item = e.itemId ? byId.get(e.itemId) : undefined;
    const gear = gearOf(e, item, byId);
    if (gear?.kind !== 'weapon' || !gear.base?.weapon) continue;
    // ammunition (Arrows, Bolts...) is listed as a weapon without damage: it is no attack
    if (!gear.base.weapon.damage.length && !gear.base.weapon.properties.length) continue;
    weapons.push({
      id: e.id,
      equipped: e.equipped,
      item: gear.base,
      magic: item?.magic ? { item, bonus: gear.bonus } : undefined,
      upgrades: (byHost.get(e.id) ?? []).map((u) => ({
        item: u.item,
        bonus: u.spec.bonus,
        rangedOnly: u.spec.rangedOnly,
        ignoresLoading: u.spec.ignoresLoading,
        freeAmmo: u.spec.freeAmmo,
      })),
    });
  }
  return attacksFor(s, weapons).map((a) => {
    const notes = [
      `${t(`abbr.${a.ability}` as TranslationKey)}`,
      a.versatile ? t('sheet.twoHanded', { damage: a.versatile }) : '',
      a.reach ? t('sheet.feet', { n: a.reach }) : '',
      a.range ? t('sheet.rangeFeet', { range: a.range }) : '',
      ...a.properties.map((p) => src.term('property', p)),
      a.mastery ? `${t('sheet.mastery')}: ${src.term('mastery', a.mastery)}` : '',
      a.proficient ? '' : t('sheet.notProficient'),
      a.equipped ? '' : t('sheet.notEquipped'),
      ...a.upgrades.map(
        (u) =>
          `${shortName(u.name)}: ${t(u.applied ? 'gear.up.applied' : 'gear.up.rangedOnly', { n: u.plus })}`,
      ),
    ];
    const name = a.nameKey ? t(a.nameKey as TranslationKey) : shortName(a.name);
    return {
      name: a.base ? `${name} (${shortName(a.base)})` : name,
      bonus: a.bonus,
      damage: `${a.damage} ${src.term('damage', a.damageType)}`.trim(),
      notes: join(notes),
    };
  });
}

/** The plans a character knows, as one compact line ("Known plans: X, Y, Z"); '' if none/unknown. */
function knownPlansLine(src: PdfSource): string {
  const { character: ch, rules, t, shortName } = src;
  if (!rules.options) return '';
  const plans = knownPlans(ch.choices.options, rules.options, rules.items);
  if (!plans.length) return '';
  return t('pdf.knownPlans', { list: join(plans.map((p) => shortName(p.name))) });
}

/** A feature's text for the PDF: the book's rule, minus any reference table of every book option. */
function featureText(src: PdfSource, f: { name: string; description: string }): string {
  const stripped = stripReferenceTables(src.text(f.description));
  if (!MAGIC_ITEM_PLANS_FEATURES.has(f.name)) return stripped;
  const line = knownPlansLine(src);
  return line ? (stripped ? `${stripped}\n\n${line}` : line) : stripped;
}

function featuresOf(src: PdfSource): PdfFeature[] {
  const { sheet: s, t, shortName } = src;
  const groupOf = (type: string): PdfFeature['group'] =>
    type === 'class' || type === 'subclass' ? 'class' : type === 'species' ? 'species' : 'feat';
  const bySource = new Map<string, PdfFeature[]>();
  for (const f of s.features) {
    const key = `${f.source.type}:${f.source.name}`;
    const list = bySource.get(key) ?? [];
    list.push({
      group: groupOf(f.source.type),
      name: shortName(f.name),
      level:
        f.source.type === 'class' || f.source.type === 'subclass'
          ? t('compendium.level', { level: f.level })
          : '',
      source: shortName(f.source.name),
      text: featureText(src, f),
    });
    bySource.set(key, list);
  }
  const out = [...bySource.values()].flat();
  if (s.resources.length) {
    out.push({
      group: 'class',
      name: t('sheet.resources'),
      level: '',
      source: t('sheet.resources'),
      text: s.resources.map((r) => `${src.term('column', r.name)} ${r.value}`).join('; '),
    });
  }
  if (s.resistances.length) {
    out.push({
      group: 'feat',
      name: t('sheet.resistances'),
      level: '',
      source: t('sheet.resistances'),
      text: s.resistances.map((r) => src.term('damage', r)).join(', '),
    });
  }
  return out;
}

/** Spellcasting numbers and the list: the picks of each class (in its own group when there are
 * several casters, so their spells, DC and attack never mix), then the spells of the feats. */
function spellsOf_(src: PdfSource): Pick<SheetPdfInput, 'spellcasting' | 'spells'> {
  const { character: ch, sheet: s, t } = src;
  const byId = new Map(src.spells.map((sp) => [sp.id, sp]));
  const casters = spellCasters(ch, src.rules.classes, src.rules.subclasses);
  const picked = spellsByClassOf(ch.choices, casters, byId);
  const sc = s.spellcasting;
  const several = sc.classes.length > 1;
  const spells: PdfSpellRow[] = [];
  const row = (sp: Spell, notes: string, prepared: boolean): PdfSpell => {
    const tr = src.entry('spell', sp);
    return {
      level: sp.level,
      name: tr.name,
      time: (tr.castingTime?.raw ?? sp.castingTime.raw).split(',')[0].trim(),
      range: tr.range ?? sp.range,
      concentration: sp.concentration,
      ritual: sp.ritual,
      material: sp.components.m,
      notes,
      prepared,
    };
  };
  for (const c of sc.classes) {
    const cls = src.rules.classes.get(c.classId);
    const mine = spellsOf(picked, c.classId)
      .map((id) => byId.get(id))
      .filter((sp): sp is Spell => !!sp)
      .sort(
        (a, b) => a.level - b.level || src.shortName(a.name).localeCompare(src.shortName(b.name)),
      );
    if (several) {
      spells.push({
        header: join(
          [
            src.shortName(cls?.name),
            `${t(`abbr.${c.ability}` as TranslationKey)} ${t('pdf.dcShort')} ${c.saveDc} · ${t('pdf.atkShort')} ${c.attack >= 0 ? '+' : ''}${c.attack}`,
          ],
          ' · ',
        ),
      });
    }
    for (const sp of mine) {
      const tr = src.entry('spell', sp);
      spells.push(row(sp, tr.duration ?? sp.duration, sp.level > 0));
    }
  }
  const featRows = s.featSpells
    .map((fs) => ({ fs, sp: byId.get(fs.id) }))
    .sort(
      (a, b) =>
        (a.sp?.level ?? (a.fs.cantrip ? 0 : 1)) - (b.sp?.level ?? (b.fs.cantrip ? 0 : 1)) ||
        a.fs.name.localeCompare(b.fs.name),
    );
  for (const { fs, sp } of featRows) {
    const notes = join(
      [
        t('sheet.featSource', { name: src.shortName(fs.feat.name) }),
        `${t(`abbr.${fs.ability}` as TranslationKey)} ${t('pdf.dcShort')} ${fs.saveDc} · ${t('pdf.atkShort')} ${fs.attack >= 0 ? '+' : ''}${fs.attack}`,
        fs.freeKey ? t('sheet.featSpell.free') : '',
      ],
      ' · ',
    );
    spells.push(
      sp
        ? row(sp, notes, false)
        : {
            level: fs.cantrip ? 0 : 1,
            name: src.shortName(fs.name),
            time: '',
            range: '',
            concentration: false,
            ritual: false,
            material: false,
            notes,
            prepared: false,
          },
    );
  }

  const counts = sc.classes
    .filter((c) => c.prepared !== null)
    .map((c) => {
      const n = spellsOf(picked, c.classId)
        .map((id) => byId.get(id))
        .filter((sp) => sp && sp.level > 0).length;
      return `${src.shortName(src.rules.classes.get(c.classId)?.name)} ${n}/${c.prepared}`;
    });
  const spellcasting: SheetPdfInput['spellcasting'] = sc.classes.length
    ? {
        classes: sc.classes.map((c) => ({
          name: src.shortName(src.rules.classes.get(c.classId)?.name),
          ability: t(`ability.${c.ability}` as TranslationKey),
          abbr: t(`abbr.${c.ability}` as TranslationKey),
          modifier: s.abilities[c.ability].modifier,
          dc: c.saveDc,
          attack: c.attack,
        })),
        slots: sc.slots.map((total, i) => ({ total, spent: ch.state.spentSlots[i] ?? 0 })),
        pact: sc.pact
          ? { total: sc.pact.slots, spent: ch.state.pactSlotsSpent ?? 0, level: sc.pact.level }
          : null,
        summary: counts.length ? `${t('sheet.prepared')}: ${join(counts, ' · ')}` : '',
      }
    : null;
  return { spellcasting, spells };
}

function equipmentOf(src: PdfSource): string[] {
  const { character: ch, t } = src;
  const byId = src.rules.items;
  if (!ch.inventory.length) return ch.equipment ? ch.equipment.split('\n') : [];
  return ch.inventory.map((e) => {
    const item = e.itemId ? byId.get(e.itemId) : undefined;
    const gear = gearOf(e, item, byId);
    let name =
      e.source === 'replicate' && e.name
        ? e.name
        : item
          ? src.shortName(item.name)
          : e.name || (e.itemId ?? '');
    if (item && gear?.base && gear.base.id !== item.id)
      name += ` (${src.shortName(gear.base.name)})`;
    if (gear?.bonus) name += ` +${gear.bonus}`;
    if (e.qty > 1) name += ` ×${e.qty}`;
    if (e.equipped) name += ` · ${t('sheet.equipped').toLowerCase()}`;
    if (e.spellId) {
      const sp = src.spells.find((x) => x.id === e.spellId);
      if (sp) name += ` — ${src.entry('spell', sp).name}`;
    }
    return name;
  });
}
