import { Component, computed, inject, input, signal } from '@angular/core';

import {
  addAlly,
  addMonsters,
  monsterGroups,
  randomDie,
  removeLastOf,
  rollMonsterInitiative,
  setInitiative,
  setPlayerCount,
  setPlayerName,
} from '../../../core/dm/combat';
import { CombatStore } from '../../../core/dm/combat-store.service';
import {
  CasterNumbers,
  cannonOf,
  monsterInfo,
  summonMonster,
} from '../../../core/dm/combat-sources';
import { DataTextService } from '../../../core/i18n/data-text.service';
import { term } from '../../../core/i18n/glossary';
import { I18nService, TranslatePipe } from '../../../core/i18n/i18n.service';
import { Monster } from '../../../core/models/compendium';
import { SummonCatalog, SummonOption, SummonSource } from '../../../core/summons/catalog';
import { crText } from '../../../shared/picker/entry-facets';
import { DM_COMBAT_TEXTS } from './combat-texts';

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Spell slot levels run to 9; caster and artificer levels to 20. */
const MAX_SLOT = 9;
const clampLevel = (n: number) => Math.min(20, Math.max(1, Math.floor(n) || 1));
/** Summon matches shown at once. */
const MAX_HITS = 12;

/** One creature of a summon that matches the search, worked out at the chosen level. */
interface SummonHit {
  key: string;
  source: SummonSource;
  sourceName: string;
  label: string;
  monster: Monster;
  slot: number;
  type: string;
}

/**
 * Which monsters and how many; how many players, their names and the initiative they rolled. Also
 * the allies: summoned creatures (from the summon catalog) and the Eldritch Cannon, each added with
 * its own stat block and its own initiative roll.
 */
