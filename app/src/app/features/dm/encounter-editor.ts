import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CharacterStore } from '../../core/characters/character-store.service';
import { CompendiumService } from '../../core/compendium/compendium.service';
import {
  Encounter,
  EncounterMonster,
  MAX_LEVEL,
  PartyMember,
  clampLevel,
} from '../../core/dm/encounter';
import { characterBudget, gaugeScale } from '../../core/dm/encounter-difficulty';
import { EncounterStore } from '../../core/dm/encounter-store.service';
import { DataNamePipe } from '../../core/i18n/data-text.service';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { Character } from '../../core/models/character';
import { Monster } from '../../core/models/compendium';
import { ENTRY_FACETS, crText } from '../../shared/picker/entry-facets';
import { EntryLabels } from '../../shared/picker/entry-labels.service';
import { Picker } from '../../shared/picker/picker';
import { LoadError } from '../compendium/load-error';
import { MonsterStatBlock } from '../compendium/monster-stat-block';
import { RATING_KEY, encounterStats } from './encounter-stats';

/** Total level of a saved character (1 when it has no class yet). */
export function characterLevel(c: Character): number {
  return clampLevel(c.classes.reduce((n, k) => n + k.level, 0));
}

/**
 * Editing one encounter: the party (by hand or from the saved characters), the monsters with how
 * many of each, notes, and its difficulty with the 2024 rules. Every change is saved at once.
 */
@Component({
  selector: 'app-encounter-editor',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    TranslatePipe,
    DataNamePipe,
    Picker,
    MonsterStatBlock,
    LoadError,
  ],
  templateUrl: './encounter-editor.html',
  styleUrl: './encounter-editor.scss',
})
export class EncounterEditor {
  /** Route parameter. */
  readonly id = input.required<string>();

  private readonly store = inject(EncounterStore);
  private readonly characterStore = inject(CharacterStore);
  private readonly compendium = inject(CompendiumService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly labels = inject(EntryLabels);

  protected readonly levels = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);
  protected readonly ratingKey = RATING_KEY;
  protected readonly monsterFacets = ENTRY_FACETS.monster;

  /** The stored encounter, with the levels of linked characters brought up to date. */
  private readonly stored = resource({
    params: () => this.id(),
    loader: async ({ params: id }) => {
      const [e] = await Promise.all([this.store.get(id), this.characterStore.load()]);
      if (!e) return null;
      const byId = new Map(this.characterStore.all().map((r) => [r.character.id, r.character]));
      e.party = e.party.map((p) => {
        const c = p.characterId ? byId.get(p.characterId) : undefined;
        return c ? { ...p, name: c.name, level: characterLevel(c) } : p;
      });
      return e;
    },
  });
  protected readonly loading = computed(() => this.stored.isLoading());
  protected readonly missing = computed(() => !this.stored.isLoading() && !this.stored.value());

  /** The encounter being edited. */
  protected readonly enc = linkedSignal<Encounter | null>(() => this.stored.value() ?? null);

  protected readonly monsters = resource({ loader: () => this.compendium.all('monster') });
  protected readonly monsterById = computed(
    () => new Map((this.monsters.value() ?? []).map((m) => [m.id, m])),
  );
  private readonly xpById = computed(
    () => new Map((this.monsters.value() ?? []).map((m) => [m.id, m.xp])),
  );

  protected readonly stats = computed(() => {
    const e = this.enc();
    return e ? encounterStats(e, this.xpById()) : null;
  });
  protected readonly gauge = computed(() => {
    const s = this.stats();
    return s ? gaugeScale(s.xp, s.budget) : null;
  });

  /** Saved characters to take the party from. */
  protected readonly characters = computed(() =>
    this.characterStore.all().map((r) => ({
      id: r.character.id,
      name: r.character.name,
      level: characterLevel(r.character),
    })),
  );
  protected readonly linked = computed(
    () => new Set((this.enc()?.party ?? []).flatMap((p) => p.characterId ?? [])),
  );
  protected readonly chosenMonsters = computed(() =>
    (this.enc()?.monsters ?? []).map((m) => m.monsterId),
  );

  /** "N characters of level L" quick fill. */
  protected readonly quickCount = signal(4);
  protected readonly quickLevel = signal(1);
  /** The monster picker is open. */
  protected readonly adding = signal(false);

