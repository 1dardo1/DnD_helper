import { term } from '../i18n/glossary';
import {
  Background,
  ClassOption,
  DndClass,
  Entry,
  Feat,
  Feature,
  Item,
  Monster,
  Species,
  Spell,
  Subclass,
} from '../models/compendium';
import { Lang, hitId } from './ports';
import { plainText } from './passage';

/** An entry of the compendium prepared for retrieval. */
export interface CorpusDoc {
  /** "<type>:<entry id>" (see hitId). */
  id: string;
  type: string;
  entryId: string;
  /** The name in the language of the corpus: what is shown. */
  name: string;
  /** Every name it goes by (translated and English), to match a name written in the question. */
  names: string[];
  /** What the name is searched by: the name plus the English one when it differs. */
  title: string;
  /** What the entry is about besides its text: type, category, feature names, key numbers. */
  head: string;
  /** One line of structured facts (damage, range, AC...): part of what the model reads. */
  facts: string;
  /** Description and features as plain text. */
  text: string;
}

/** Only this much text of an entry is indexed (the longest rules pages run to 126 000 chars). */
export const MAX_INDEXED_CHARS = 12_000;
/** ...and only this much is kept to pick the passage sent to the model from. */
const MAX_TEXT_CHARS = 40_000;

interface Labels {
  spell: string;
  cantrip: string;
  level: string;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  concentration: string;
  ritual: string;
  classes: string;
  higher: string;
  feat: string;
  species: string;
  klass: string;
  subclass: string;
  background: string;
  item: string;
  monster: string;
  rule: string;
  option: string;
  damage: string;
  properties: string;
  mastery: string;
  cost: string;
  weight: string;
  ac: string;
  hp: string;
  cr: string;
  hitDie: string;
  speed: string;
  size: string;
  darkvision: string;
  rarity: string;
  attunement: string;
  prerequisites: string;
  skills: string;
  tools: string;
  originFeat: string;
  subclassOf: string;
}

// Wording as in the rest of the app (es.ts / glossary.es.json).
const LABELS: Record<Lang, Labels> = {
  es: {
    spell: 'Conjuro',
    cantrip: 'Truco',
    level: 'Nivel',
    castingTime: 'Tiempo de lanzamiento',
    range: 'Alcance',
    components: 'Componentes',
    duration: 'Duración',
    concentration: 'Concentración',
    ritual: 'Ritual',
    classes: 'Clases',
    higher: 'A niveles superiores',
    feat: 'Dote',
    species: 'Especie',
    klass: 'Clase',
    subclass: 'Subclase',
    background: 'Trasfondo',
    item: 'Objeto',
    monster: 'Monstruo',
    rule: 'Regla',
    option: 'Opción de clase',
    damage: 'Daño',
    properties: 'Propiedades',
    mastery: 'Maestría',
    cost: 'Coste',
    weight: 'Peso',
    ac: 'CA',
    hp: 'PG',
    cr: 'VD',
    hitDie: 'Dado de golpe',
    speed: 'Velocidad',
    size: 'Tamaño',
    darkvision: 'Visión en la oscuridad',
    rarity: 'Rareza',
    attunement: 'Requiere sintonización',
    prerequisites: 'Requisito',
    skills: 'Habilidades',
    tools: 'Herramientas',
    originFeat: 'Dote de origen',
    subclassOf: 'Subclase de',
  },
  en: {
    spell: 'Spell',
    cantrip: 'Cantrip',
    level: 'Level',
    castingTime: 'Casting time',
    range: 'Range',
    components: 'Components',
    duration: 'Duration',
    concentration: 'Concentration',
    ritual: 'Ritual',
    classes: 'Classes',
    higher: 'At higher levels',
    feat: 'Feat',
    species: 'Species',
    klass: 'Class',
    subclass: 'Subclass',
    background: 'Background',
    item: 'Item',
    monster: 'Monster',
    rule: 'Rule',
    option: 'Class option',
    damage: 'Damage',
    properties: 'Properties',
    mastery: 'Mastery',
    cost: 'Cost',
    weight: 'Weight',
    ac: 'AC',
    hp: 'HP',
    cr: 'CR',
    hitDie: 'Hit die',
    speed: 'Speed',
    size: 'Size',
    darkvision: 'Darkvision',
    rarity: 'Rarity',
    attunement: 'Requires attunement',
    prerequisites: 'Prerequisite',
    skills: 'Skills',
    tools: 'Tools',
    originFeat: 'Origin feat',
    subclassOf: 'Subclass of',
  },
};

