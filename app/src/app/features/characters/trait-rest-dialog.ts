import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  resource,
  signal,
  viewChild,
} from '@angular/core';

import { CompendiumService } from '../../core/compendium/compendium.service';
import { DataNamePipe, DataTextService } from '../../core/i18n/data-text.service';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { Character } from '../../core/models/character';
import { answerRestChoices } from '../../core/play/rest-choices';
import { chosenVariant } from '../../core/rules/engine';
import { RulesDataService } from '../../core/rules/rules-data.service';
import { Sheet } from '../../core/rules/sheet';
import { SpeciesPick, hadValues, speciesTraits } from '../../core/rules/species-picks';
import { TraitPicks, pickValueLabel } from '../../shared/trait-picks';

/**
 * After a rest: for every species trait whose pick the text lets the player change then
 * (state.restChoices), its current choice, "Keep" (the default) and "Change". Skipping it (Esc,
 * "Keep all") keeps everything; it never blocks the rest. Only computes the new character.
 */
@Component({
  selector: 'app-trait-rest-dialog',
  imports: [TranslatePipe, DataNamePipe, TraitPicks],
  template: `
    @if (items().length) {
      <dialog
        #dialog
        class="rest-dialog"
        (close)="onClose()"
        aria-labelledby="restpick-title"
        data-testid="trait-rest-dialog"
      >
        <h2 id="restpick-title">{{ 'restpick.title' | t }}</h2>
        <p class="rule">
          <small>{{ 'restpick.rule' | t }}</small>
        </p>
        <ul class="list">
          @for (it of items(); track it.pick.key) {
            <li [attr.data-testid]="'restpick-' + it.pick.key">
              <strong>
                {{ it.pick.trait | dataName }} ·
                <small>{{ 'traitpick.kind.' + it.pick.pick.kind | t }}</small>
              </strong>
              <span class="current">{{ 'restpick.current' | t: { value: current(it.pick) } }}</span>
              <div class="choice">
                <button
                  type="button"
                  [class.primary]="!changing().includes(it.pick.key)"
                  [attr.aria-pressed]="!changing().includes(it.pick.key)"
                  (click)="setChanging(it.pick.key, false)"
                >
                  {{ 'restpick.keep' | t }}
                </button>
                <button
                  type="button"
                  [class.primary]="changing().includes(it.pick.key)"
                  [attr.aria-pressed]="changing().includes(it.pick.key)"
                  (click)="setChanging(it.pick.key, true)"
                >
                  {{ 'restpick.change' | t }}
                </button>
              </div>
              @if (changing().includes(it.pick.key)) {
                <app-trait-picks
                  [pick]="it.edited"
                  [spells]="spells()"
                  [weapons]="weaponNames()"
                  [had]="it.had"
                  [level]="sheet().totalLevel || 1"
                  [compact]="true"
                  (changed)="edit(it.pick.key, $event)"
                />
              }
            </li>
          }
        </ul>
        <div class="actions">
          <button type="button" class="primary" autofocus (click)="done()">
            {{ 'restpick.done' | t }}
          </button>
          <button type="button" (click)="keepAll()">{{ 'restpick.keepAll' | t }}</button>
        </div>
      </dialog>
    }
  `,
  styles: `
    .rest-dialog {
      width: min(34rem, calc(100vw - 1.5rem));
      max-height: calc(100dvh - 2rem);
      padding: 0 1rem 1rem;
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-md);
      background: var(--paper);
      color: var(--ink);
      box-shadow: var(--shadow-page);
      &::backdrop {
        background: rgb(0 0 0 / 0.55);
      }
      h2 {
        font-size: var(--fs-lg);
      }
    }
    .list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: var(--space-3);
    }
    .list li {
      display: grid;
      gap: var(--space-2);
      padding-bottom: var(--space-2);
      border-bottom: 1px dashed var(--line);
    }
    .current {
      font-style: italic;
    }
    .choice,
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .actions {
      margin-top: var(--space-3);
    }
    button {
      min-height: var(--tap);
    }
    .primary {
      background: var(--accent);
      color: var(--paper);
    }
  `,
})
export class TraitRestDialog {
  readonly character = input.required<Character>();
  readonly sheet = input.required<Sheet>();
  readonly changed = output<Character>();

