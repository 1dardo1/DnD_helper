import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DataTextPipe, DataTextService } from '../../core/i18n/data-text.service';
import { term } from '../../core/i18n/glossary';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { Ability, Monster, MonsterFeature } from '../../core/models/compendium';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { abilityModifier, crText, signed } from '../../shared/picker/entry-facets';
import { EntryLabels } from '../../shared/picker/entry-labels.service';

const ABILITIES: Ability[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * A monster's stat block, as in the 2024 Monster Manual: type line, AC, initiative, HP, speed, the
 * six abilities (modifier and saving throw), the other statistics and then traits, actions, bonus
 * actions, reactions and legendary actions.
 */
@Component({
  selector: 'app-monster-stat-block',
  imports: [RouterLink, TranslatePipe, DataTextPipe, MarkdownPipe],
  template: `
    @let m = monster();
    <section class="stat-block" [attr.aria-label]="'monster.statBlock' | t">
      <p class="type-line">{{ typeLine() }}</p>

      <dl class="core">
        <div>
          <dt>{{ 'monster.ac' | t }}</dt>
          <dd>
            {{ m.ac }}
            @if (m.armor.length) {
              <span class="soft">({{ armor() }})</span>
            }
          </dd>
        </div>
        @if (m.initiative !== null) {
          <div>
            <dt>{{ 'monster.initiative' | t }}</dt>
            <dd>{{ signed(m.initiative) }} ({{ 10 + m.initiative }})</dd>
          </div>
        }
        <div>
          <dt>{{ 'monster.hp' | t }}</dt>
          <dd>
            {{ m.hp }} <span class="soft">({{ m.hitDice }})</span>
          </dd>
        </div>
        <div class="wide">
          <dt>{{ 'monster.speed' | t }}</dt>
          <dd>{{ speed() }}</dd>
        </div>
      </dl>

      <ul class="abilities">
        @for (a of abilities(); track a.code) {
          <li>
            <abbr class="code" [title]="'ability.' + a.code | t">{{ 'abbr.' + a.code | t }}</abbr>
            <span class="score">{{ a.score }}</span>
            <span class="pair"
              ><span class="label">{{ 'monster.mod' | t }}</span> {{ a.mod }}</span
            >
            <span class="pair" [class.proficient]="a.proficient"
              ><span class="label">{{ 'monster.save' | t }}</span> {{ a.save }}</span
            >
          </li>
        }
      </ul>

      <dl class="details">
        @if (skills(); as s) {
          <dt>{{ 'monster.skills' | t }}</dt>
          <dd>{{ s }}</dd>
        }
        @if (m.vulnerabilities.length) {
          <dt>{{ 'monster.vulnerabilities' | t }}</dt>
          <dd>{{ damage(m.vulnerabilities) }}</dd>
        }
        @if (m.resistances.length) {
          <dt>{{ 'monster.resistances' | t }}</dt>
          <dd>{{ damage(m.resistances) }}</dd>
        }
        @if (immunities(); as i) {
          <dt>{{ 'monster.immunities' | t }}</dt>
          <dd>{{ i }}</dd>
        }
        @if (m.gear.length) {
          <dt>{{ 'monster.gear' | t }}</dt>
          <dd>{{ gear() }}</dd>
        }
        <dt>{{ 'monster.senses' | t }}</dt>
        <dd>{{ senses() }}</dd>
        <dt>{{ 'monster.languages' | t }}</dt>
        <dd>{{ m.languages ? (m.languages | dataText) : ('compendium.none' | t) }}</dd>
        <dt>{{ 'monster.cr' | t }}</dt>
        <dd>
          <a [routerLink]="['/compendium', 'monster']" [queryParams]="{ challenge: m.cr }">{{
            cr()
          }}</a>
          <span class="soft">{{ ' ' + crDetails() }}</span>
        </dd>
      </dl>

      @for (part of parts(); track part.key) {
        <h2>{{ 'monster.' + part.key | t }}</h2>
        @if (part.key === 'legendaryActions' && legendaryUses(); as u) {
          <p class="intro">{{ u }}</p>
        }
        @for (f of part.items; track $index) {
          <div class="feature md" [innerHTML]="text(f) | markdown"></div>
        }
      }
    </section>
  `,
  styleUrl: './monster-stat-block.scss',
})
export class MonsterStatBlock {
  readonly monster = input.required<Monster>();
  private readonly i18n = inject(I18nService);
  private readonly data = inject(DataTextService);
  private readonly labels = inject(EntryLabels);

  protected readonly signed = signed;

  private t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key as never, params);
  }

  private term(domain: Parameters<typeof term>[1], value: string): string {
    return term(this.i18n.language(), domain, value);
  }

  /** "Grande · Aberración · Legal malvado" (+ swarm, animal). */
  protected readonly typeLine = computed(() => {
    const m = this.monster();
    const size = m.size.map((z) => this.term('size', z)).join(` ${this.t('compendium.or')} `);
    const type = capitalise(this.term('creatureType', m.creatureType));
    const swarm = m.tags.includes('swarm')
      ? ` (${this.t('monster.swarm', { size: this.term('size', 'tiny').toLowerCase() })})`
      : '';
    return [
      `${size} · ${type}${swarm}`,
      capitalise(this.term('alignment', m.alignment)),
      ...(m.category === 'animal' ? [this.term('monsterCategory', 'animal')] : []),
    ].join(' · ');
  });

  protected readonly armor = computed(() =>
    this.monster()
      .armor.map((a) => this.data.shortName(a))
      .join(', '),
  );

  protected readonly speed = computed(() => this.labels.monsterSpeed(this.monster()));

  protected readonly abilities = computed(() => {
    const m = this.monster();
    return ABILITIES.map((code) => {
      const mod = abilityModifier(m.abilities[code]);
      const save = m.saves[code];
      return {
        code,
        score: m.abilities[code],
        mod: signed(mod),
        save: signed(save ?? mod),
        proficient: save !== undefined,
      };
    });
  });

  protected readonly skills = computed(() =>
    Object.entries(this.monster().skills)
      .map(([id, bonus]) => `${this.t(`skill.${id}`)} ${signed(bonus)}`)
      .join(', '),
  );

  protected damage(list: string[]): string {
    return capitalise(list.map((d) => this.term('damage', d)).join(', '));
  }

  /** Damage immunities; then condition immunities (as in the 2024 stat blocks). */
  protected readonly immunities = computed(() => {
    const m = this.monster();
    const conditions = m.conditionImmunities.map((c) => capitalise(this.term('condition', c)));
    return [m.immunities.length ? this.damage(m.immunities) : '', conditions.join(', ')]
      .filter(Boolean)
      .join('; ');
  });

  protected readonly gear = computed(() =>
    this.monster()
      .gear.map((g) => this.data.shortName(g))
      .join(', '),
  );

  protected readonly senses = computed(() => {
    const m = this.monster();
    return [
      ...Object.entries(m.senses).map(
        ([k, v]) => `${this.t(`monster.sense.${k}`)} ${this.t('compendium.feet', { n: v! })}`,
      ),
      this.t('monster.passivePerception', { n: m.passivePerception }),
    ].join(', ');
  });

  protected readonly cr = computed(() => crText(this.monster().cr));

  /** "(PX 5900, o 7200 en su guarida; BC +4)". */
  protected readonly crDetails = computed(() => {
    const m = this.monster();
    const lang = this.i18n.language();
    const params = {
      cr: '',
      xp: m.xp.toLocaleString(lang),
      lair: (m.xpInLair ?? 0).toLocaleString(lang),
      pb: signed(m.proficiencyBonus),
    };
    return this.t(m.xpInLair ? 'monster.crLineLair' : 'monster.crLine', params).trim();
  });

  protected readonly parts = computed(() => {
    const m = this.monster();
    return (['traits', 'actions', 'bonusActions', 'reactions', 'legendaryActions'] as const)
      .map((key) => ({ key, items: m[key] }))
      .filter((p) => p.items.length);
  });

  protected readonly legendaryUses = computed(() => {
    const u = this.monster().legendaryActionUses;
    if (!u) return '';
    const uses = u.inLair
      ? this.t('monster.usesInLair', { uses: u.uses, lair: u.inLair })
      : String(u.uses);
    return this.t('monster.legendaryUses', { uses });
  });

  /** "**Mordisco (Bite).** Tirada de ataque…". */
  protected text(f: MonsterFeature): string {
    return `**${this.data.name(f.name)}.** ${this.data.text(f.description)}`;
  }
}