  private saving: Promise<unknown> = Promise.resolve();

  // -- numbers ------------------------------------------------------------------------------

  protected num(n: number): string {
    return n.toLocaleString(this.i18n.language());
  }

  protected pct(fraction: number): string {
    return `${(fraction * 100).toFixed(2)}%`;
  }

  protected crLabel(m: Monster): string {
    return this.i18n.t('monster.crValue', { cr: crText(m.cr) });
  }

  protected kicker(m: Monster): string {
    return this.labels.monsterKicker(m);
  }

  protected memberBudget(level: number): string {
    const b = characterBudget(level);
    return [b.low, b.moderate, b.high].map((n) => this.num(n)).join(' / ');
  }

  // -- changes --------------------------------------------------------------------------------

  private update(change: (e: Encounter) => Encounter): void {
    const current = this.enc();
    if (!current) return;
    const next = change(current);
    this.enc.set(next);
    // saves in order, each one with the latest state
    this.saving = this.saving.then(() => this.store.save(next)).catch(() => undefined);
  }

  protected rename(name: string): void {
    this.update((e) => ({ ...e, name }));
  }

  protected setNotes(notes: string): void {
    this.update((e) => ({ ...e, notes }));
  }

  // party

  protected fillParty(): void {
    const count = Math.min(12, Math.max(1, Math.floor(this.quickCount()) || 1));
    const level = clampLevel(this.quickLevel());
    this.update((e) => ({ ...e, party: Array.from({ length: count }, () => ({ level })) }));
  }

  protected addMember(): void {
    this.update((e) => ({
      ...e,
      party: [...e.party, { level: e.party.at(-1)?.level ?? this.quickLevel() }],
    }));
  }

  protected removeMember(index: number): void {
    this.update((e) => ({ ...e, party: e.party.filter((_, i) => i !== index) }));
  }

  protected setLevel(index: number, level: string): void {
    this.update((e) => ({
      ...e,
      party: e.party.map((p, i) => (i === index ? { ...p, level: clampLevel(Number(level)) } : p)),
    }));
  }

  protected toggleCharacter(c: { id: string; name: string; level: number }, on: boolean): void {
    this.update((e) => {
      const rest = e.party.filter((p) => p.characterId !== c.id);
      const member: PartyMember = { level: c.level, characterId: c.id, name: c.name };
      return { ...e, party: on ? [...rest, member] : rest };
    });
  }

  protected memberLabel(p: PartyMember, index: number): string {
    return p.name || this.i18n.t('encounter.characterN', { n: index + 1 });
  }

  // monsters

  protected step(m: EncounterMonster, delta: number): void {
    this.update((e) => ({
      ...e,
      monsters: e.monsters
        .map((x) => (x.monsterId === m.monsterId ? { ...x, count: x.count + delta } : x))
        .filter((x) => x.count > 0),
    }));
  }

  protected removeMonster(id: string): void {
    this.update((e) => ({ ...e, monsters: e.monsters.filter((x) => x.monsterId !== id) }));
  }

  protected pick(event: { id: string; on: boolean }): void {
    if (!event.on) return this.removeMonster(event.id);
    this.update((e) =>
      e.monsters.some((x) => x.monsterId === event.id)
        ? e
        : { ...e, monsters: [...e.monsters, { monsterId: event.id, count: 1 }] },
    );
  }

  // whole encounter

  protected async startCombat(): Promise<void> {
    const e = this.enc();
    if (!e) return;
    await this.saving;
    await this.router.navigate(['/dm/combat'], { queryParams: { encounter: e.id } });
  }

  protected async duplicate(): Promise<void> {
    const e = this.enc();
    if (!e) return;
    await this.saving;
    const copy = await this.store.duplicate(
      e.id,
      this.i18n.t('encounters.copyName', { name: e.name }),
    );
    if (copy) await this.router.navigate(['/dm/encounters', copy.id]);
  }

  protected async remove(): Promise<void> {
    const e = this.enc();
    if (!e || !confirm(this.i18n.t('encounters.confirmDelete', { name: e.name }))) return;
    await this.saving;
    await this.store.remove(e.id);
    await this.router.navigate(['/dm/encounters']);
  }
}