export interface DocContext {
  lang: Lang;
  /** class id → class name in `lang`, to name the classes of a spell. */
  classNames: ReadonlyMap<string, string>;
  /** The same entry in English, when the entry is a translation (its name is searchable too). */
  english?: Entry;
}

const COINS: Record<Lang, Record<string, string>> = {
  es: { cp: 'pc', sp: 'pp', ep: 'pe', gp: 'po', pp: 'ppt' },
  en: {},
};

const join = (parts: unknown[], sep = '. ') => parts.filter(Boolean).join(sep);

const featuresText = (features: Feature[] | undefined) =>
  (features ?? []).map((f) => `**${f.name}.** ${f.description}`).join('\n\n');

/** A glossary term whose value may carry a parenthesis ("Versatile (1d10)"). */
function termParen(lang: Lang, domain: Parameters<typeof term>[1], value: string): string {
  const m = /^([^(]+?)\s*(\(.*\))?$/.exec(value);
  return m ? join([term(lang, domain, m[1]), m[2]], ' ') : value;
}

function spellParts(e: Spell, c: DocContext) {
  const L = LABELS[c.lang];
  const school = term(c.lang, 'school', e.school);
  const classes = e.classes.map((id) => c.classNames.get(id) ?? id).join(', ');
  const comps = [e.components.v && 'V', e.components.s && 'S', e.components.m && 'M']
    .filter(Boolean)
    .join(', ');
  const facts = join([
    e.level === 0 ? `${L.cantrip} (${school})` : `${L.spell} — ${L.level} ${e.level} (${school})`,
    `${L.castingTime}: ${e.castingTime.raw}${e.reactionTrigger ? ` (${e.reactionTrigger})` : ''}`,
    `${L.range}: ${e.range}`,
    `${L.components}: ${comps}${e.components.material ? ` (${e.components.material})` : ''}`,
    `${L.duration}: ${e.duration}`,
    e.concentration && L.concentration,
    e.ritual && L.ritual,
    classes && `${L.classes}: ${classes}`,
  ]);
  const text = join([e.description, e.higherLevels && `${L.higher}: ${e.higherLevels}`], '\n\n');
  return {
    head: join(
      [e.level === 0 ? L.cantrip : `${L.spell} ${L.level} ${e.level}`, school, classes],
      ' ',
    ),
    facts,
    text,
  };
}

function itemParts(e: Item, c: DocContext) {
  const L = LABELS[c.lang];
  const w = e.weapon;
  const a = e.armor;
  const m = e.magic;
  const coin = e.cost ? (COINS[c.lang][e.cost.unit] ?? e.cost.unit) : '';
  const facts = join([
    `${L.item}: ${term(c.lang, 'itemCategory', e.category)}`,
    w &&
      join([
        w.kind && term(c.lang, 'weapon', w.kind),
        w.damage.length &&
          `${L.damage}: ${w.damage.map((d) => `${d.dice} ${term(c.lang, 'damage', d.type)}`).join(' / ')}`,
        w.properties.length &&
          `${L.properties}: ${w.properties.map((p) => termParen(c.lang, 'property', p)).join(', ')}`,
        w.range && `${L.range}: ${w.range}`,
        w.mastery && `${L.mastery}: ${term(c.lang, 'mastery', w.mastery)}`,
      ]),
    a &&
      join([
        term(c.lang, 'armor', a.kind),
        a.baseAC !== null &&
          `${L.ac}: ${a.baseAC}${a.dexCap === null ? ' + Des' : a.dexCap ? ` + Des (max ${a.dexCap})` : ''}`,
        a.strength && `Fue ${a.strength}`,
        a.stealthDisadvantage &&
          (c.lang === 'es' ? 'Desventaja en Sigilo' : 'Stealth disadvantage'),
      ]),
    m &&
      join([
        m.rarity && `${L.rarity}: ${term(c.lang, 'rarity', m.rarity)}`,
        term(c.lang, 'magicType', m.type),
        m.attunement && L.attunement,
      ]),
    e.cost && `${L.cost}: ${e.cost.amount} ${coin}`,
    e.weight !== null && `${L.weight}: ${e.weight}`,
  ]);
  return {
    head: join(
      [
        L.item,
        term(c.lang, 'itemCategory', e.category),
        m?.type && term(c.lang, 'magicType', m.type),
      ],
      ' ',
    ),
    facts,
    text: e.description,
  };
}

function monsterParts(e: Monster, c: DocContext) {
  const L = LABELS[c.lang];
  const facts = join([
    `${L.monster}: ${e.size.map((s) => term(c.lang, 'size', s)).join('/')} ${term(c.lang, 'creatureType', e.creatureType)}`,
    `${L.ac}: ${e.ac}`,
    `${L.hp}: ${e.hp} (${e.hitDice})`,
    `${L.cr}: ${e.cr}`,
  ]);
  const names = [
    ...e.traits,
    ...e.actions,
    ...e.bonusActions,
    ...e.reactions,
    ...e.legendaryActions,
  ].map((f) => f.name);
  return {
    head: join([L.monster, term(c.lang, 'creatureType', e.creatureType), ...names], ' '),
    facts,
    text: e.description,
  };
}

/** The retrievable form of an entry (works for every compendium type). */
export function toCorpusDoc(entry: Entry, c: DocContext): CorpusDoc {
  const L = LABELS[c.lang];
  let head = '';
  let facts = '';
  let text = entry.description ?? '';
  const featureNames = (fs: Feature[] | undefined) => (fs ?? []).map((f) => f.name).join(' ');

  switch (entry.type) {
    case 'spell':
      ({ head, facts, text } = spellParts(entry as Spell, c));
      break;
    case 'item':
      ({ head, facts, text } = itemParts(entry as Item, c));
      break;
    case 'monster':
      ({ head, facts, text } = monsterParts(entry as Monster, c));
      break;
    case 'feat': {
      const f = entry as Feat;
      const cat = term(c.lang, 'featCategory', f.category);
      head = join([L.feat, cat], ' ');
      facts = join([
        `${L.feat} (${cat})`,
        f.prerequisites?.raw && `${L.prerequisites}: ${f.prerequisites.raw}`,
      ]);
      break;
    }
    case 'species': {
      const s = entry as Species;
      head = join(
        [L.species, featureNames(s.traits), s.variants.map((v) => v.name).join(' ')],
        ' ',
      );
      facts = join([
        `${L.species}: ${s.size.map((z) => term(c.lang, 'size', z)).join('/')} ${term(c.lang, 'creatureType', s.creatureType)}`,
        `${L.speed}: ${s.speed.walk}`,
        s.darkvision && `${L.darkvision}: ${s.darkvision}`,
      ]);
      text = join(
        [
          s.description,
          featuresText(s.traits),
          ...s.variants.map((v) => `**${v.name}.** ${v.description}\n\n${featuresText(v.traits)}`),
        ],
        '\n\n',
      );
      break;
    }
    case 'class': {
      const k = entry as DndClass;
      head = join([L.klass, featureNames(k.features)], ' ');
      facts = join([`${L.klass}: ${entry.name}`, `${L.hitDie}: d${k.hitDie}`]);
      text = join([k.description, featuresText(k.features)], '\n\n');
      break;
    }
    case 'subclass': {
      const s = entry as Subclass;
      const parent = c.classNames.get(s.classId) ?? s.classId;
      head = join([L.subclass, parent, featureNames(s.features)], ' ');
      facts = `${L.subclassOf} ${parent}`;
      text = join([s.description, featuresText(s.features)], '\n\n');
      break;
    }
    case 'background': {
      const b = entry as Background;
      head = join([L.background, b.skills.join(' ')], ' ');
      facts = join([
        `${L.background}`,
        b.skills.length && `${L.skills}: ${b.skills.join(', ')}`,
        b.tools && `${L.tools}: ${b.tools}`,
        b.feat && `${L.originFeat}: ${b.feat}`,
      ]);
      break;
    }
    case 'option': {
      const o = entry as ClassOption;
      const group = term(c.lang, 'optionGroup', o.group);
      head = join([L.option, group], ' ');
      facts = `${L.option}: ${group}`;
      break;
    }
    default: {
      // rule
      const r = entry as Entry & { category?: string };
      const cat = r.category ? term(c.lang, 'ruleCategory', r.category) : '';
      head = join([L.rule, cat], ' ');
      facts = join([L.rule, cat]);
    }
  }

  const english = c.english && c.english.name !== entry.name ? c.english.name : '';
  return {
    id: hitId(entry.type, entry.id),
    type: entry.type,
    entryId: entry.id,
    name: entry.name,
    names: english ? [entry.name, english] : [entry.name],
    title: join([entry.name, english], ' '),
    head,
    facts,
    text: plainText(text).slice(0, MAX_TEXT_CHARS),
  };
}
