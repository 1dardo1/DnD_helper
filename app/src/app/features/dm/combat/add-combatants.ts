import { Component, computed, inject, output, resource, signal } from '@angular/core';

import { CharacterStore } from '../../../core/characters/character-store.service';
import { CompendiumService } from '../../../core/compendium/compendium.service';
import { addCombatant, addMonsters, randomDie, rollHitDice } from '../../../core/dm/combat';
import { CombatStore } from '../../../core/dm/combat-store.service';
import { characterCombatant, monsterInfo } from '../../../core/dm/combat-sources';
import { DataTextService } from '../../../core/i18n/data-text.service';
import { TranslatePipe } from '../../../core/i18n/i18n.service';
import { Monster } from '../../../core/models/compendium';
import { RulesDataService } from '../../../core/rules/rules-data.service';
import { crText } from '../../../shared/picker/entry-facets';

type Tab = 'monster' | 'character' | 'custom';

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Adds monsters (search the compendium), saved characters or quick custom entries. */
@Component({
  selector: 'app-add-combatants',
  imports: [TranslatePipe],
  template: `
    <div class="tabs" role="tablist">
      @for (t of tabs; track t) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="tab() === t"
          [class.active]="tab() === t"
          (click)="tab.set(t)"
        >
          {{ 'combat.add.' + t | t }}
        </button>
      }
    </div>

    @switch (tab()) {
      @case ('monster') {
        <div class="row">
          <label class="grow">
            <span class="visually-hidden">{{ 'combat.add.search' | t }}</span>
            <input
              type="search"
              [placeholder]="'combat.add.search' | t"
              [value]="query()"
              (input)="query.set($any($event.target).value)"
            />
          </label>
          <label class="qty">
            <span>{{ 'combat.add.count' | t }}</span>
            <input
              type="number"
              inputmode="numeric"
              min="1"
              max="30"
              [value]="count()"
              (input)="count.set(+$any($event.target).value || 1)"
            />
          </label>
          <label class="check">
            <input
              type="checkbox"
              [checked]="rollHp()"
              (change)="rollHp.set($any($event.target).checked)"
            />
            {{ 'combat.add.rollHp' | t }}
          </label>
        </div>
        @if (monsters.error()) {
          <p role="alert">{{ 'common.error' | t: { message: '' + monsters.error() } }}</p>
        }
        <ul class="results">
          @for (m of results(); track m.id) {
            <li>
              <button type="button" class="result" (click)="addMonster(m)">
                <span class="name">{{ data.shortName(m.name) }}</span>
                <span class="meta"
                  >{{ 'monster.crValue' | t: { cr: cr(m.cr) } }} · {{ 'monster.ac' | t }}
                  {{ m.ac }} · {{ 'monster.hp' | t }} {{ m.hp }}</span
                >
                <span class="plus" aria-hidden="true">+{{ count() }}</span>
              </button>
            </li>
          } @empty {
            @if (query().trim()) {
              <li class="muted">{{ 'common.noResults' | t }}</li>
            }
          }
        </ul>
      }
      @case ('character') {
        @if (characters.isLoading()) {
          <p>{{ 'common.loading' | t }}</p>
        }
        <ul class="results">
          @for (c of characters.value() ?? []; track c.characterId) {
            <li>
              <button type="button" class="result" (click)="addCharacter(c)">
                <span class="name">{{ c.name }}</span>
                <span class="meta"
                  >{{ 'monster.ac' | t }} {{ c.ac }} · {{ 'monster.hp' | t }} {{ c.hp }}/{{
                    c.hpMax
                  }}
                  · {{ 'monster.initiative' | t }} {{ signed(c.initBonus ?? 0) }}</span
                >
                <span class="plus" aria-hidden="true">+</span>
              </button>
            </li>
          } @empty {
            @if (!characters.isLoading()) {
              <li class="muted">{{ 'characters.empty' | t }}</li>
            }
          }
        </ul>
      }
      @case ('custom') {
        <form class="custom" (submit)="$event.preventDefault(); addCustom(form)" #form>
          <label class="grow">
            <span>{{ 'combat.add.name' | t }}</span>
            <input name="name" required autocomplete="off" />
          </label>
          <label>
            <span>{{ 'monster.ac' | t }}</span>
            <input name="ac" type="number" inputmode="numeric" />
          </label>
          <label>
            <span>{{ 'monster.hp' | t }}</span>
            <input name="hp" type="number" inputmode="numeric" />
          </label>
          <label>
            <span>{{ 'combat.add.initBonus' | t }}</span>
            <input name="init" type="number" inputmode="numeric" />
          </label>
          <button type="submit" class="btn-primary">{{ 'combat.add.button' | t }}</button>
        </form>
        <p class="muted hint">{{ 'combat.add.customHint' | t }}</p>
      }
    }
    @if (added()) {
      <p class="added" role="status">{{ added() }}</p>
    }
  `,
  styleUrl: './add-combatants.scss',
})
export class AddCombatants {
  private readonly store = inject(CombatStore);
  private readonly compendium = inject(CompendiumService);
  private readonly characterStore = inject(CharacterStore);
  private readonly rules = inject(RulesDataService);
  protected readonly data = inject(DataTextService);

