import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';

import { ALL_TOOLS, TOOL_GROUPS } from '../core/creation/creation-rules';
import { DataTextService } from '../core/i18n/data-text.service';
import { TermPipe, term } from '../core/i18n/glossary';
import { I18nService, TranslatePipe } from '../core/i18n/i18n.service';
import { Spell } from '../core/models/compendium';
import { togglePick } from '../core/rules/feat-effects';
import { SpeciesPick, WEAPON_PREFIX } from '../core/rules/species-picks';
import { SKILL_IDS } from '../core/rules/trait-choices';
import { MarkdownPipe } from './markdown.pipe';
import { ENTRY_FACETS } from './picker/entry-facets';
import { Picker } from './picker/picker';

/** An option of an 'option' pick as shown: translated name and text. */
export interface PickOptionLabel {
  label: string;
  text: string;
}

/**
 * One pick inside a species trait (core/rules/species-picks.ts): skills, a damage type, tools,
 * weapons or tools, a cantrip (the same card picker with filters and "See more" the feats use), or
 * some of a trait's named options. It only reports the new list of values; the screen stores it in
 * `choices.traitPicks[pick.key]`. Values the character already has from elsewhere (`had`) are
 * flagged, and can't be picked when the text asks for something new.
 */
@Component({
  selector: 'app-trait-picks',
  imports: [NgTemplateOutlet, TranslatePipe, TermPipe, MarkdownPipe, Picker],
  template: `
    @let p = pick();
    <fieldset class="trait-pick" [attr.data-testid]="'trait-pick-' + p.key">
      <legend>
        {{ 'create.traitPick.' + p.pick.kind | t: { trait: traitName(), count: p.count } }}
        ({{ p.picked.length }}/{{ p.count }})
      </legend>
      @if (p.pick.rest && !compact()) {
        <p class="hint">{{ 'traitpick.rest.' + p.pick.rest | t }}</p>
      }
      @if (p.pick.notHad) {
        <p class="hint">{{ 'traitpick.notHad' | t }}</p>
      }
      @if (p.pick.replaces) {
        <p class="hint">{{ 'traitpick.replaces' | t: { spell: spellName(p.pick.replaces) } }}</p>
      }
      @switch (p.pick.kind) {
        @case ('cantrip') {
          <app-picker
            [multiple]="p.count > 1"
            [items]="cantrips()"
            [facets]="spellFacets"
            [selected]="p.picked"
            [marks]="cantripMarks()"
            [label]="'create.traitPick.cantrip' | t: { trait: traitName(), count: p.count }"
            (picked)="pickCantrip($event.id, $event.on)"
          />
        }
        @case ('option') {
          @for (o of p.options ?? []; track o.name) {
            <label class="opt">
              <input
                [type]="p.count > 1 || (p.pick.unlock?.length ?? 0) > 1 ? 'checkbox' : 'radio'"
                [name]="p.key"
                [checked]="p.picked.includes(o.name)"
                [disabled]="
                  o.level > level() || (!p.picked.includes(o.name) && full() && p.count > 1)
                "
                (change)="toggle(o.name, checked($event))"
              />
              <span class="txt">
                <span class="nm">
                  {{ optionLabel(o.name) }}
                  @if (o.level > level()) {
                    <small>{{ 'traitpick.level' | t: { level: o.level } }}</small>
                  }
                </span>
                <span class="md" [innerHTML]="optionText(o.name, o.text) | markdown"></span>
              </span>
            </label>
          }
        }
        @case ('form') {
          @for (o of p.pick.from ?? []; track o) {
            <label class="inline">
              <input
                type="radio"
                [name]="p.key"
                [checked]="p.picked.includes(o)"
                (change)="toggle(o, checked($event))"
              />
              {{ 'traitpick.form.' + o | t }}
            </label>
          }
        }
        @case ('skill') {
          @for (o of p.pick.from ?? allSkills; track o) {
            <label class="inline" [class.had]="had().has(o)">
              <input
                type="checkbox"
                [checked]="p.picked.includes(o)"
                [disabled]="blocked(o)"
                (change)="toggle(o, checked($event))"
              />
              {{ 'skill.' + o | t }}
              @if (had().has(o)) {
                <small>({{ 'traitpick.had' | t }})</small>
              }
            </label>
          }
        }
        @case ('resistance') {
          @for (o of p.pick.from ?? []; track o) {
            <label class="inline">
              <input
                type="checkbox"
                [checked]="p.picked.includes(o)"
                [disabled]="blocked(o)"
                (change)="toggle(o, checked($event))"
              />
              {{ o | term: 'damage' }}
            </label>
          }
        }
        @case ('tool') {
          @if (p.pick.group) {
            @for (o of groupTools(); track o) {
              <label class="inline" [class.had]="had().has(o)">
                <input
                  type="checkbox"
                  [checked]="p.picked.includes(o)"
                  [disabled]="blocked(o)"
                  (change)="toggle(o, checked($event))"
                />
                {{ o | term: 'tool' }}
                @if (had().has(o)) {
                  <small>({{ 'traitpick.had' | t }})</small>
                }
              </label>
            }
          } @else {
            <ng-container *ngTemplateOutlet="slots" />
          }
        }
        @default {
          <ng-container *ngTemplateOutlet="slots" />
        }
      }
    </fieldset>

    <!-- one select per pick, for the long lists (any tool, weapon or tool, skill or tool) -->
    <ng-template #slots>
      @for (n of slotIndexes(); track n) {
        <label class="slot">
          <span>{{ 'traitpick.slot' | t: { n: n + 1 } }}</span>
          <select (change)="setSlot(n, value($event))" [attr.data-testid]="'trait-pick-slot-' + n">
            <option value="" [selected]="!pick().picked[n]">—</option>
            @for (g of groups(); track g.label) {
              <optgroup [label]="g.label | t">
                @for (o of g.values; track o) {
                  <option
                    [value]="o"
                    [selected]="pick().picked[n] === o"
                    [disabled]="(blocked(o) || takenElsewhere(o, n)) && pick().picked[n] !== o"
                  >
                    {{ valueLabel(o) }}{{ had().has(o) ? ' (' + ('traitpick.had' | t) + ')' : '' }}
                  </option>
                }
              </optgroup>
            }
          </select>
        </label>
      }
    </ng-template>
  `,
  styles: `
    /* inline choices (skills, forms) side by side; option texts and selectors take the row */
    .trait-pick {
      min-width: 0;
      display: flex;
      flex-flow: row wrap;
      align-items: center;
      gap: 0.4rem 0.9rem;
    }
    .hint,
    .opt,
    .slot,
    app-picker {
      flex: 1 1 100%;
      min-width: 0;
    }
    .hint {
      margin: 0;
      font-size: 0.9em;
      opacity: 0.85;
    }
    .opt {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
    }
    .opt input {
      margin-top: 0.3rem;
    }
    .txt {
      display: flex;
      flex-direction: column;
    }
    .nm {
      font-weight: 600;
    }
    .slot {
      display: grid;
      gap: 0.2rem;
    }
    .slot select {
      width: 100%;
      max-width: 100%;
    }
  `,
})
export class TraitPicks {
  readonly pick = input.required<SpeciesPick>();
  /** Every spell (for a cantrip pick). */
  readonly spells = input<readonly Spell[]>([]);
  /** Names of the weapons that can be picked (simple and martial, not magic). */
  readonly weapons = input<readonly string[]>([]);
  /** Values the character already has from elsewhere (species-picks.ts' `hadValues`). */
  readonly had = input<ReadonlySet<string>>(new Set());
  readonly level = input(1);
  /** Translated names/texts of an 'option' pick's options, by English name. */
  readonly labels = input<Readonly<Record<string, PickOptionLabel>>>({});
  /** Inside the rest dialog: no reminder that it can be changed on rests. */
  readonly compact = input(false);
  readonly changed = output<string[]>();

