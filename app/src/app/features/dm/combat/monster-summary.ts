import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';

import { CombatMonster, resetUse, toggleUse, updateMonster, usedOf } from '../../../core/dm/combat';
import { CombatStore } from '../../../core/dm/combat-store.service';
import {
  LEGENDARY_KEY,
  ParsedAction,
  Section,
  Usage,
  damageText,
  firstSentence,
  parseMonster,
  parseName,
  spellKey,
  usageSlots,
} from '../../../core/dm/monster-actions';
import { DataTextService } from '../../../core/i18n/data-text.service';
import { term } from '../../../core/i18n/glossary';
import { I18nService, TranslatePipe } from '../../../core/i18n/i18n.service';
import { Monster, MonsterFeature } from '../../../core/models/compendium';
import { MarkdownPipe } from '../../../shared/markdown.pipe';

/** Checkboxes of a limited use. */
interface UsesView {
  key: string;
  label: string;
  /** Recharge: one toggle with a reminder; the rest: boxes. */
  recharge: boolean;
  hint: string;
  slots: boolean[];
  spent: boolean;
}

interface DamageView {
  average: number;
  dice: string;
  type: string;
  conditional: boolean;
}

interface ActionView {
  key: string;
  kind: ParsedAction['kind'];
  name: string;
  note: string;
  uses: UsesView | null;
  /** "+4" */
  hit: string;
  mode: string;
  reach: string;
  attackNote: boolean;
  save: string;
  area: string;
  damage: DamageView[];
  half: boolean;
  tags: string[];
  more: boolean;
  summary: string;
  spells: { label: string; spells: { name: string; uses: UsesView | null }[] }[];
  spellNumbers: string;
  text: string;
}

const SECTION_ORDER: Exclude<Section, 'traits'>[] = [
  'actions',
  'bonusActions',
  'reactions',
  'legendaryActions',
];

/** Without the scraper's link marks: "Sphere [Area of Effect]|XPHB|Sphere" → "Sphere". */
const unlink = (s: string) =>
  s.replace(/\s*\[[^\]]*\]\|XPHB\|[\w-]+/g, '').replace(/\b[\w-]+\|XPHB\|/g, '');

/** Without markdown marks either: "_Trigger:_ …" → "Trigger: …". */
const plain = (s: string) =>
  unlink(s)
    .replace(/\*\*|__|(^|\s)_|_(?=[\s:.,–-]|$)/g, '$1')
    .trim();

/**
 * What a monster can do on its turn, at a glance: actions, bonus actions, reactions and legendary
 * actions with their numbers (to hit, reach, damage, save DC, area), limited uses to tick and the
 * full text of each one a tap away.
 */
@Component({
  selector: 'app-monster-summary',
  imports: [TranslatePipe, MarkdownPipe, NgTemplateOutlet],
  templateUrl: './monster-summary.html',
  styleUrl: './monster-summary.scss',
})
export class MonsterSummary {
  private readonly store = inject(CombatStore);
  private readonly i18n = inject(I18nService);
  private readonly data = inject(DataTextService);

  readonly monster = input.required<Monster>();
  readonly instance = input.required<CombatMonster>();

  private readonly parsed = computed(() => parseMonster(this.monster()));
  /** The translated monster (same structure and order), or the English one. */
  private readonly shown = computed(() => {
    this.data.shownLanguage();
    return this.data.entry('monster', this.monster());
  });

