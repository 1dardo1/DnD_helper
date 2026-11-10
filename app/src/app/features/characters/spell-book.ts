import { Component, computed, inject, input, output, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CompendiumService } from '../../core/compendium/compendium.service';
import { spellListOf, spellsFor } from '../../core/creation/creation-rules';
import {
  isChosenFor,
  replaceSpellFor,
  spellCasters,
  spellFields,
  spellsByClassOf,
  spellsOf,
  toggleSpellFor,
} from '../../core/creation/spell-choices';
import { DataNamePipe, DataTextService } from '../../core/i18n/data-text.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { Character } from '../../core/models/character';
import { Spell } from '../../core/models/compendium';
import { castingOf } from '../../core/rules/engine';
import { RulesDataService } from '../../core/rules/rules-data.service';
import { defaultOrder } from '../../shared/picker/entry-order';
import { SwipeDirective, stepOf } from '../../shared/swipe.directive';

interface Caster {
  classId: string;
  name: string;
  cantrips: Spell[];
  prepared: Spell[];
  /** Leveled spells it could prepare now. */
  available: Spell[];
  maxPrepared: number | null;
  swap: 'any' | 'one' | null;
}

/**
 * The character's spells by class, and changing the prepared ones when the rules allow it
 * (state.spellSwap, set by a Long Rest).
 */
@Component({
  selector: 'app-spell-book',
  imports: [RouterLink, TranslatePipe, DataNamePipe, SwipeDirective],
  templateUrl: './spell-book.html',
  styleUrl: './spell-book.scss',
})
export class SpellBook {
  readonly character = input.required<Character>();
  /** The character with its new spells (and the swap used up). */
  readonly changed = output<Character>();

  private readonly compendium = inject(CompendiumService);
  private readonly rules = inject(RulesDataService);
  private readonly dataText = inject(DataTextService);

  private readonly data = resource({
    loader: async () => {
      const [rules, spells] = await Promise.all([this.rules.load(), this.compendium.all('spell')]);
      return { rules, spells };
    },
  });

  /** Class being edited ('any') and the pair being swapped ('one'). */
  protected readonly editing = signal<string | null>(null);
  protected readonly swapOut = signal('');
  protected readonly swapIn = signal('');

  /** The spells picked for each class (worked out for characters from before they were kept). */
  private readonly picked = computed(() => {
    const d = this.data.value();
    const ch = this.character();
    if (!d) return {};
    return spellsByClassOf(
      ch.choices,
      spellCasters(ch, d.rules.classes, d.rules.subclasses),
      new Map(d.spells.map((s) => [s.id, s])),
    );
  });

  protected readonly casters = computed<Caster[]>(() => {
    const d = this.data.value();
    if (!d) return [];
    const ch = this.character();
    const byId = new Map(d.spells.map((s) => [s.id, s]));
    const by = this.picked();
    const out: Caster[] = [];
    for (const entry of ch.classes) {
      const cls = d.rules.classes.get(entry.id);
      if (!cls) continue;
      const sub = entry.subclassId ? d.rules.subclasses.get(entry.subclassId) : undefined;
      const sc = castingOf(cls, sub);
      if (!sc) continue;
      const list = spellListOf(cls, sc);
      // what was picked for this class (by level, cantrips by name, as the compendium lists them)
      const mine = this.shown(
        spellsOf(by, cls.id)
          .map((id) => byId.get(id))
          .filter((s): s is Spell => !!s),
      );
      out.push({
        classId: cls.id,
        name: cls.name,
        cantrips: mine.filter((s) => s.level === 0),
        prepared: mine.filter((s) => s.level > 0),
        available: this.shown(spellsFor(list, sc, entry.level, d.spells).leveled),
        maxPrepared: sc.preparedByLevel?.[entry.level - 1] ?? null,
        swap: ch.state.spellSwap?.[cls.id] ?? null,
      });
    }
    return out;
  });

  /** In the default order of spells (level, without concentration first, name shown). */
  private shown(spells: readonly Spell[]): Spell[] {
    return defaultOrder(spells, (s) => this.dataText.shortName(s.name));
  }

  protected isChosen(classId: string, id: string): boolean {
    return isChosenFor(this.picked(), classId, id);
  }

  private withPicks(ch: Character, by: Record<string, string[]>): Character {
    return { ...ch, choices: { ...ch.choices, ...spellFields(by) } };
  }

  protected toggle(classId: string, id: string): void {
    const on = !this.isChosen(classId, id);
    this.changed.emit(
      this.withPicks(this.character(), toggleSpellFor(this.picked(), classId, id, on)),
    );
  }

  protected swapOne(c: Caster): void {
    const ch = this.withPicks(
      this.character(),
      replaceSpellFor(this.picked(), c.classId, this.swapOut(), this.swapIn()),
    );
    this.swapOut.set('');
    this.swapIn.set('');
    this.finish(c, ch);
  }

  /** Done changing (or not changing) this class's spells: the swap is used up. */
  protected finish(c: Caster, ch = this.character()): void {
    const spellSwap = { ...(ch.state.spellSwap ?? {}) };
    delete spellSwap[c.classId];
    this.editing.set(null);
    this.changed.emit({ ...ch, state: { ...ch.state, spellSwap } });
  }

  /** Phones, with two or more casting classes: the one shown (a strip of tabs, or a swipe). */
  protected readonly shownCaster = signal(0);

  protected swipe(dir: 'left' | 'right'): void {
    const n = this.casters().length;
    if (n > 1) this.shownCaster.set(stepOf(Math.min(this.shownCaster(), n - 1), n, dir));
  }

  protected value(e: Event): string {
    return (e.target as HTMLSelectElement).value;
  }
}