@Component({
  selector: 'app-combat-setup',
  imports: [TranslatePipe],
  template: `
    <div class="cols">
      <section class="block">
        <h3>{{ 'combat.monsters' | t }}</h3>
        <label class="search">
          <span class="visually-hidden">{{ 'combat.search' | t }}</span>
          <input
            type="search"
            [placeholder]="'combat.search' | t"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
          />
        </label>
        @if (results().length) {
          <ul class="results">
            @for (m of results(); track m.id) {
              <li>
                <button type="button" class="result" (click)="add(m)">
                  <span class="name">{{ data.shortName(m.name) }}</span>
                  <span class="meta"
                    >{{ 'monster.crValue' | t: { cr: cr(m.cr) } }} · {{ 'monster.ac' | t }}
                    {{ m.ac }} · {{ 'monster.hp' | t }} {{ m.hp }}</span
                  >
                  <span class="plus" aria-hidden="true">+</span>
                </button>
              </li>
            }
          </ul>
        } @else if (query().trim() && monsters().length) {
          <p class="muted">{{ 'common.noResults' | t }}</p>
        }
        <ul class="groups">
          @for (g of groups(); track g.monsterId) {
            <li>
              <span class="name">{{ data.shortName(g.name) }}</span>
              <span class="stepper">
                <button
                  type="button"
                  (click)="less(g.monsterId)"
                  [attr.aria-label]="('combat.minus' | t) + ' — ' + data.shortName(g.name)"
                >
                  −
                </button>
                <output>{{ g.count }}</output>
                <button
                  type="button"
                  (click)="more(g.monsterId)"
                  [attr.aria-label]="('combat.plus' | t) + ' — ' + data.shortName(g.name)"
                >
                  +
                </button>
              </span>
            </li>
          }
        </ul>
        <label class="check">
          <input
            type="checkbox"
            [checked]="store.state().perMonster"
            (change)="perMonster($any($event.target).checked)"
          />
          {{ 'combat.perMonster' | t }}
        </label>
      </section>

      <section class="block">
        <h3>{{ 'combat.players' | t }}</h3>
        <div class="count">
          <span>{{ 'combat.playerCount' | t }}</span>
          <span class="stepper">
            <button
              type="button"
              (click)="players(-1)"
              [disabled]="!store.state().players.length"
              [attr.aria-label]="'combat.minus' | t"
            >
              −
            </button>
            <output>{{ store.state().players.length }}</output>
            <button type="button" (click)="players(1)" [attr.aria-label]="'combat.plus' | t">
              +
            </button>
          </span>
        </div>
        <ol class="players">
          @for (p of store.state().players; track p.id; let i = $index) {
            <li>
              <input
                class="pname"
                autocomplete="off"
                [value]="p.name"
                [placeholder]="playerLabel() + ' ' + (i + 1)"
                [attr.aria-label]="'combat.playerName' | t: { n: i + 1 }"
                (change)="rename(p.id, $event)"
              />
              <input
                class="init"
                type="number"
                inputmode="numeric"
                [value]="p.initiative ?? ''"
                [placeholder]="'combat.initiative' | t"
                [attr.aria-label]="
                  'combat.initOf' | t: { name: p.name || playerLabel() + ' ' + (i + 1) }
                "
                (change)="init(p.id, $event)"
              />
            </li>
          }
        </ol>
      </section>

      <section class="block allies">
        <h3>{{ 'combat.ally.title' | t }}</h3>
        <p class="muted">{{ 'combat.ally.hint' | t }}</p>
        <label class="owner">
          <span>{{ 'combat.ally.owner' | t }}</span>
          <input
            type="text"
            autocomplete="off"
            [value]="owner()"
            [placeholder]="'combat.ally.ownerHint' | t"
            (change)="owner.set($any($event.target).value)"
          />
        </label>

        <h4>{{ 'combat.ally.summons' | t }}</h4>
        <div class="caster">
          <label>
            <span>{{ 'combat.ally.casterLevel' | t }}</span>
            <input
              type="number"
              inputmode="numeric"
              min="1"
              max="20"
              [value]="casterLevel()"
              (change)="setCasterLevel($event)"
            />
          </label>
          <label>
            <span>{{ 'combat.ally.spellMod' | t }}</span>
            <input
              type="number"
              inputmode="numeric"
              [value]="spellMod()"
              (change)="setSpellMod($event)"
            />
          </label>
        </div>
        <label class="search">
          <span class="visually-hidden">{{ 'combat.ally.search' | t }}</span>
          <input
            type="search"
            [placeholder]="'combat.ally.search' | t"
            [value]="summonQuery()"
            (input)="summonQuery.set($any($event.target).value)"
          />
        </label>
        @if (summonHits().length) {
          <ul class="results">
            @for (h of summonHits(); track h.key) {
              <li class="result-row">
                <button type="button" class="result" (click)="addSummon(h)">
                  <span class="name">{{ h.label }}</span>
                  <span class="meta"
                    >{{ h.sourceName }} · {{ 'monster.ac' | t }} {{ h.monster.ac }} ·
                    {{ 'monster.hp' | t }} {{ h.monster.hp }}</span
                  >
                  <span class="plus" aria-hidden="true">+</span>
                </button>
                @if (h.source.maxSlot > h.source.minSlot) {
                  <select
                    class="pick"
                    [attr.aria-label]="'summons.slotLevel' | t"
                    (change)="slotChosen(h.source, $event)"
                  >
                    @for (lv of levelsOf(h.source); track lv) {
                      <option [value]="lv" [selected]="lv === h.slot">
                        {{ 'summons.level' | t: { level: lv } }}
                      </option>
                    }
                  </select>
                }
                @if (h.source.typeChoices.length > 1) {
                  <select
                    class="pick"
                    [attr.aria-label]="'combat.ally.type' | t"
                    (change)="typeChosen(h.source, $event)"
                  >
                    @for (ty of h.source.typeChoices; track ty) {
                      <option [value]="ty" [selected]="ty === h.type">{{ typeName(ty) }}</option>
                    }
                  </select>
                }
              </li>
            }
          </ul>
        } @else if (summonQuery().trim() && summons()) {
          <p class="muted">{{ 'combat.ally.noSummon' | t }}</p>
        }

        <h4>{{ 'cannon.title' | t }}</h4>
        <div class="caster">
          <label>
            <span>{{ 'combat.ally.artificerLevel' | t }}</span>
            <input
              type="number"
              inputmode="numeric"
              min="1"
              max="20"
              [value]="artificerLevel()"
              (change)="setArtificerLevel($event)"
            />
          </label>
          <label>
            <span>{{ 'combat.ally.intMod' | t }}</span>
            <input
              type="number"
              inputmode="numeric"
              [value]="intMod()"
              (change)="setIntMod($event)"
            />
          </label>
        </div>
        <button type="button" class="result cannon" (click)="addCannon()">
          <span class="name">{{ 'combat.ally.addCannon' | t }}</span>
          <span class="meta"
            >{{ 'monster.ac' | t }} {{ cannon().ac }} · {{ 'monster.hp' | t }}
            {{ cannon().hp }}</span
          >
          <span class="plus" aria-hidden="true">+</span>
        </button>
      </section>
    </div>
  `,
  styleUrl: './combat-setup.scss',
})
export class CombatSetup {
  protected readonly store = inject(CombatStore);
  protected readonly data = inject(DataTextService);
  private readonly i18n = inject(I18nService);

