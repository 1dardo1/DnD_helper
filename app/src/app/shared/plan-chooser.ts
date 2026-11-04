import { Component, computed, inject, input, output, signal } from '@angular/core';

import { isPickId, parsePickId, pickSlots, pickableItems } from '../core/artificer/plans';
import { DataNamePipe, DataTextService } from '../core/i18n/data-text.service';
import { I18nService, TranslatePipe } from '../core/i18n/i18n.service';
import { ClassOption, Item } from '../core/models/compendium';
import { OptionRow } from './option-row';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * The Artificer's plan list (Replicate Magic Item) in the wizard and the level-up: the plans of the
 * table as option rows, and the "kind of item" plans (Common magic item...) as a small item search.
 */
@Component({
  selector: 'app-plan-chooser',
  imports: [OptionRow, DataNamePipe, TranslatePipe],
  template: `
    <p class="hint">{{ 'plans.hint' | t }}</p>
    @for (o of shown(); track o.id) {
      <app-option-row
        [option]="o"
        [checked]="chosen().includes(o.id)"
        [badges]="badges(o.attunement)"
        (toggled)="toggled.emit({ id: o.id, on: $event })"
      />
    }
    @if (hiddenByLevel() > 0) {
      <p class="hint">{{ 'optfilter.moreLevel' | t: { n: hiddenByLevel() } }}</p>
    }
    @for (s of slots(); track s.id) {
      <section class="slot">
        <h4>{{ s.name | dataName }}</h4>
        <p class="hint">{{ 'plans.slotHint' | t }}</p>
        <ul class="picked">
          @for (p of pickedOf(s); track p.id) {
            <li>
              <span>
                {{ p.item.name | dataName }}
                @for (b of badges(p.item.magic?.attunement ?? null); track b) {
                  <em class="badge">{{ b }}</em>
                }
              </span>
              <button
                type="button"
                class="x"
                [attr.aria-label]="('plans.remove' | t) + ': ' + p.item.name"
                (click)="toggled.emit({ id: p.id, on: false })"
              >
                ✕
              </button>
            </li>
          }
        </ul>
        <input
          type="search"
          [placeholder]="'plans.search' | t"
          [attr.aria-label]="('plans.search' | t) + ': ' + (s.name | dataName)"
          [value]="query()[s.id] || ''"
          (input)="setQuery(s.id, $any($event.target).value)"
        />
        @if (results(s); as list) {
          @if (list.length) {
            <ul class="results">
              @for (i of list; track i.id) {
                <li>
                  <button type="button" (click)="add(s, i)">
                    + {{ i.name | dataName }}
                    @for (b of badges(i.magic?.attunement ?? null); track b) {
                      <em class="badge">{{ b }}</em>
                    }
                  </button>
                </li>
              }
            </ul>
          }
        }
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
      flex: 1 1 100%;
      min-width: 0;
    }
    .hint {
      margin: 0 0 var(--space-2);
      font-size: var(--fs-sm);
      color: var(--ink-soft);
    }
    .slot {
      margin-top: var(--space-3);
      padding: var(--space-2);
      border: 1px dashed var(--line);
      border-radius: 0.4rem;
    }
    h4 {
      margin: 0;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .picked li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-2);
      min-height: var(--tap, 44px);
      border-bottom: 1px dashed var(--line);
    }
    .x {
      min-width: var(--tap, 44px);
      min-height: var(--tap, 44px);
      background: none;
      border: 0;
      cursor: pointer;
      color: var(--ink-soft);
    }
    input[type='search'] {
      width: 100%;
      box-sizing: border-box;
      margin-top: var(--space-2);
    }
    .results button {
      width: 100%;
      min-height: var(--tap, 44px);
      text-align: left;
      background: none;
      border: 0;
      border-bottom: 1px dashed var(--line);
      font: inherit;
      cursor: pointer;
    }
    .badge {
      margin-left: 0.4rem;
      padding: 0 0.4rem;
      border: 1px solid var(--line);
      border-radius: 0.6rem;
      font-size: var(--fs-sm);
      font-style: normal;
      color: var(--ink-soft);
    }
  `,
})
export class PlanChooser {
  /** The options of the plan group. */
  readonly options = input.required<ClassOption[]>();
  readonly level = input.required<number>();
  /** character.choices.options */
  readonly chosen = input.required<string[]>();
  readonly items = input.required<Item[]>();
  readonly toggled = output<{ id: string; on: boolean }>();

  private readonly i18n = inject(I18nService);
  private readonly dataText = inject(DataTextService);
  protected readonly query = signal<Record<string, string>>({});

  protected readonly fixed = computed(() => this.options().filter((o) => !o.itemPick));
  protected readonly shown = computed(() =>
    this.fixed().filter(
      (o) => (o.prerequisites?.level ?? 1) <= this.level() || this.chosen().includes(o.id),
    ),
  );
  protected readonly hiddenByLevel = computed(() => this.fixed().length - this.shown().length);
  protected readonly slots = computed(() => pickSlots(this.options(), this.level()));
  private readonly byId = computed(() => new Map(this.items().map((i) => [i.id, i])));

  protected badges(attunement: boolean | null | undefined): string[] {
    return attunement === true ? [this.i18n.t('plans.attune')] : [];
  }

  /** Items picked for a slot (by rarity). */
  protected pickedOf(slot: ClassOption): { id: string; item: Item }[] {
    return this.chosen()
      .filter((id) => isPickId(id) && parsePickId(id)!.rarity === slot.itemPick!.rarity)
      .map((id) => ({ id, item: this.byId().get(parsePickId(id)!.itemId) }))
      .filter((p): p is { id: string; item: Item } => !!p.item);
  }

  protected setQuery(slot: string, text: string): void {
    this.query.update((q) => ({ ...q, [slot]: text }));
  }

  protected results(slot: ClassOption): Item[] {
    const q = norm(this.query()[slot.id] ?? '');
    if (q.length < 2) return [];
    return pickableItems(this.items(), slot.itemPick!, this.chosen())
      .filter((i) => norm(this.dataText.searchText(i.name)).includes(q))
      .slice(0, 8);
  }

  protected add(slot: ClassOption, item: Item): void {
    this.toggled.emit({ id: `${slot.itemPick!.rarity}:${item.id}`, on: true });
    this.setQuery(slot.id, '');
  }
}
