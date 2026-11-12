import {
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  resource,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

import { weaponEntriesOf } from '../../core/characters/weapons';
import { blocksOf, translatedSentence } from '../../core/combat/action-text';
import {
  ACTION_KINDS,
  ActionKind,
  CombatRow,
  LinePart,
  Section,
  advantagesOf,
  combatRows,
  definitions,
  favoriteRows,
  featureDcs,
  sectionsOf,
} from '../../core/combat/combat-actions';
import { toggleFavorite } from '../../core/combat/favorites';
import { leftOf, spend, refund } from '../../core/combat/spend';
import { CompendiumService } from '../../core/compendium/compendium.service';
import { browserStorage } from '../../core/creation/edit-draft';
import { DataNamePipe, DataTextPipe, DataTextService } from '../../core/i18n/data-text.service';
import { TermPipe, term } from '../../core/i18n/glossary';
import { combatEn } from '../../core/i18n/combat.en';
import { combatEs } from '../../core/i18n/combat.es';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { Character } from '../../core/models/character';
import { Monster, Rule } from '../../core/models/compendium';
import { dropConcentration, startConcentration } from '../../core/play/concentration';
import { PlayState, currentHp, playResources } from '../../core/play/play-state';
import { STATES_TEXTS } from '../../core/i18n/states.es';
import { stateOn } from '../../core/rules/active-states';
import { attacksFor } from '../../core/rules/attacks';
import { RulesData } from '../../core/rules/engine';
import { Sheet } from '../../core/rules/sheet';
import { formView, knownForms, wildShapeRules } from '../../core/rules/wild-shape';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { SwipeDirective, stepOf } from '../../shared/swipe.directive';
import { ActiveStatesBar } from '../states/active-states-bar';
import { WildShapeForm } from '../states/wild-shape-form';
import { ConcentrationChip } from './concentration-chip';
import { ConcentrationNotices } from './concentration-notice';

export type CombatColumn = ActionKind | 'favorites';
export const COMBAT_COLUMNS: readonly CombatColumn[] = [...ACTION_KINDS, 'favorites'];

/** The tab's own UI texts (core/i18n/combat.*.ts), loaded with it. */
const COMBAT_TEXTS = { en: combatEn, es: combatEs };

const COLUMN_PREFIX = 'dnd-helper.sheet.combat.col.';

/** The column shown on a phone, remembered per character (like the tab). */
export function readColumn(storage: Pick<Storage, 'getItem'> | null, id: string): CombatColumn {
  try {
    const v = storage?.getItem(COLUMN_PREFIX + id);
    return (COMBAT_COLUMNS as readonly string[]).includes(v ?? '') ? (v as CombatColumn) : 'action';
  } catch {
    return 'action';
  }
}

export function writeColumn(
  storage: Pick<Storage, 'setItem'> | null,
  id: string,
  col: CombatColumn,
) {
  try {
    storage?.setItem(COLUMN_PREFIX + id, col);
  } catch {
    // only a convenience
  }
}

/**
 * The Combat tab of the sheet: the numbers that matter in a fight on top, then every action,
 * bonus action and reaction the character has (core/combat/combat-actions.ts) in three columns
 * and a fourth of favorites. Phones show one column at a time (a strip of tabs, or a swipe).
 * Loaded lazily (@defer in the sheet). It only computes the new state; the sheet saves it.
 */
@Component({
  selector: 'app-combat-tab',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    TranslatePipe,
    TermPipe,
    DataNamePipe,
    DataTextPipe,
    MarkdownPipe,
    SwipeDirective,
    ActiveStatesBar,
    WildShapeForm,
    ConcentrationChip,
  ],
  templateUrl: './combat-tab.html',
  styleUrl: './combat-tab.scss',
})
export class CombatTab {
  readonly character = input.required<Character>();
  readonly sheet = input.required<Sheet>();
  readonly data = input.required<RulesData>();
  readonly changed = output<PlayState>();

  private readonly compendium = inject(CompendiumService);
  private readonly dataText = inject(DataTextService);
  private readonly i18n = inject(I18nService);
  private readonly notices = inject(ConcentrationNotices);

