import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, output, resource, signal } from '@angular/core';

import { CompendiumService } from '../../core/compendium/compendium.service';
import {
  expandedSpellIds,
  extraSpellLists,
  spellListOf,
  spellsFor,
} from '../../core/creation/creation-rules';
import {
  isChosenFor,
  replaceSpellFor,
  spellCasters,
  spellFields,
  spellsByClassOf,
  spellsOf,
  toggleSpellFor,
} from '../../core/creation/spell-choices';
import {
  spellbookOf,
  spellbookRule,
  spellbookSize,
  toggleInBook,
} from '../../core/creation/spellbook';
import { matchesQuery } from '../../core/characters/sheet-helpers';
import { DataNamePipe, DataTextService } from '../../core/i18n/data-text.service';
import { PhrasePipe } from '../../core/i18n/glossary';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { Sheet } from '../../core/rules/sheet';
import { Character } from '../../core/models/character';
import { dropConcentration, startConcentration } from '../../core/play/concentration';
import { Spell } from '../../core/models/compendium';
import { castingOf } from '../../core/rules/engine';
import { RulesDataService } from '../../core/rules/rules-data.service';
import { EntryDetails } from '../../shared/picker/entry-details';
import { defaultOrder } from '../../shared/picker/entry-order';
import { SwipeDirective, stepOf } from '../../shared/swipe.directive';
import { ConcentrationNotices } from './concentration-notice';

interface Caster {
  classId: string;
  name: string;
  cantrips: Spell[];
  prepared: Spell[];
  /** Leveled spells it could prepare now. */
  available: Spell[];
  /** Cantrips of its list, and how many it knows. */
  availableCantrips: Spell[];
  maxCantrips: number | null;
  maxPrepared: number | null;
  swap: 'any' | 'one' | null;
  /** Spells its features keep always prepared (domain, circle, oath...): not counted, not removable. */
  always: Spell[];
  /** Where the always-prepared spells come from ("Circle of the Moon"). */
  alwaysFrom: string[];
  /**
   * The Wizard's spellbook (core/creation/spellbook.ts): the spells in it, how many it gets for
   * free at this level, and those that can be written in (a level with spell slots).
   */
  book: { spells: Spell[]; size: number; candidates: Spell[] } | null;
}

/**
 * The character's spells by class, and changing the prepared ones when the rules allow it
 * (state.spellSwap, set by a Long Rest).
 */
@Component({
  selector: 'app-spell-book',
  imports: [
    NgTemplateOutlet,
    TranslatePipe,
    DataNamePipe,
    PhrasePipe,
    SwipeDirective,
    EntryDetails,
  ],
  templateUrl: './spell-book.html',
  styleUrl: './spell-book.scss',
})
export class SpellBook {
  readonly character = input.required<Character>();
  /** The computed sheet: cantrips known and the spells the class features keep prepared. */
  readonly sheet = input<Sheet | null>(null);
  /** The character with its new spells (and the swap used up). */
  readonly changed = output<Character>();

  private readonly compendium = inject(CompendiumService);
  private readonly rules = inject(RulesDataService);
  private readonly dataText = inject(DataTextService);
  private readonly notices = inject(ConcentrationNotices);

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
      const sheet = this.sheet();
      // a 2014 Warlock patron's expanded list is added to the spells to choose from
      const forList = spellsFor(
        list,
        sc,
        entry.level,
        d.spells,
        expandedSpellIds(sub, entry.level),
        extraSpellLists(cls, entry.level, sub),
      );
      const rule = spellbookRule(cls);
      const bookIds = rule ? new Set(spellbookOf(ch, cls.id, by, byId)) : null;
      const book = rule
        ? {
            spells: this.shown(
              [...bookIds!].map((id) => byId.get(id)).filter((x): x is Spell => !!x),
            ),
            size: spellbookSize(rule, entry.level),
            candidates: this.shown(forList.leveled),
          }
        : null;
      out.push({
        classId: cls.id,
        name: cls.name,
        cantrips: mine.filter((s) => s.level === 0),
        prepared: mine.filter((s) => s.level > 0),
        // a Wizard prepares from the spells in the book
        available: this.shown(
          bookIds ? forList.leveled.filter((x) => bookIds.has(x.id)) : forList.leveled,
        ),
        availableCantrips: this.shown(forList.cantrips),
        maxCantrips:
          sheet?.spellcasting.classes.find((x) => x.classId === cls.id)?.cantrips ??
          sc.cantripsByLevel?.[entry.level - 1] ??
          null,
        maxPrepared: sc.preparedByLevel?.[entry.level - 1] ?? null,
        swap: ch.state.spellSwap?.[cls.id] ?? null,
        always: this.shown(
          alwaysOf(sheet, cls.id)
            .map((f) => byId.get(f.id))
            .filter((x): x is Spell => !!x),
        ),
        alwaysFrom: [...new Set(alwaysOf(sheet, cls.id).map((f) => f.feat.name))],
        book,
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

  protected inBook(c: Caster, id: string): boolean {
    return !!c.book?.spells.some((x) => x.id === id);
  }

  /** Writes a spell in the book or takes it out (and out of the prepared ones). */
  protected toggleBook(c: Caster, id: string): void {
    const d = this.data.value();
    if (!d) return;
    const ch = this.character();
    const byId = new Map(d.spells.map((x) => [x.id, x]));
    const out = toggleInBook(ch, c.classId, this.picked(), byId, id, !this.inBook(c, id));
    const next = this.withPicks(ch, out.by);
    this.changed.emit({ ...next, choices: { ...next.choices, spellbook: out.book } });
  }

  protected isConcentrating(id: string): boolean {
    return this.character().state.concentration?.spellId === id;
  }

  /** Marks the spell as the one being concentrated on (replacing, and saying so, any other). */
  protected concentrate(spell: Spell): void {
    const ch = this.character();
    const out = startConcentration(ch.state, spell.id);
    if (out.replaced) this.notices.show({ kind: 'replaced', oldId: out.replaced, newId: spell.id });
    this.changed.emit({ ...ch, state: out.state });
  }

  protected release(): void {
    const ch = this.character();
    this.changed.emit({ ...ch, state: dropConcentration(ch.state) });
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

  /** The quick search over the spells (shown when there are many). */
  protected readonly query = signal('');
  protected readonly total = computed(() =>
    this.casters().reduce((n, c) => n + c.cantrips.length + c.prepared.length, 0),
  );

  /** The spells of a list that match the search (by their English or translated name). */
  protected shownOf(list: Spell[]): Spell[] {
    const q = this.query();
    return q.trim()
      ? list.filter((s) => matchesQuery(q, s.name, this.dataText.name(s.name)))
      : list;
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

/** The leveled spells a class's own features keep prepared (domain, circle, oath spells...). */
function alwaysOf(sheet: Sheet | null, classId: string) {
  return (sheet?.featSpells ?? []).filter(
    (f) => f.classId === classId && f.always && f.cantrip !== true,
  );
}