  private readonly dataText = inject(DataTextService);
  private readonly i18n = inject(I18nService);

  protected readonly allSkills = [...SKILL_IDS];
  protected readonly spellFacets = ENTRY_FACETS.spell.filter((k) => k !== 'level');

  protected readonly traitName = computed(() => this.dataText.shortName(this.pick().trait));
  protected readonly full = computed(() => this.pick().picked.length >= this.pick().count);

  protected readonly cantrips = computed(() => {
    const p = this.pick().pick;
    return this.spells().filter(
      (s) =>
        s.level === 0 &&
        (p.from ? p.from.includes(s.id) : !p.lists || p.lists.some((l) => s.classes.includes(l))),
    );
  });

  protected readonly cantripMarks = computed(() => {
    const out: Record<string, string> = {};
    const note = this.i18n.t('traitpick.had');
    for (const id of this.had()) out[id] = note;
    return out;
  });

  protected readonly groupTools = computed(() => TOOL_GROUPS[this.pick().pick.group ?? ''] ?? []);

  /** The lists of the selects: skills, weapons, tools, as the pick allows. */
  protected readonly groups = computed(() => {
    const kind = this.pick().pick.kind;
    const out: { label: string; values: string[] }[] = [];
    if (kind === 'skill-or-tool')
      out.push({ label: 'featchoice.group.skills', values: [...SKILL_IDS] });
    if (kind === 'weapon-or-tool')
      out.push({
        label: 'traitpick.group.weapons',
        values: this.weapons().map((w) => `${WEAPON_PREFIX}${w}`),
      });
    out.push({ label: 'featchoice.group.tools', values: ALL_TOOLS });
    return out;
  });