  constructor() {
    this.i18n.extend(DM_COMBAT_TEXTS);
  }

  /** The compendium's monsters. */
  readonly monsters = input<Monster[]>([]);
  /** The summon catalog (the summons' stat blocks); null until it has loaded. */
  readonly summons = input<SummonCatalog | null>(null);
  readonly playerLabel = input('');

  protected readonly query = signal('');
  protected readonly cr = crText;
  protected readonly groups = computed(() => monsterGroups(this.store.state()));

  protected readonly results = computed(() => {
    const q = fold(this.query().trim());
    if (!q) return [];
    this.data.shownLanguage();
    const hits = this.monsters().filter((m) => fold(this.data.searchText(m.name)).includes(q));
    const starts = (m: Monster) =>
      fold(this.data.shortName(m.name)).startsWith(q) || fold(m.name).startsWith(q) ? 0 : 1;
    return hits.sort((a, b) => starts(a) - starts(b) || a.cr - b.cr).slice(0, 8);
  });

  /** Adds monsters; if the others already rolled, the new ones roll (or join their kind) too. */
  private addOf(m: Monster): void {
    this.store.update((s) => {
      const next = addMonsters(s, monsterInfo(m), 1);
      const rolled = s.monsters.some((x) => x.initiative !== null);
      return rolled ? rollMonsterInitiative(next, randomDie(20), { missing: true }) : next;
    });
  }

  protected add(m: Monster): void {
    this.addOf(m);
    this.query.set('');
  }

  protected more(monsterId: string): void {
    const m = this.monsters().find((x) => x.id === monsterId);
    if (m) this.addOf(m);
  }

  protected less(monsterId: string): void {
    this.store.update((s) => removeLastOf(s, monsterId));
  }

  protected perMonster(on: boolean): void {
    this.store.update((s) => ({ ...s, perMonster: on }));
  }

  protected players(step: number): void {
    this.store.update((s) => setPlayerCount(s, s.players.length + step));
  }

  protected rename(id: string, e: Event): void {
    const name = (e.target as HTMLInputElement).value.trim();
    this.store.update((s) => setPlayerName(s, id, name));
  }

  protected init(id: string, e: Event): void {
    const v = (e.target as HTMLInputElement).value.trim();
    this.store.update((s) => setInitiative(s, id, v === '' ? null : +v));
  }

  // -- allies ----------------------------------------------------------------------------------

  /** Who summons them, as typed (optional): their name reads "Bat (Lía)". */
  protected readonly owner = signal('');
  protected readonly casterLevel = signal(5);
  protected readonly spellMod = signal(3);
  protected readonly artificerLevel = signal(5);
  protected readonly intMod = signal(3);
  protected readonly summonQuery = signal('');
  /** Slot level chosen per summon source (source id → level); the lowest one by default. */
  private readonly slotOf = signal<Record<string, number>>({});
  /** Creature type chosen per summon source (Find Familiar: celestial, fey, fiend). */
  private readonly typeOf = signal<Record<string, string>>({});

