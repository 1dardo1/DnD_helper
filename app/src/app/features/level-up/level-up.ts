import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CharacterStore } from '../../core/characters/character-store.service';
import { SyncService } from '../../core/characters/sync.service';
import { CompendiumService } from '../../core/compendium/compendium.service';
import {
  Note,
  STEPS,
  TOOL_GROUPS,
  featIssues,
  featsForSlot,
  review,
  spellsFor,
  subclassesFor,
} from '../../core/creation/creation-rules';
import {
  SheetChange,
  addLevel,
  averageHp,
  levelGains,
  multiclassNotes,
  multiclassSkillOptions,
  newFeatures,
  newNotes,
  sheetChanges,
  slotAbility,
  slotFeatId,
  slotPicks,
  spellsGrow,
  withHpGained,
  withLevelHp,
  withSlotAbility,
  withSlotFeat,
} from '../../core/creation/level-up';
import { DataNamePipe, DataTextPipe, DataTextService } from '../../core/i18n/data-text.service';
import { TermPipe, term } from '../../core/i18n/glossary';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { Character, normalizeCharacter } from '../../core/models/character';
import { Ability, ClassOption, DndClass, Feat, Species } from '../../core/models/compendium';
import { swapRule } from '../../core/play/spell-swap';
import { computeSheet } from '../../core/rules/engine';
import { RulesDataService } from '../../core/rules/rules-data.service';
import { Sheet } from '../../core/rules/sheet';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { ENTRY_FACETS } from '../../shared/picker/entry-facets';
import { defaultOrder } from '../../shared/picker/entry-order';
import { Picker } from '../../shared/picker/picker';
import { LoadError } from '../compendium/load-error';

type Step = 'class' | 'hp' | 'subclass' | 'feats' | 'choices' | 'summary';

/**
 * Guided level up: asks only for what the next level brings (which class, hit points, subclass,
 * feat, new spells and options) and shows the sheet before and after. Saves like the wizard.
 */