  private t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key as never, params);
  }

  private feature(a: ParsedAction): MonsterFeature {
    const english = this.monster()[a.section][a.index];
    const shown = this.shown()[a.section]?.[a.index];
    return shown && shown !== english ? shown : english;
  }

  protected readonly sections = computed(() => {
    const views = this.parsed().features.map((a) => this.view(a));
    const legendary = this.parsed().legendaryUses;
    const lair = this.parsed().legendaryUsesInLair;
    return SECTION_ORDER.map((key) => ({
      key,
      items: views.filter((v) => v.key.startsWith(`${key}:`)),
      uses:
        key === 'legendaryActions' && legendary
          ? this.uses(LEGENDARY_KEY, legendary, this.t('combat.legendaryUses'), false, '')
          : null,
      lair: key === 'legendaryActions' && lair ? this.t('combat.legendaryLair', { n: lair }) : '',
    })).filter((s) => s.items.length);
  });

  /** Traits with limited uses (Legendary Resistance…), always shown. */
  protected readonly limitedTraits = computed(() =>
    this.parsed()
      .features.filter((a) => a.section === 'traits' && a.usage)
      .map((a) => this.view(a)),
  );

  protected readonly otherTraits = computed(() =>
    this.parsed()
      .features.filter((a) => a.section === 'traits' && !a.usage)
      .map((a) => this.view(a)),
  );

  private view(a: ParsedAction): ActionView {
    this.instance();
    const lang = this.i18n.language();
    const f = this.feature(a);
    const shownName = parseName(f.name);
    const notes = [...f.name.matchAll(/\(([^()]*)\)/g)]
      .flatMap((m) => m[1].split(/;\s*/))
      .filter((p) => p && !/\d|recarga|recharge|descanso|rest\b/i.test(p));
    const atk = a.attack;
    const reach = atk
      ? [
          atk.reach !== null ? this.t('combat.reach', { n: atk.reach }) : '',
          atk.range
            ? this.t('combat.range', {
                n: atk.range.long ? `${atk.range.normal}/${atk.range.long}` : atk.range.normal,
              })
            : '',
        ]
          .filter(Boolean)
          .join(` ${this.t('compendium.or')} `)
      : '';
    const s = a.save;
    const area = s?.area
      ? this.t(`combat.area.${s.area.shape}`, { size: s.area.size, width: s.area.width ?? '' })
      : s?.within
        ? this.t('combat.within', { n: s.within })
        : '';
    const tags = a.conditions.map((c) => {
      const name = term(lang, 'condition', c);
      const label = name.charAt(0).toUpperCase() + name.slice(1);
      return c === 'grappled' && a.escapeDc
        ? `${label} (${this.t('combat.escape', { dc: a.escapeDc })})`
        : label;
    });
    const text = plain(f.description);
    const sc = a.spellcasting;
    return {
      key: a.key,
      kind: a.kind,
      name: shownName.name,
      note: notes.join('; '),
      uses: a.usage ? this.usageView(a.key, a.usage) : null,
      hit: atk ? (atk.bonus < 0 ? `−${-atk.bonus}` : `+${atk.bonus}`) : '',
      mode: atk ? this.t(`combat.${atk.mode}`) : '',
      reach,
      attackNote: !!atk?.note,
      save: s ? this.t('combat.save', { ability: this.t(`ability.${s.ability}`), dc: s.dc }) : '',
      area,
      damage: a.damage.map((d) => ({
        average: d.average,
        dice: d.dice ? `(${d.dice})` : '',
        type: term(lang, 'damage', d.type),
        conditional: d.conditional,
      })),
      half: !!s?.half && a.kind === 'save',
      tags,
      more: a.more,
      summary:
        a.kind === 'multiattack'
          ? text
          : a.kind === 'other' || (a.kind === 'save' && a.more && !a.damage.length && !tags.length)
            ? firstSentence(text)
            : '',
      spellNumbers: sc
        ? [
            sc.dc !== null ? this.t('combat.spellDc', { dc: sc.dc }) : '',
            sc.attack !== null
              ? this.t('combat.spellAttack', { n: sc.attack < 0 ? sc.attack : `+${sc.attack}` })
              : '',
            sc.ability ? this.t(`ability.${sc.ability}`) : '',
          ]
            .filter(Boolean)
            .join(' · ')
        : '',
      spells: (sc?.groups ?? []).map((g) => ({
        label:
          g.perDay === null ? this.t('combat.atWill') : this.t('combat.perDay', { n: g.perDay }),
        spells: g.spells.map((sp) => ({
          name: this.data.shortName(sp),
          uses: g.perDay ? this.uses(spellKey(a, sp), g.perDay, '', false, '') : null,
        })),
      })),
      text: unlink(f.description),
    };
  }

  private usageView(key: string, u: Usage): UsesView {
    if (u.kind === 'recharge') {
      const range = u.min === 6 ? '6' : `${u.min}–6`;
      return this.uses(
        key,
        1,
        this.t('combat.recharge', { range }),
        true,
        this.t('combat.rechargeHint', { range }),
      );
    }
    if (u.kind === 'rest') return this.uses(key, 1, this.t('combat.rest'), false, '');
    const label = u.inLair
      ? this.t('combat.perDayLair', { n: u.count, lair: u.inLair })
      : this.t('combat.perDay', { n: u.count });
    return this.uses(key, usageSlots(u), label, false, '');
  }

  private uses(
    key: string,
    slots: number,
    label: string,
    recharge: boolean,
    hint: string,
  ): UsesView {
    const used = usedOf(this.instance(), key);
    return {
      key,
      label,
      recharge,
      hint,
      slots: Array.from({ length: slots }, (_, i) => i < used),
      spent: used >= slots,
    };
  }

  protected toggle(u: UsesView, index: number): void {
    const id = this.instance().id;
    this.store.update((s) =>
      updateMonster(s, id, (m) => toggleUse(m, u.key, index, u.slots.length)),
    );
  }

  protected reset(key: string): void {
    const id = this.instance().id;
    this.store.update((s) => updateMonster(s, id, (m) => resetUse(m, key)));
  }

  protected damageTitle(d: DamageView): string {
    return d.conditional ? this.t('combat.conditional') : '';
  }

  protected readonly damageText = damageText;
}