  /** Something was added (the page selects it). */
  readonly changed = output<void>();

  protected readonly tabs: Tab[] = ['monster', 'character', 'custom'];
  protected readonly tab = signal<Tab>('monster');
  protected readonly query = signal('');
  protected readonly count = signal(1);
  protected readonly rollHp = signal(false);
  protected readonly added = signal('');
  protected readonly cr = crText;

  protected readonly monsters = resource({ loader: () => this.compendium.all('monster') });

  protected readonly results = computed(() => {
    const q = fold(this.query().trim());
    if (!q) return [];
    this.data.shownLanguage();
    const all = this.monsters.value() ?? [];
    const hits = all.filter((m) => fold(this.data.searchText(m.name)).includes(q));
    // names that start with the text first
    const starts = (m: Monster) =>
      fold(this.data.shortName(m.name)).startsWith(q) || fold(m.name).startsWith(q) ? 0 : 1;
    return hits.sort((a, b) => starts(a) - starts(b) || a.cr - b.cr).slice(0, 12);
  });

  protected readonly characters = resource({
    loader: async () => {
      await this.characterStore.load();
      const data = await this.rules.load();
      return this.characterStore
        .all()
        .map((r) => characterCombatant(r.character, data))
        .filter((c) => !!c);
    },
  });

  protected signed(n: number): string {
    return n < 0 ? `−${-n}` : `+${n}`;
  }

  protected addMonster(m: Monster): void {
    const n = Math.min(30, Math.max(1, this.count()));
    const hpOf = this.rollHp()
      ? (x: { hitDice: string; hp: number }) => rollHitDice(x.hitDice, x.hp, (d) => randomDie(d)())
      : undefined;
    this.store.update((s) => addMonsters(s, monsterInfo(m), n, hpOf));
    this.done(`+${n} ${this.data.shortName(m.name)}`);
  }

  protected addCharacter(c: NonNullable<ReturnType<typeof characterCombatant>>): void {
    this.store.update((s) => addCombatant(s, c));
    this.done(`+ ${c.name}`);
  }

  protected addCustom(form: HTMLFormElement): void {
    const f = new FormData(form);
    const num = (k: string) => {
      const v = String(f.get(k) ?? '').trim();
      return v === '' || !Number.isFinite(+v) ? null : Math.floor(+v);
    };
    const name = String(f.get('name') ?? '').trim();
    if (!name) return;
    const hp = num('hp');
    this.store.update((s) =>
      addCombatant(s, {
        kind: 'custom',
        name,
        ac: num('ac'),
        hpMax: hp !== null && hp > 0 ? hp : null,
        initBonus: num('init') ?? 0,
      }),
    );
    form.reset();
    (form.elements.namedItem('name') as HTMLInputElement | null)?.focus();
    this.done(`+ ${name}`);
  }

  private done(text: string): void {
    this.added.set(text);
    this.changed.emit();
  }
}