@Component({
  selector: 'app-level-up',
  imports: [
    RouterLink,
    TranslatePipe,
    TermPipe,
    DataNamePipe,
    DataTextPipe,
    MarkdownPipe,
    LoadError,
    Picker,
  ],
  templateUrl: './level-up.html',
  styleUrl: './level-up.scss',
})
export class LevelUp {
  /** Route parameter. */
  readonly id = input.required<string>();
  private readonly store = inject(CharacterStore);
  private readonly sync = inject(SyncService);
  private readonly rules = inject(RulesDataService);
  private readonly compendium = inject(CompendiumService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly dataText = inject(DataTextService);

  protected readonly step = signal<Step>('class');
  /** The character with the new level and the choices made so far (null = no class chosen). */
  protected readonly draft = signal<Character | null>(null);
  protected readonly classId = signal('');
  /** 'roll' shows the input for the rolled hit points. */
  protected readonly hpMode = signal<'average' | 'roll'>('average');
  protected readonly spellFacets = ENTRY_FACETS.spell.filter((k) => k !== 'class');
  protected readonly saving = signal(false);

  /** Changes when the character shows up (a first visit can arrive before the pull brings it). */
  private readonly present = computed(() =>
    this.store.all().some((r) => r.character.id === this.id()),
  );

  protected readonly data = resource({
    params: () => ({ id: this.id(), present: this.present() }),
    loader: async ({ params }) => {
      const [record, rules, spells, options, meta] = await Promise.all([
        this.store.get(params.id),
        this.rules.load(),
        this.compendium.all('spell'),
        this.compendium.all('option'),
        this.compendium.getMeta(),
      ]);
      const original = record ? normalizeCharacter(record.character) : null;
      return {
        original,
        rules,
        spells,
        spellsById: new Map(spells.map((s) => [s.id, s])),
        options,
        meta,
        classes: [...rules.classes.values()].sort((a, b) => a.name.localeCompare(b.name)),
        feats: [...rules.feats.values()],
        before: original ? computeSheet(original, rules) : null,
      };
    },
  });

  /** The character's classes, and every other one (multiclass), with their prerequisites. */
  protected readonly choices = computed(() => {
    const d = this.data.value();
    if (!d?.original || !d.before) return null;
    const mine = d.original.classes.map((k) => ({ entry: k, cls: d.rules.classes.get(k.id) }));
    const current = mine.map((m) => m.cls).filter((c): c is DndClass => !!c);
    const taken = new Set(d.original.classes.map((k) => k.id));
    const others = this.shown(d.classes)
      .filter((c) => !taken.has(c.id))
      .map((cls) => ({ cls, notes: multiclassNotes(current, cls, d.before!) }));
    return { mine, current, others };
  });

  /** Index of the class that gains the level, in the draft. */
  protected readonly index = computed(
    () => this.draft()?.classes.findIndex((k) => k.id === this.classId()) ?? -1,
  );

  /** What the new level asks for and gives. */
  protected readonly gains = computed(() => {
    const d = this.data.value();
    const ch = this.draft();
    const entry = ch?.classes[this.index()];
    const cls = entry && d?.rules.classes.get(entry.id);
    if (!d?.original || !entry || !cls) return null;
    const sub = entry.subclassId ? d.rules.subclasses.get(entry.subclassId) : undefined;
    const before = d.original.classes.find((k) => k.id === entry.id);
    const g = levelGains(cls, entry.level, before, sub, d.options, !d.original.classes.length);
    const sl = g.spells && spellsFor(g.spells.list, g.spells.sc, entry.level, d.spells);
    return {
      ...g,
      entry,
      sub,
      subclasses: this.shown(subclassesFor(cls.id, [...d.rules.subclasses.values()])),
      // by level required, then by the name shown
      optionGroups: g.optionGroups.map((og) => ({ ...og, options: this.shown(og.options) })),
      spellLists: sl,
      skillOptions: multiclassSkillOptions(cls, g.multiclass),
      instruments: g.multiclass?.instrument ? TOOL_GROUPS['Musical Instrument'] : [],
    };
  });

  protected readonly after = computed(() => {
    const d = this.data.value();
    const ch = this.draft();
    return d && ch ? computeSheet(ch, d.rules) : null;
  });

  /** Only the steps this level needs. */
  protected readonly steps = computed<Step[]>(() => {
    const g = this.gains();
    if (!g) return ['class'];
    const out: Step[] = ['class', 'hp'];
    if (g.needsSubclass) out.push('subclass');
    if (g.featSlots.length) out.push('feats');
    if (this.hasChoices()) out.push('choices');
    out.push('summary');
    return out;
  });

  protected hasChoices(): boolean {
    const g = this.gains();
    if (!g) return false;
    return (
      g.expertise > 0 ||
      spellsGrow(g.spells) ||
      this.canSwapSpell() ||
      g.optionGroups.length > 0 ||
      !!g.multiclass
    );
  }

  /** Bard, Sorcerer, Warlock and subclass casters may replace one spell when gaining a level. */
  protected canSwapSpell(): boolean {
    const g = this.gains();
    return !!g?.spells && g.level > 1 && swapRule(g.cls.id).levelUp === 'one';
  }

  protected readonly changes = computed(() => {
    const before = this.data.value()?.before;
    const after = this.after();
    return before && after ? sheetChanges(before, after) : [];
  });

  protected readonly features = computed(() => {
    const before = this.data.value()?.before;
    const after = this.after();
    return before && after ? newFeatures(before, after) : [];
  });

  /** What the creation review flags now and didn't before the level up. */
  protected readonly notes = computed(() => {
    const d = this.data.value();
    const ch = this.draft();
    if (!d?.original || !ch) return [];
    const ctx = (c: Character, sheet: Sheet | null) => ({
      classes: c.classes.map((k) => d.rules.classes.get(k.id)),
      subclasses: c.classes.map((k) =>
        k.subclassId ? d.rules.subclasses.get(k.subclassId) : undefined,
      ),
      background: c.background ? d.rules.backgrounds.get(c.background.id) : undefined,
      species: c.species ? d.rules.species.get(c.species.id) : undefined,
      sheet,
      feats: d.rules.feats,
      spells: d.spellsById,
    });
    const flat = (c: Character, sheet: Sheet | null) => {
      const r = review(c, ctx(c, sheet));
      return STEPS.flatMap((s) => r[s]);
    };
    return newNotes(flat(d.original, d.before), flat(ch, this.after()));
  });

  // -- helpers -------------------------------------------------------------------------
  protected patch(fn: (c: Character) => Character): void {
    const ch = this.draft();
    if (ch) this.draft.set(fn(structuredClone(ch)));
  }

  protected value(e: Event): string {
    return (e.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected checked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }

  private toggle(list: string[], id: string, on: boolean): string[] {
    return on ? [...new Set([...list, id])] : list.filter((x) => x !== id);
  }

  protected range(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  protected chosenCount(ids: string[], of: { id: string }[]): number {
    const set = new Set(of.map((x) => x.id));
    return ids.filter((id) => set.has(id)).length;
  }

  /** Option group label: the glossary's, else "eldritch-invocation" → "Eldritch Invocation". */
  protected groupLabel(group: string): string {
    const pretty = group.replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
    const translated = term(this.i18n.language(), 'optionGroup', group);
    return translated === group ? pretty : translated;
  }

  /** A note's text, as the creation wizard shows it. */
  protected noteText(n: Note): string {
    const params = { ...n.params };
    if (typeof params['group'] === 'string')
      params['group'] = params['group']
        .split(' / ')
        .map((g) => term(this.i18n.language(), 'toolGroup', g))
        .join(' / ');
    for (const k of ['feat', 'cls'])
      if (typeof params[k] === 'string') params[k] = this.dataText.shortName(params[k] as string);
    if (typeof params['title'] === 'string')
      params['title'] = this.dataText.text(params['title'] as string);
    if (n.key === 'create.issue.rareLanguage')
      params['what'] = term(this.i18n.language(), 'language', String(params['what']));
    else if (typeof params['what'] === 'string')
      params['what'] = params['what'].replace(/\b(STR|DEX|CON|INT|WIS|CHA)\b/g, (a) =>
        this.i18n.t(`abbr.${a}` as never),
      );
    return this.i18n.t(n.key as never, params);
  }

  /** Label of a before/after row. */
  protected changeLabel(c: SheetChange): string {
    const cls = c.classId
      ? ` (${this.dataText.shortName(this.data.value()?.rules.classes.get(c.classId)?.name ?? c.classId)})`
      : '';
    const keys: Record<SheetChange['what'], string> = {
      level: 'levelUp.change.level',
      hp: 'sheet.hitPoints',
      pb: 'sheet.proficiencyBonus',
      hitDice: 'sheet.hitDice',
      ac: 'sheet.armorClass',
      initiative: 'sheet.initiative',
      ability: `ability.${c.ref}`,
      slots: 'levelUp.change.slots',
      pact: 'levelUp.change.pact',
      saveDc: 'sheet.saveDc',
      cantrips: 'sheet.cantrips',
      prepared: 'sheet.prepared',
      resource: '',
    };
    const label =
      c.what === 'resource'
        ? term(this.i18n.language(), 'column', c.ref)
        : this.i18n.t(keys[c.what] as never);
    return label + cls;
  }

  // -- steps ---------------------------------------------------------------------------
  protected stepIndex(): number {
    return this.steps().indexOf(this.step());
  }

  protected go(delta: number): void {
    const steps = this.steps();
    const i = Math.min(Math.max(this.stepIndex() + delta, 0), steps.length - 1);
    this.step.set(steps[i]);
    window.scrollTo?.({ top: 0 });
  }

  // -- 1. class ----------------------------------------------------------------------------
  /** Starts the level over in another class. */
  protected chooseClass(id: string): void {
    const original = this.data.value()?.original;
    this.classId.set(id);
    this.hpMode.set('average');
    this.draft.set(original && id ? addLevel(original, id).character : null);
  }

  // -- 2. hit points -------------------------------------------------------------------------
  protected readonly avg = (die: number) => averageHp(die);

  protected rolledHp(): number | null {
    const entry = this.gains()?.entry;
    return entry?.hp[entry.level - 1] ?? null;
  }

  protected setHpMode(mode: 'average' | 'roll'): void {
    this.hpMode.set(mode);
    if (mode === 'average') this.patch((c) => withLevelHp(c, this.index(), null));
  }

  protected setRolled(raw: string): void {
    const n = parseInt(raw, 10);
    this.patch((c) => withLevelHp(c, this.index(), Number.isNaN(n) ? null : n));
  }

  /** Hit points of the new level (die result or average + Constitution, at least 1). */
  protected hpGained(): number {
    const before = this.data.value()?.before?.hitPoints.max ?? 0;
    return (this.after()?.hitPoints.max ?? 0) - before;
  }

  // -- 3. subclass ---------------------------------------------------------------------------
  protected setSpellAbility(ability: string): void {
    this.patch((c) => {
      const k = c.classes[this.index()];
      if (k) k.spellAbility = (ability || null) as Ability | null;
      return c;
    });
  }

  protected setSubclass(id: string): void {
    const opts = this.data.value()?.options ?? [];
    const original = this.data.value()?.original;
    this.patch((c) => {
      const k = c.classes[this.index()];
      if (!k) return c;
      k.subclassId = id || null;
      // options of another subclass picked in this level up no longer apply
      const stale = new Set(
        opts.filter((o) => o.subclassId && o.subclassId !== k.subclassId).map((o) => o.id),
      );
      c.choices.options = c.choices.options.filter(
        (o) => !stale.has(o) || original?.choices.options.includes(o),
      );
      return c;
    });
  }

  // -- 4. feats ---------------------------------------------------------------------------------
  protected slotFeat(slot: string): string {
    const ch = this.draft();
    return ch ? slotFeatId(ch, slot) : '';
  }

  protected slotFeatEntry(slot: string): Feat | undefined {
    const id = this.slotFeat(slot);
    return id ? this.data.value()?.rules.feats.get(id) : undefined;
  }

  /** Feats for each kind of slot, in the default order (ASI first, then by ability...). */
  private readonly featLists = computed(() => {
    const feats = this.data.value()?.feats ?? [];
    const kinds = ['asi', 'fighting-style', 'epic-boon'] as const;
    return new Map(kinds.map((k) => [k, this.shown(featsForSlot(k, feats, this.speciesEntry()))]));
  });

  /** The character's species (id and sizes), for the racial feat requirements. */
  private speciesEntry(): Species | null {
    const id = this.draft()?.species?.id;
    return (id && this.data.value()?.rules.species.get(id)) || null;
  }

  protected featsFor(kind: 'asi' | 'fighting-style' | 'epic-boon'): Feat[] {
    return this.featLists().get(kind) ?? [];
  }

  /** In the default order of their type, by the name shown. */
  private shown<T extends { name: string }>(xs: readonly T[]): T[] {
    return defaultOrder(xs, (x) => this.dataText.shortName(x.name));
  }

  protected featProblems(feat: Feat | undefined): Note[] {
    const sheet = this.after();
    if (!feat || !sheet) return [];
    return featIssues(feat, sheet, this.speciesEntry()).map((n) => ({
      ...n,
      params: { ...n.params, feat: feat.name },
    }));
  }

  protected readonly slotPicks = slotPicks;

  protected slotAbility(slot: string, n: number): string {
    const ch = this.draft();
    return ch ? slotAbility(ch, slot, n) : '';
  }

  protected setSlotFeat(slot: string, featId: string): void {
    this.patch((c) => withSlotFeat(c, slot, featId));
  }

  protected setSlotAbility(slot: string, n: number, ability: string, picks: number): void {
    this.patch((c) => withSlotAbility(c, slot, n, ability as Ability | '', picks));
  }

  // -- 5. other choices -------------------------------------------------------------------------
  /** Skills the character is proficient in, for Expertise. */
  protected proficientSkills(): string[] {
    const d = this.data.value();
    const ch = this.draft();
    const bg = ch?.background ? d?.rules.backgrounds.get(ch.background.id)?.skills : [];
    return [...new Set([...(bg ?? []), ...(ch?.choices.skills ?? [])])];
  }

  /** What was picked in this level up only (not before it). */
  protected newPicks(list: 'expertise' | 'skills' | 'spells' | 'options', of?: { id: string }[]) {
    const had = new Set(this.data.value()?.original?.choices[list] ?? []);
    const ids = (this.draft()?.choices[list] ?? []).filter((x) => !had.has(x));
    return of ? ids.filter((x) => of.some((o) => o.id === x)) : ids;
  }

  protected setExpertise(id: string, on: boolean): void {
    this.patch((c) => ({
      ...c,
      choices: { ...c.choices, expertise: this.toggle(c.choices.expertise, id, on) },
    }));
  }

  /** The skill a new class grants: replaces the one picked before in this level up. */
  protected setMulticlassSkill(skill: string): void {
    const original = this.data.value()?.original;
    if (!original) return;
    this.patch((c) => {
      const skills = [...original.choices.skills, ...(skill ? [skill] : [])];
      c.choices.skills = [...new Set(skills)];
      c.choices.expertise = c.choices.expertise.filter(
        (s) => original.choices.expertise.includes(s) || this.proficientIn(c, s),
      );
      return c;
    });
  }

  private proficientIn(c: Character, skill: string): boolean {
    const bg = c.background ? this.data.value()?.rules.backgrounds.get(c.background.id) : undefined;
    return c.choices.skills.includes(skill) || !!bg?.skills.includes(skill);
  }

  protected multiclassSkill(): string {
    return this.newPicks('skills')[0] ?? '';
  }

  /** The tool picked in a one-tool slot ('' = none). */
  protected toolIn(slot: string): string {
    return this.draft()?.choices.toolChoices.find((t) => t.slot === slot)?.tools[0] ?? '';
  }

  protected setTool(slot: string, tool: string): void {
    this.patch((c) => {
      c.choices.toolChoices = [
        ...c.choices.toolChoices.filter((t) => t.slot !== slot),
        ...(tool ? [{ slot, tools: [tool] }] : []),
      ];
      return c;
    });
  }

  protected setOption(id: string, on: boolean): void {
    this.patch((c) => ({
      ...c,
      choices: { ...c.choices, options: this.toggle(c.choices.options, id, on) },
    }));
  }

  protected setSpell(id: string, on: boolean): void {
    this.patch((c) => ({
      ...c,
      choices: { ...c.choices, spells: this.toggle(c.choices.spells, id, on) },
    }));
  }

  /** Options above the class level are listed but flagged. */
  protected optionTooHigh(o: ClassOption, level: number): boolean {
    return (o.prerequisites?.level ?? 0) > level;
  }

  // -- save ---------------------------------------------------------------------------------------
  protected async save(): Promise<void> {
    const d = this.data.value();
    const ch = this.draft();
    if (!d || !ch || this.saving()) return;
    this.saving.set(true);
    try {
      const saved = withHpGained(
        { ...ch, dataVersion: d.meta.generatedAt ?? ch.dataVersion },
        this.hpGained(),
      );
      await this.sync.save(saved);
      await this.router.navigate(['/characters', saved.id]);
    } finally {
      this.saving.set(false);
    }
  }
}