  private readonly lists = resource({
    loader: async () => {
      const [spells, rules] = await Promise.all([
        this.compendium.all('spell'),
        this.compendium.all('rule'),
      ]);
      return {
        spells: new Map(spells.map((s) => [s.id, s])),
        rules: (rules as Rule[]).filter((r) => r.category === 'actions'),
      };
    },
  });

  // -- Wild Shape (Druid): the known forms and the form taken ---------------------------------
  protected readonly wildRules = computed(() => wildShapeRules(this.sheet()));
  private readonly monsters = resource({
    params: () => (this.wildRules() ? true : undefined),
    loader: () => this.compendium.all('monster'),
  });
  private readonly monsterById = computed(
    () => new Map((this.monsters.value() ?? []).map((m) => [m.id, m])),
  );
  protected readonly knownForms = computed<Monster[]>(() => {
    const r = this.wildRules();
    if (!r) return [];
    return knownForms(this.character().choices.wildShapeForms, this.monsterById(), r)
      .filter((k) => k.allowed)
      .map((k) => k.monster);
  });
  protected readonly currentForm = computed(() => {
    const id = this.character().state.wildShape?.formId;
    return (id && this.monsterById().get(id)) || null;
  });
  /** The sheet in the form the Druid is in (null in their own form). */
  protected readonly form = computed(() => {
    const m = this.currentForm();
    const r = this.wildRules();
    return m && r ? formView(this.sheet(), m, r) : null;
  });

  protected readonly columns = COMBAT_COLUMNS;
  protected readonly kinds = ACTION_KINDS;
  protected readonly state = computed(() => this.character().state);
  protected readonly resources = computed(() => playResources(this.sheet()));

  protected readonly rows = computed<CombatRow[]>(() => {
    const l = this.lists.value();
    if (!l) return [];
    const ch = this.character();
    const sheet = this.sheet();
    return combatRows({
      sheet,
      character: ch,
      data: this.data(),
      attacks: attacksFor(sheet, weaponEntriesOf(ch.inventory, this.data().items)),
      spells: l.spells,
      rules: l.rules,
      resources: this.resources(),
      form: this.form(),
    });
  });
  protected readonly loading = computed(() => !this.lists.value() && !this.lists.error());

  protected readonly favorites = computed(() => new Set(this.state().combatFavorites ?? []));
  protected readonly favoriteGroups = computed(() =>
    favoriteRows(this.rows(), this.state().combatFavorites),
  );
  protected readonly sections = computed(() => {
    const rows = this.rows();
    return Object.fromEntries(ACTION_KINDS.map((k) => [k, sectionsOf(rows, k)])) as Record<
      ActionKind,
      { section: Section; rows: CombatRow[] }[]
    >;
  });
  protected readonly counts = computed(() => {
    const rows = this.rows();
    const out: Record<CombatColumn, number> = { action: 0, bonus: 0, reaction: 0, favorites: 0 };
    for (const r of rows) out[r.kind]++;
    out.favorites = this.favoriteGroups().reduce((n, g) => n + g.rows.length, 0);
    return out;
  });
  protected readonly definitions = computed(() => definitions(this.lists.value()?.rules ?? []));

  // -- the column on a phone ------------------------------------------------------------------

  protected readonly current = signal<CombatColumn>('action');
  /** Phones only: one column and the swipe; wider screens show them all. */
  protected readonly narrow = signal(true);