  protected slotIndexes(): number[] {
    return Array.from({ length: this.pick().count }, (_, i) => i);
  }

  /** Can't be ticked: the pick is full, or it must be something new and the character has it. */
  protected blocked(value: string): boolean {
    const p = this.pick();
    if (p.picked.includes(value)) return false;
    return (p.pick.notHad && this.had().has(value)) || (this.full() && p.count > 1);
  }

  protected takenElsewhere(value: string, n: number): boolean {
    return this.pick().picked.some((v, i) => i !== n && v === value);
  }

  protected valueLabel(v: string): string {
    if (SKILL_IDS.has(v)) return this.i18n.t(`skill.${v}` as never);
    if (v.startsWith(WEAPON_PREFIX)) return this.dataText.shortName(v.slice(WEAPON_PREFIX.length));
    return this.dataText.shortName(v);
  }

  protected optionLabel(name: string): string {
    return this.labels()[name]?.label ?? this.dataText.shortName(name);
  }

  protected optionText(name: string, text: string): string {
    return this.labels()[name]?.text ?? this.dataText.text(text);
  }

  protected spellName(id: string): string {
    const sp = this.spells().find((s) => s.id === id);
    return this.dataText.shortName(sp?.name ?? id);
  }

  protected toggle(value: string, on: boolean): void {
    const p = this.pick();
    // a single pick (radio): the new value replaces the old one
    if (p.count === 1 && on) return this.changed.emit([value]);
    this.changed.emit(togglePick(p.picked, value, on, p.count));
  }

  protected pickCantrip(id: string, on: boolean): void {
    this.toggle(id, on);
  }

  protected setSlot(n: number, value: string): void {
    const list = [...this.pick().picked];
    list[n] = value;
    this.changed.emit(list.filter(Boolean));
  }

  protected checked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }

  protected value(e: Event): string {
    return (e.target as HTMLSelectElement).value;
  }
}

/**
 * A picked value as shown on the sheet and in the rest dialog: a skill, tool, weapon, damage type,
 * cantrip, option or ability, in the current language.
 */
export function pickValueLabel(
  i18n: I18nService,
  dataText: DataTextService,
  spellName: (id: string) => string | undefined,
  kind: string,
  value: string,
): string {
  if (kind === 'ability') return i18n.t(`ability.${value}` as never);
  if (kind === 'form') return i18n.t(`traitpick.form.${value}` as never);
  if (SKILL_IDS.has(value) && kind !== 'cantrip') return i18n.t(`skill.${value}` as never);
  if (kind === 'resistance') return term(i18n.language(), 'damage', value);
  if (kind === 'cantrip') return dataText.shortName(spellName(value) ?? value);
  if (value.startsWith(WEAPON_PREFIX)) return dataText.shortName(value.slice(WEAPON_PREFIX.length));
  if (kind === 'option') return dataText.shortName(value);
  return term(i18n.language(), 'tool', value);
}
