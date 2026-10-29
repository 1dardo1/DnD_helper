import { Component, computed, effect, inject, input, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CharacterStore } from '../../core/characters/character-store.service';
import { SyncService } from '../../core/characters/sync.service';
import { CompendiumService } from '../../core/compendium/compendium.service';
import {
  POINT_BUY_BUDGET,
  STANDARD_ARRAY,
  STEPS,
  Step,
  expertiseCount,
  featSlots,
  featsForSlot,
  missing,
  optionGroupsFor,
  pointBuyCost,
  spellsFor,
  subclassesFor,
} from '../../core/creation/creation-rules';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { Character, newCharacter, normalizeCharacter } from '../../core/models/character';
import { Ability, Feat } from '../../core/models/compendium';
import { computeSheet } from '../../core/rules/engine';
import { RulesDataService } from '../../core/rules/rules-data.service';
import { ABILITIES, SKILL_ABILITY } from '../../core/rules/tables';
import { SettingsService } from '../../core/settings/settings.service';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { LoadError } from '../compendium/load-error';

const DRAFT_KEY = 'dnd-helper.draft';

/**
 * Character creation (and editing) wizard, step by step in the 2024 order. The draft is kept in
 * this browser until saved, and every step shows the sheet the rules engine computes from it.
 */