  private readonly caster = computed<CasterNumbers>(() => ({
    level: clampLevel(this.casterLevel()),
    spellMod: this.spellMod(),
  }));

  protected readonly cannon = computed(() =>
    cannonOf(clampLevel(this.artificerLevel()), this.intMod()),
  );

  private slotFor(source: SummonSource): number {
    const chosen = this.slotOf()[source.id] ?? source.minSlot;
    return Math.min(MAX_SLOT, Math.max(source.minSlot, chosen));
  }

  private typeFor(source: SummonSource): string {
    return this.typeOf()[source.id] ?? source.typeChoices[0] ?? '';
  }

  /** Creatures of the summons whose name matches the search, at the levels and types chosen. */
  protected readonly summonHits = computed<SummonHit[]>(() => {
    const catalog = this.summons();
    const q = fold(this.summonQuery().trim());
    if (!catalog || !q) return [];
    this.data.shownLanguage();
    const caster = this.caster();
    const out: SummonHit[] = [];
    for (const source of catalog.spells.values()) {
      const bySource = fold(this.data.searchText(source.name)).includes(q);
      for (const option of source.options) {
        if (!bySource && !fold(this.data.searchText(option.name)).includes(q)) continue;
        const slot = this.slotFor(source);
        const type = this.typeFor(source);
        const monster = summonMonster(source, option, catalog, slot, caster, type);
        if (monster) {
          out.push({
            key: `${source.id}|${option.key}`,
            source,
            sourceName: this.data.name(source.name),
            label: this.optionLabel(option),
            monster,
            slot,
            type,
          });
        }
        if (out.length >= MAX_HITS) return out;
      }
    }
    return out;
  });

  private optionLabel(option: SummonOption): string {
    return this.data.shortName(option.name);
  }

  protected levelsOf(source: SummonSource): number[] {
    return Array.from({ length: MAX_SLOT - source.minSlot + 1 }, (_, i) => source.minSlot + i);
  }

  protected typeName(type: string): string {
    const name = term(this.i18n.language(), 'creatureType', type);
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  protected slotChosen(source: SummonSource, e: Event): void {
    const level = +(e.target as HTMLSelectElement).value;
    this.slotOf.update((m) => ({ ...m, [source.id]: level }));
  }

  protected typeChosen(source: SummonSource, e: Event): void {
    const type = (e.target as HTMLSelectElement).value;
    this.typeOf.update((m) => ({ ...m, [source.id]: type }));
  }

  protected setCasterLevel(e: Event): void {
    this.casterLevel.set(clampLevel(this.num(e, this.casterLevel())));
  }

  protected setSpellMod(e: Event): void {
    this.spellMod.set(this.num(e, this.spellMod()));
  }

  protected setArtificerLevel(e: Event): void {
    this.artificerLevel.set(clampLevel(this.num(e, this.artificerLevel())));
  }

  protected setIntMod(e: Event): void {
    this.intMod.set(this.num(e, this.intMod()));
  }

  private num(e: Event, fallback: number): number {
    const text = (e.target as HTMLInputElement).value.trim();
    return text === '' || !Number.isFinite(+text) ? fallback : Math.floor(+text);
  }

  /** Adds an ally; if the others already rolled, it rolls its own initiative too. */
  private addAllyOf(monster: Monster): void {
    const owner = this.owner().trim();
    this.store.update((s) => {
      const next = addAlly(s, monster, owner);
      const rolled = s.monsters.some((x) => x.initiative !== null);
      return rolled ? rollMonsterInitiative(next, randomDie(20), { missing: true }) : next;
    });
  }

  protected addSummon(h: SummonHit): void {
    this.addAllyOf(h.monster);
    this.summonQuery.set('');
  }

  protected addCannon(): void {
    this.addAllyOf(this.cannon());
  }
}
