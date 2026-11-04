import { Component, computed, inject, input, signal } from '@angular/core';

import {
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
import { monsterInfo } from '../../../core/dm/combat-sources';
import { DataTextService } from '../../../core/i18n/data-text.service';
import { TranslatePipe } from '../../../core/i18n/i18n.service';
import { Monster } from '../../../core/models/compendium';
import { crText } from '../../../shared/picker/entry-facets';

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Which monsters and how many; how many players, their names and the initiative they rolled. */
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
    </div>
  `,
  styleUrl: './combat-setup.scss',
})
export class CombatSetup {
  protected readonly store = inject(CombatStore);
  protected readonly data = inject(DataTextService);

  /** The compendium's monsters. */
  readonly monsters = input<Monster[]>([]);
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
}