@Component({
  selector: 'app-character-create',
  imports: [RouterLink, TranslatePipe, MarkdownPipe, LoadError],
  templateUrl: './character-create.html',
  styleUrl: './character-create.scss',
})
export class CharacterCreate {
  /** Route parameter when editing an existing character (characters/:id/edit). */
  readonly id = input<string>();
  private readonly compendium = inject(CompendiumService);
  private readonly rules = inject(RulesDataService);
  private readonly store = inject(CharacterStore);
  private readonly sync = inject(SyncService);
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsService);
  private readonly i18n = inject(I18nService);

  protected readonly steps = STEPS;
  protected readonly abilities = ABILITIES;
  protected readonly skills = Object.keys(SKILL_ABILITY);
  protected readonly standardArray = STANDARD_ARRAY;
  protected readonly budget = POINT_BUY_BUDGET;

  protected readonly step = signal<Step>('class');
  protected readonly draft = signal<Character>(newCharacter('', ''));
  protected readonly spellFilter = signal('');
  private loadedFor: string | null | undefined = undefined;

  /** Everything the wizard offers choices from. */
  protected readonly data = resource({
    loader: async () => {
      const [rules, spells, options, meta] = await Promise.all([
        this.rules.load(),
        this.compendium.all('spell'),
        this.compendium.all('option'),
        this.compendium.getMeta(),
      ]);
      const sorted = <T extends { name: string }>(xs: Iterable<T>) =>
        [...xs].sort((a, b) => a.name.localeCompare(b.name));
      return {
        rules,
        spells,
        options,
        meta,
        classes: sorted(rules.classes.values()),
        species: sorted(rules.species.values()),
        backgrounds: sorted(rules.backgrounds.values()),
        feats: [...rules.feats.values()],
        armor: sorted(
          [...rules.items.values()].filter((i) => i.armor && i.armor.kind !== 'shield' && !i.magic),
        ),
      };
    },
  });

  // -- what's selected ----------------------------------------------------------------
  protected readonly classEntry = computed(
    (): Character['classes'][number] | undefined => this.draft().classes[0],
  );
  protected readonly cls = computed(() => {
    const id = this.classEntry()?.id;
    return id ? this.data.value()?.rules.classes.get(id) : undefined;
  });
  protected readonly level = computed(() => this.classEntry()?.level ?? 1);
  protected readonly background = computed(() => {
    const id = this.draft().background?.id;
    return id ? this.data.value()?.rules.backgrounds.get(id) : undefined;
  });
  protected readonly species = computed(() => {
    const id = this.draft().species?.id;
    return id ? this.data.value()?.rules.species.get(id) : undefined;
  });
  protected readonly subclasses = computed(() => {
    const d = this.data.value();
    const c = this.cls();
    return d && c ? subclassesFor(c.id, [...d.rules.subclasses.values()]) : [];
  });
  protected readonly slots = computed(() => {
    const c = this.cls();
    return c ? featSlots(c, this.level()) : [];
  });
  protected readonly expertise = computed(() => {
    const c = this.cls();
    return c ? expertiseCount(c, this.level()) : 0;
  });
  protected readonly optionGroups = computed(() => {
    const d = this.data.value();
    const c = this.cls();
    return d && c
      ? optionGroupsFor(c, this.level(), this.classEntry()?.subclassId ?? null, d.options)
      : [];
  });
  protected readonly spellLists = computed(() => {
    const d = this.data.value();
    const c = this.cls();
    if (!d || !c?.spellcasting) return null;
    const q = this.spellFilter().toLowerCase();
    const { cantrips, leveled } = spellsFor(c, this.level(), d.spells);
    const match = (s: { name: string }) => !q || s.name.toLowerCase().includes(q);
    const sc = c.spellcasting;
    return {
      cantrips: cantrips.filter(match),
      leveled: leveled.filter(match),
      cantripCount: sc.cantripsByLevel?.[this.level() - 1] ?? null,
      preparedCount: sc.preparedByLevel?.[this.level() - 1] ?? null,
    };
  });

  /** The sheet as it stands, recomputed on every change. */
  protected readonly sheet = computed(() => {
    const d = this.data.value();
    return d ? computeSheet(this.draft(), d.rules) : null;
  });
  protected readonly missing = computed(() =>
    missing(this.draft(), {
      cls: this.cls(),
      background: this.background(),
      speciesHasVariants: !!this.species()?.variants.length,
    }),
  );
  protected readonly allMissing = computed(() => STEPS.flatMap((s) => this.missing()[s]));

  constructor() {
    // Load the character being edited, or the saved draft of a new one.
    effect(() => {
      const id = this.id() ?? null;
      if (this.loadedFor === id) return;
      this.loadedFor = id;
      if (id) {
        void this.store.get(id).then((r) => r && this.draft.set(normalizeCharacter(r.character)!));
      } else {
        this.draft.set(loadDraft() ?? newCharacter('', this.settings.settings().deviceName));
      }
    });
    // Keep the draft of a new character in this browser until it's saved.
    effect(() => {
      if (!this.id()) saveDraft(this.draft());
    });
  }

  // -- generic helpers -----------------------------------------------------------------
  protected patch(fn: (c: Character) => Character): void {
    this.draft.update((c) => fn(structuredClone(c)));
  }

  protected value(e: Event): string {
    return (e.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected checked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }

  protected toggle(list: string[], id: string, on: boolean): string[] {
    return on ? [...new Set([...list, id])] : list.filter((x) => x !== id);
  }

  /** A step is ticked when nothing is missing and something was actually chosen in it. */
  protected isDone(s: Step): boolean {
    if (this.missing()[s].length) return false;
    if (s === 'choices') return !!this.cls();
    if (s === 'equipment') return !!this.draft().equipment;
    return true;
  }

  protected stepIndex(): number {
    return STEPS.indexOf(this.step());
  }

  protected go(delta: number): void {
    const i = Math.min(Math.max(this.stepIndex() + delta, 0), STEPS.length - 1);
    this.setStep(STEPS[i]);
  }

  protected setStep(s: Step): void {
    if (s === 'equipment') this.prefillEquipment();
    this.step.set(s);
  }

  protected readonly skillLabel = (s: string) => this.i18n.t(`skill.${s}` as never);
  protected readonly abilityLabel = (a: string) => this.i18n.t(`ability.${a}` as never);

  protected withName(name: string) {
    return (c: Character) => ({ ...c, name });
  }

  protected withNotes(notes: string) {
    return (c: Character) => ({ ...c, notes });
  }

  protected withEquipment(equipment: string) {
    return (c: Character) => ({ ...c, equipment });
  }

  protected withArmor(armorId: string) {
    return (c: Character) => ({ ...c, equipped: { ...c.equipped, armorId: armorId || null } });
  }

  protected withShield(shield: boolean) {
    return (c: Character) => ({ ...c, equipped: { ...c.equipped, shield } });
  }

  // -- class ---------------------------------------------------------------------------
  protected setClass(id: string): void {
    const cls = this.data.value()?.rules.classes.get(id);
    this.patch((c) => {
      const level = c.classes[0]?.level ?? 1;
      c.classes = id ? [{ id, level, subclassId: null, hp: Array(level).fill(null) }] : [];
      // choices that belonged to the previous class
      c.choices.skills = c.choices.skills.filter((s) => cls?.proficiencies.skills.from.includes(s));
      c.choices.featSlots = c.choices.featSlots.filter((s) => s.slot.startsWith(`${id}:`));
      c.choices.abilityIncreases = c.choices.abilityIncreases.filter(
        (i) => !i.slot || i.slot.startsWith(`${id}:`),
      );
      c.choices.options = [];
      c.choices.spells = [];
      c.choices.expertise = [];
      return c;
    });
  }

  protected setLevel(raw: string): void {
    const level = Math.min(Math.max(parseInt(raw, 10) || 1, 1), 20);
    this.patch((c) => {
      const k = c.classes[0];
      if (!k) return c;
      k.level = level;
      k.hp = Array.from({ length: level }, (_, i) => k.hp[i] ?? null);
      if (this.cls() && level < this.cls()!.subclassLevel) k.subclassId = null;
      const valid = new Set(featSlots(this.cls()!, level).map((s) => s.slot));
      c.choices.featSlots = c.choices.featSlots.filter((s) => valid.has(s.slot));
      c.choices.abilityIncreases = c.choices.abilityIncreases.filter(
        (i) => !i.slot || valid.has(i.slot),
      );
      return c;
    });
  }

  protected setSubclass(id: string): void {
    this.patch((c) => {
      if (c.classes[0]) c.classes[0].subclassId = id || null;
      return c;
    });
  }

  protected setHp(levelIndex: number, raw: string): void {
    const n = parseInt(raw, 10);
    this.patch((c) => {
      if (c.classes[0]) c.classes[0].hp[levelIndex] = Number.isNaN(n) ? null : n;
      return c;
    });
  }

  protected levels(): number[] {
    return Array.from({ length: this.level() }, (_, i) => i);
  }

  // -- background ----------------------------------------------------------------------
  protected setBackground(id: string): void {
    this.patch((c) => {
      c.background = id ? { id, abilityIncreases: {} } : null;
      return c;
    });
  }

  /** "2-1" (+2 to one, +1 to another) or "1-1-1" (+1 to all three). */
  protected backgroundMode(): '2-1' | '1-1-1' {
    const v = Object.values(this.draft().background?.abilityIncreases ?? {});
    return v.length === 3 && v.every((x) => x === 1) ? '1-1-1' : '2-1';
  }

  protected setBackgroundMode(mode: string): void {
    const bg = this.background();
    if (!bg) return;
    this.patch((c) => {
      c.background!.abilityIncreases =
        mode === '1-1-1' ? Object.fromEntries(bg.abilityScores.map((a) => [a, 1])) : {};
      return c;
    });
  }

  protected backgroundPick(amount: 1 | 2): Ability | '' {
    const inc = this.draft().background?.abilityIncreases ?? {};
    return (Object.entries(inc).find(([, v]) => v === amount)?.[0] as Ability) ?? '';
  }

  protected setBackgroundPick(amount: 1 | 2, ability: string): void {
    this.patch((c) => {
      const inc = { ...(c.background?.abilityIncreases ?? {}) };
      for (const [a, v] of Object.entries(inc))
        if (v === amount || a === ability) delete inc[a as Ability];
      if (ability) inc[ability as Ability] = amount;
      c.background!.abilityIncreases = inc;
      return c;
    });
  }

  // -- species -------------------------------------------------------------------------
  protected setSpecies(id: string): void {
    this.patch((c) => {
      c.species = id ? { id, variant: null } : null;
      return c;
    });
  }

  protected setVariant(name: string): void {
    this.patch((c) => {
      if (c.species) c.species.variant = name || null;
      return c;
    });
  }

  // -- ability scores --------------------------------------------------------------------
  protected setMethod(method: string): void {
    const base =
      method === 'standard'
        ? { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 }
        : { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 };
    if (method === 'manual')
      Object.assign(base, { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 });
    this.patch((c) => {
      c.abilityScores = { method: method as 'standard' | 'point-buy' | 'manual', base };
      return c;
    });
  }

  protected setScore(a: Ability, raw: string): void {
    const n = parseInt(raw, 10) || 0;
    this.patch((c) => {
      if (!c.abilityScores) return c;
      if (c.abilityScores.method === 'standard') {
        // each value of the array once: give the ability that had it the old value
        const other = ABILITIES.find((x) => x !== a && c.abilityScores!.base[x] === n);
        if (other) c.abilityScores.base[other] = c.abilityScores.base[a];
      }
      c.abilityScores.base[a] = n;
      return c;
    });
  }

  protected pointsSpent(): number {
    const s = this.draft().abilityScores;
    return s ? pointBuyCost(s.base) : 0;
  }

  // -- class choices -------------------------------------------------------------------
  protected setSkill(id: string, on: boolean): void {
    this.patch((c) => {
      c.choices.skills = this.toggle(c.choices.skills, id, on);
      if (!on) c.choices.expertise = c.choices.expertise.filter((x) => x !== id);
      return c;
    });
  }

  protected setExpertise(id: string, on: boolean): void {
    this.patch((c) => {
      c.choices.expertise = this.toggle(c.choices.expertise, id, on);
      return c;
    });
  }

  /** Skills the character is proficient in (background + chosen), for Expertise. */
  protected proficientSkills(): string[] {
    return [...new Set([...(this.background()?.skills ?? []), ...this.draft().choices.skills])];
  }

  protected slotFeat(slot: string): string {
    return this.draft().choices.featSlots.find((s) => s.slot === slot)?.featId ?? '';
  }

  protected slotFeatEntry(slot: string): Feat | undefined {
    const id = this.slotFeat(slot);
    return id ? this.data.value()?.rules.feats.get(id) : undefined;
  }

  protected featsFor(kind: 'asi' | 'fighting-style' | 'epic-boon', level: number): Feat[] {
    return featsForSlot(kind, this.data.value()?.feats ?? [], level);
  }

  protected setSlotFeat(slot: string, featId: string): void {
    this.patch((c) => {
      c.choices.featSlots = [
        ...c.choices.featSlots.filter((s) => s.slot !== slot),
        { slot, featId: featId || null },
      ];
      c.choices.abilityIncreases = c.choices.abilityIncreases.filter((i) => i.slot !== slot);
      return c;
    });
  }

  /** Ability chosen for the n-th +1 of a slot (ASI gives two; same ability twice = +2). */
  protected slotAbility(slot: string, n: number): string {
    const incs = this.draft().choices.abilityIncreases.filter((i) => i.slot === slot);
    const flat = incs.flatMap((i) => Array(i.amount).fill(i.ability));
    return flat[n] ?? '';
  }

  protected setSlotAbility(slot: string, n: number, ability: string, picks: number): void {
    const featId = this.slotFeat(slot);
    this.patch((c) => {
      const current = Array.from({ length: picks }, (_, i) => this.slotAbility(slot, i));
      current[n] = ability;
      const counts = new Map<string, number>();
      for (const a of current.filter(Boolean)) counts.set(a, (counts.get(a) ?? 0) + 1);
      c.choices.abilityIncreases = [
        ...c.choices.abilityIncreases.filter((i) => i.slot !== slot),
        ...[...counts].map(([a, amount]) => ({
          source: featId,
          ability: a as Ability,
          amount,
          slot,
        })),
      ];
      return c;
    });
  }

  /** How many +1 picks a feat in a slot gives, and from which abilities. */
  protected slotPicks(feat: Feat | undefined): { picks: number; from: Ability[] } {
    // ASI: +2 to one ability or +1 to two (the same ability twice = +2)
    if (feat?.id === 'ability-score-improvement') return { picks: 2, from: ABILITIES };
    if (!feat?.abilityIncrease) return { picks: 0, from: [] };
    return { picks: feat.abilityIncrease.amount, from: feat.abilityIncrease.from };
  }

  /** "eldritch-invocation" → "Eldritch Invocation" (option groups are game terms, left in English). */
  protected groupName(group: string): string {
    return group.replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  protected range(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  protected setOption(id: string, on: boolean): void {
    this.patch((c) => {
      c.choices.options = this.toggle(c.choices.options, id, on);
      return c;
    });
  }

  protected setSpell(id: string, on: boolean): void {
    this.patch((c) => {
      c.choices.spells = this.toggle(c.choices.spells, id, on);
      return c;
    });
  }

  protected chosenCount(ids: string[], of: { id: string }[]): number {
    const set = new Set(of.map((x) => x.id));
    return ids.filter((id) => set.has(id)).length;
  }

  // -- equipment -------------------------------------------------------------------------
  /** First time on this step, start from the class and background starting equipment. */
  protected prefillEquipment(): void {
    if (this.draft().equipment) return;
    const parts = [this.cls()?.startingEquipment, this.background()?.equipment].filter(Boolean);
    if (parts.length) this.patch((c) => ({ ...c, equipment: parts.join('\n\n') }));
  }

  // -- save ------------------------------------------------------------------------------
  protected async save(): Promise<void> {
    const d = this.data.value();
    const name = this.draft().name.trim() || '?';
    // a new character's file is named after it (characters/elara-1730000000.json)
    const id = this.id() ?? newCharacter(name, '').id;
    const ch = { ...this.draft(), id, name, dataVersion: d?.meta.generatedAt ?? null };
    await this.sync.save(ch);
    if (!this.id()) clearDraft();
    await this.router.navigate(['/characters', ch.id]);
  }

  protected restart(): void {
    clearDraft();
    this.draft.set(newCharacter('', this.settings.settings().deviceName));
    this.step.set('class');
  }

  protected signed(n: number): string {
    return n >= 0 ? `+${n}` : `${n}`;
  }
}

function loadDraft(): Character | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? normalizeCharacter(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function saveDraft(c: Character): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(c));
  } catch {
    // storage unavailable: the draft lasts until the page is closed
  }
}

function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // nothing to clear
  }
}