  private readonly rules = inject(RulesDataService);
  private readonly compendium = inject(CompendiumService);
  private readonly i18n = inject(I18nService);
  private readonly dataText = inject(DataTextService);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  private readonly data = resource({ loader: () => this.rules.load() });
  private readonly allSpells = resource({ loader: () => this.compendium.all('spell') });
  protected readonly spells = computed(() => this.allSpells.value() ?? []);
  private readonly weapons = computed(() =>
    [...(this.data.value()?.items.values() ?? [])]
      .filter((i) => !!i.weapon?.kind && !i.magic)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  protected readonly weaponNames = computed(() => this.weapons().map((w) => w.name));

  protected readonly pending = computed(() => this.character().state.restChoices ?? []);
  /** Keys being changed, and the values picked for them so far. */
  protected readonly changing = signal<string[]>([]);
  /** Answered already: closing the dialog afterwards must not answer again. */
  private answered = false;
  private readonly drafts = signal<Record<string, string[]>>({});

  /** The picks waiting for an answer, as they stand now. */
  private readonly picks = computed<SpeciesPick[]>(() => {
    const data = this.data.value();
    const ch = this.character();
    const pending = this.pending();
    if (!pending.length) return [];
    // a feat's damage types that the text lets the player change (the sheet's restPicks)
    const fromFeats = (this.sheet().restPicks ?? []).flatMap((p): SpeciesPick[] => {
      const r = p.resist;
      if (!r || !pending.includes(p.key)) return [];
      return [
        {
          key: p.key,
          traitKey: p.key,
          trait: p.trait,
          pick: { kind: 'resistance', count: r.count, from: r.from, rest: 'long' },
          count: r.count,
          picked: r.picked,
        },
      ];
    });
    const species = ch.species ? data?.species.get(ch.species.id) : undefined;
    if (!species) return fromFeats;
    const views = speciesTraits(
      species,
      chosenVariant(species, ch.species?.variant),
      ch.choices,
      this.sheet().totalLevel || 1,
    );
    return [
      ...views
        .filter((v) => !v.hidden)
        .flatMap((v) => v.picks)
        .filter((p) => pending.includes(p.key)),
      ...fromFeats,
    ];
  });

  protected readonly items = computed(() =>
    this.picks().map((pick) => {
      const draft = this.drafts()[pick.key];
      return {
        pick,
        edited: draft ? { ...pick, picked: draft } : pick,
        had: hadValues(this.sheet(), pick, this.weapons(), this.character().choices.spells),
      };
    }),
  );

  constructor() {
    effect(() => {
      const el = this.dialog()?.nativeElement;
      if (!el) return;
      if (this.items().length && !el.open) {
        this.changing.set([]);
        this.drafts.set({});
        this.answered = false;
        el.showModal();
      } else if (!this.items().length && el.open) el.close();
    });
  }

  protected current(p: SpeciesPick): string {
    if (!p.picked.length) return this.i18n.t('restpick.none');
    const names = new Map(this.spells().map((s) => [s.id, s.name]));
    return p.picked
      .map((v) => pickValueLabel(this.i18n, this.dataText, (id) => names.get(id), p.pick.kind, v))
      .join(', ');
  }

  protected setChanging(key: string, on: boolean): void {
    this.changing.update((l) => (on ? [...new Set([...l, key])] : l.filter((k) => k !== key)));
  }

  protected edit(key: string, values: string[]): void {
    this.drafts.update((d) => ({ ...d, [key]: values }));
  }

  /** Applies the picks marked "Change" (with something picked); the rest are kept. */
  protected done(): void {
    const changed: Record<string, string[]> = {};
    for (const key of this.changing()) {
      const values = this.drafts()[key];
      if (values) changed[key] = values;
    }
    this.answer(changed);
  }

  protected keepAll(): void {
    this.answer({});
  }

  /** Esc or the dialog closed some other way: keep everything. */
  protected onClose(): void {
    if (!this.answered && this.pending().length) this.answer({});
  }

  private answer(changed: Record<string, string[]>): void {
    if (this.answered) return;
    this.answered = true;
    this.dialog()?.nativeElement.close();
    this.changed.emit(answerRestChoices(this.character(), changed));
  }
}