  constructor() {
    this.i18n.extend(COMBAT_TEXTS);
    this.i18n.extend(STATES_TEXTS);
    effect(() => this.current.set(readColumn(browserStorage(), this.character().id)));
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const mq = window.matchMedia?.('(max-width: 44.99rem)');
      if (!mq) return;
      const update = () => this.narrow.set(mq.matches);
      update();
      mq.addEventListener('change', update);
      destroyRef.onDestroy(() => mq.removeEventListener('change', update));
    });
  }

  /** A text of the tab (core/i18n/combat.*.ts). */
  private tc(key: keyof typeof combatEn, params?: Record<string, string | number>): string {
    return this.i18n.t(key as never, params);
  }

  protected show(col: CombatColumn): void {
    this.current.set(col);
    writeColumn(browserStorage(), this.character().id, col);
  }

  protected swipe(dir: 'left' | 'right'): void {
    const i = COMBAT_COLUMNS.indexOf(this.current());
    this.show(COMBAT_COLUMNS[stepOf(i, COMBAT_COLUMNS.length, dir)]);
  }

  // -- header ---------------------------------------------------------------------------------

  protected readonly hp = computed(() => currentHp(this.state(), this.sheet().hitPoints.max));
  /** In a Wild Shape form: the Beast's AC, Speeds, Initiative and passive Perception. */
  protected readonly ac = computed(() => this.form()?.ac ?? this.sheet().armorClass.value);
  protected readonly initiative = computed(
    () => this.form()?.initiative ?? this.sheet().initiative,
  );
  protected readonly passive = computed(
    () => this.form()?.passivePerception ?? this.sheet().passivePerception,
  );
  protected readonly speeds = computed(() =>
    Object.entries(this.form()?.speed ?? this.sheet().speed)
      .filter(([, value]) => typeof value === 'number')
      .map(([kind, value]) => ({ kind, value: value as number })),
  );
  protected readonly dcs = computed(() => featureDcs(this.sheet()));
  protected readonly advantages = computed(() => advantagesOf(this.sheet()));
  protected readonly slotSummary = computed(() => {
    const s = this.sheet();
    const st = this.state();
    const out = s.spellcasting.slots
      .map((max, i) => ({
        label: `${i + 1}`,
        left: max - Math.min(st.spentSlots[i] ?? 0, max),
        max,
      }))
      .filter((x) => x.max > 0);
    const pact = s.spellcasting.pact;
    if (pact)
      out.push({
        label: this.tc('combat.head.pactLevel', { level: pact.level }),
        left: pact.slots - Math.min(st.pactSlotsSpent, pact.slots),
        max: pact.slots,
      });
    return out;
  });
  protected readonly hitDice = computed(() =>
    this.sheet().hitPoints.hitDice.map((d) => ({
      die: d.die,
      left: d.count - Math.min(this.state().hitDiceSpent[`d${d.die}`] ?? 0, d.count),
      count: d.count,
    })),
  );
  protected readonly senses = computed(() => {
    const s = this.sheet();
    const list = s.senses.map((x) => ({ kind: x.kind, range: x.range }));
    if (s.darkvision && !list.some((x) => x.kind === 'darkvision'))
      list.unshift({ kind: 'darkvision', range: s.darkvision });
    return list;
  });

  protected className(id: string): string {
    return this.dataText.shortName(this.sheet().classes.find((c) => c.id === id)?.name ?? id);
  }

  // -- rows -----------------------------------------------------------------------------------

  protected name(r: CombatRow): string {
    return r.nameKey ? this.i18n.t(r.nameKey as never) : this.dataText.shortName(r.name);
  }

  /** The label of the part of a feature, in the language of the data. */
  protected part(r: CombatRow): string | null {
    if (!r.part) return null;
    const block = r.more?.block;
    if (r.more && block !== null && block !== undefined) {
      const es = this.dataText.text(r.more.text);
      const tr = blocksOf(es);
      if (es !== r.more.text && tr.length === blocksOf(r.more.text).length && tr[block]?.label)
        return tr[block].label;
    }
    return r.part;
  }

  /** The one-line summary, with the numbers already worked out. */
  protected line(r: CombatRow): string {
    return r.line
      .map((p) => this.piece(p, r))
      .filter((x) => !!x)
      .join(' · ');
  }

  private piece(p: LinePart, r: CombatRow): string {
    const t = (key: string, params?: Record<string, string | number>) =>
      this.i18n.t(key as never, params);
    const lang = this.i18n.language();
    switch (p.k) {
      case 'hit':
        return t('combat.line.hit', { n: signed(p.n) });
      case 'damage':
        return `${p.dice} ${term(lang, 'damage', p.type)}`;
      case 'heal':
        return t('combat.line.heal', { dice: p.dice });
      case 'dc':
        return t('combat.line.dc', { n: p.n }) + (p.ability ? ` (${t('abbr.' + p.ability)})` : '');
      case 'range':
        return /^\d+\/\d+$/.test(p.text)
          ? t('sheet.rangeFeet', { range: p.text })
          : this.dataText.text(p.text);
      case 'reach':
        return t('sheet.feet', { n: p.feet });
      case 'mastery':
        return `${t('sheet.mastery')}: ${term(lang, 'mastery', p.name)}`;
      case 'concentration':
        return t('combat.line.concentration');
      case 'ritual':
        return t('combat.line.ritual');
      case 'ui':
        return t(p.key, p.params);
      case 'sentence':
        return translatedSentence(p, this.dataText.text(p.of), r.timing);
    }
  }

  /** "Ver más": the text (or its part) in the language of the data. */
  protected more(r: CombatRow): string {
    if (!r.more) return '';
    const es = this.dataText.text(r.more.text);
    const block = r.more.block;
    if (block === null) return es;
    const tr = blocksOf(es);
    const en = blocksOf(r.more.text);
    const pickFrom = tr.length === en.length ? tr : en;
    const b = pickFrom[block];
    if (!b) return es;
    return b.label ? `**${b.label}.** ${b.text}` : b.text;
  }

  protected readonly open = signal<ReadonlySet<string>>(new Set());
  protected toggleOpen(id: string): void {
    this.open.update((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  // -- costs and favorites --------------------------------------------------------------------

  protected left(r: CombatRow): number {
    return r.cost ? leftOf(this.sheet(), this.state(), r.cost) : 0;
  }

  protected costLabel(r: CombatRow): string {
    const c = r.cost;
    if (!c) return '';
    if (c.k === 'slot') return this.tc('combat.cost.slot', { level: c.level, left: this.left(r) });
    const name = c.labelKey
      ? this.i18n.t(c.labelKey as never)
      : term(this.i18n.language(), 'column', c.name);
    return this.tc('combat.cost.uses', { name, left: this.left(r), max: c.max });
  }

  protected spend(r: CombatRow): void {
    if (!r.cost) return;
    this.emit(spend(this.sheet(), this.state(), r.cost));
  }

  protected refund(r: CombatRow): void {
    if (!r.cost) return;
    this.emit(refund(this.state(), r.cost));
  }

  protected canRefund(r: CombatRow): boolean {
    return r.cost?.k === 'resource' && (this.state().resources[r.cost.key] ?? 0) > 0;
  }

  /**
   * A row that doesn't apply now: a feature that needs a state that is off (Frenzy without Rage),
   * or a spell while raging ("you can't cast spells").
   */
  protected dimmed(r: CombatRow): boolean {
    const states = this.sheet().combat.states;
    if (r.while && !stateOn(states, r.while)) return true;
    return r.id.startsWith('spell:') && stateOn(states, 'rage');
  }

  /** A change from the switches of the active states. */
  protected statesChanged(next: PlayState): void {
    this.emit(next);
  /** A row of a spell that needs concentration (the spell's data says so). */
  protected concentrates(r: CombatRow): boolean {
    return r.link?.type === 'spell' && !!this.lists.value()?.spells.get(r.link.id)?.concentration;
  }

  protected isConcentrating(r: CombatRow): boolean {
    return !!r.link && this.state().concentration?.spellId === r.link.id;
  }

  /** Marks the spell as the one being concentrated on (replacing, and saying so, any other). */
  protected concentrate(r: CombatRow): void {
    if (r.link?.type !== 'spell') return;
    const out = startConcentration(this.state(), r.link.id);
    if (out.replaced)
      this.notices.show({ kind: 'replaced', oldId: out.replaced, newId: r.link.id });
    this.emit(out.state);
  }

  protected release(): void {
    this.emit(dropConcentration(this.state()));
  }

  protected toggleFavorite(id: string): void {
    const list = toggleFavorite(this.state().combatFavorites, id);
    const next: PlayState = { ...this.state(), combatFavorites: list };
    if (!list.length) delete next.combatFavorites;
    this.emit(next);
  }

  protected emit(next: PlayState): void {
    if (next !== this.state()) this.changed.emit(next);
  }

  protected terms(values: readonly string[], domain: 'damage' | 'condition'): string {
    return values.map((v) => term(this.i18n.language(), domain, v)).join(', ');
  }

  protected signed = signed;
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}
