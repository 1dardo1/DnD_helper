import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { CharacterStore } from '../../../core/characters/character-store.service';
import { CompendiumService } from '../../../core/compendium/compendium.service';
import {
  CombatState,
  CombatantInput,
  defeatedXp,
  downState,
  emptyCombat,
  nextTurn,
  previousTurn,
  randomDie,
  rollMonsterInitiative,
  setInitiative,
  sortByInitiative,
  startCombat,
} from '../../../core/dm/combat';
import { CombatEncounter, ENCOUNTER_SOURCE } from '../../../core/dm/combat-encounter';
import { addEncounter, characterCombatant } from '../../../core/dm/combat-sources';
import { CombatStore } from '../../../core/dm/combat-store.service';
import { DataTextService } from '../../../core/i18n/data-text.service';
import { I18nService, TranslatePipe } from '../../../core/i18n/i18n.service';
import { RulesDataService } from '../../../core/rules/rules-data.service';
import { MonsterStatBlock } from '../../compendium/monster-stat-block';
import { AddCombatants } from './add-combatants';
import { CombatantPanel } from './combatant-panel';

/** Two columns (order | selected combatant) from this width; below, the panel opens in the list. */
const WIDE = '(min-width: 56rem)';

/**
 * The DM's initiative tracker (/dm/combat, ?encounter=<id> loads an encounter): combatants in
 * initiative order, whose turn it is and the round, hit points, conditions with a duration,
 * concentration and notes. Everything is saved on the device as it changes (CombatStore).
 */
@Component({
  selector: 'app-combat-page',
  imports: [TranslatePipe, AddCombatants, CombatantPanel, MonsterStatBlock],
  templateUrl: './combat-page.html',
  styleUrl: './combat-page.scss',
})
export class CombatPage implements OnInit {
  protected readonly store = inject(CombatStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly encounters = inject(ENCOUNTER_SOURCE);
  private readonly compendium = inject(CompendiumService);
  private readonly characters = inject(CharacterStore);
  private readonly i18n = inject(I18nService);
  private readonly data = inject(DataTextService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly rules = inject(RulesDataService);
  private readonly injector = inject(Injector);

  protected readonly state = this.store.state;
  protected readonly combatants = computed(() => this.state().combatants);
  protected readonly started = computed(() => this.state().round > 0);
  protected readonly currentId = computed(() =>
    this.started() ? (this.combatants()[this.state().turn]?.id ?? null) : null,
  );
  /** The combatant whose panel is open: follows the turn, or the one tapped. */
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selected = computed(
    () => this.combatants().find((c) => c.id === this.selectedId()) ?? null,
  );
  protected readonly wide = signal(false);
  protected readonly addOpen = signal(false);
  protected readonly confirmEnd = signal(false);
  /** An encounter from ?encounter= waiting for "replace or add" (there's a combat already). */
  protected readonly pending = signal<CombatEncounter | null>(null);
  protected readonly encounterMissing = signal(false);

  protected readonly labels = computed(() => {
    this.data.shownLanguage();
    const list = this.combatants();
    const many = new Map<string, number>();
    for (const c of list) if (c.monsterId) many.set(c.monsterId, (many.get(c.monsterId) ?? 0) + 1);
    return new Map(
      list.map((c) => {
        if (!c.monsterId) return [c.id, c.name];
        const name = this.data.shortName(c.name);
        const numbered = (many.get(c.monsterId) ?? 0) > 1 || (c.number ?? 1) > 1;
        return [c.id, numbered ? `${name} ${c.number}` : name];
      }),
    );
  });

  protected readonly xp = computed(() => defeatedXp(this.state()));
  protected readonly players = computed(
    () => this.combatants().filter((c) => c.kind !== 'monster').length,
  );
  /** Split among the party (the non-monster combatants). */
  protected readonly xpEach = computed(() =>
    this.players() ? Math.floor(this.xp() / this.players()) : 0,
  );
  protected readonly monsterCount = computed(
    () => this.combatants().filter((c) => c.kind === 'monster').length,
  );
  protected readonly monstersUnrolled = computed(
    () => this.combatants().filter((c) => c.kind === 'monster' && c.initiative === null).length,
  );
  protected readonly unrolled = computed(
    () => this.combatants().filter((c) => c.initiative === null).length,
  );

  /** The monster whose stat block is shown in the dialog. */
  protected readonly statBlockId = signal<string | null>(null);
  protected readonly statBlock = resource({
    params: () => this.statBlockId() ?? undefined,
    loader: ({ params }) => this.compendium.get('monster', params),
  });
  protected readonly statBlockName = computed(() =>
    this.data.shortName(this.statBlock.value()?.name),
  );
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly downState = downState;

  constructor() {
    // the panel follows the turn
    effect(() => {
      const id = this.currentId();
      if (id) {
        this.selectedId.set(id);
        // after the view and the router's own scrolling (on a reload too)
        afterNextRender(() => setTimeout(() => this.scrollToCurrent(), 50), {
          injector: this.injector,
        });
      }
    });
    // a new combatant in the side column starts at its top
    effect(() => {
      this.selectedId();
      afterNextRender(
        () => this.host.nativeElement.querySelector('.side')?.scrollTo?.({ top: 0 }),
        {
          injector: this.injector,
        },
      );
    });
    effect(() => {
      if (!this.combatants().length) this.addOpen.set(true);
    });
    const media = typeof matchMedia === 'function' ? matchMedia(WIDE) : null;
    if (media) {
      this.wide.set(media.matches);
      const listener = (e: MediaQueryListEvent) => this.wide.set(e.matches);
      media.addEventListener('change', listener);
      inject(DestroyRef).onDestroy(() => media.removeEventListener('change', listener));
    }
  }

  ngOnInit(): void {
    const id = this.route.snapshot.queryParamMap.get('encounter');
    if (id) void this.openEncounter(id);
  }

  // -- encounter -----------------------------------------------------------------------------

  private async openEncounter(id: string): Promise<void> {
    const encounter = await this.encounters.get(id);
    if (!encounter) {
      this.encounterMissing.set(true);
      this.forgetQuery();
      return;
    }
    if (!this.combatants().length) await this.loadEncounter(encounter, 'replace');
    else if (this.state().encounterId !== encounter.id) this.pending.set(encounter);
    else this.forgetQuery();
  }

  protected async loadEncounter(
    encounter: CombatEncounter,
    mode: 'replace' | 'add' | 'ignore',
  ): Promise<void> {
    this.pending.set(null);
    this.forgetQuery();
    if (mode === 'ignore') return;
    const [monsters, characters] = await Promise.all([
      this.compendium.all('monster'),
      this.characterInputs(encounter),
    ]);
    const byId = new Map(monsters.map((m) => [m.id, m]));
    const label = this.i18n.t('combat.player');
    this.store.update((s) =>
      addEncounter(mode === 'replace' ? emptyCombat() : s, encounter, byId, characters, label),
    );
  }

  private async characterInputs(e: CombatEncounter): Promise<Map<string, CombatantInput>> {
    const ids = e.party.map((p) => p.characterId).filter((x): x is string => !!x);
    const out = new Map<string, CombatantInput>();
    if (!ids.length) return out;
    const data = await this.rules.load();
    for (const id of ids) {
      const record = await this.characters.get(id);
      const c = record && characterCombatant(record.character, data);
      if (c) out.set(id, c);
    }
    return out;
  }

  private forgetQuery(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { encounter: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  // -- order and turns -----------------------------------------------------------------------

  protected select(id: string): void {
    this.selectedId.update((s) => (s === id && !this.wide() ? null : id));
  }

  protected setInit(id: string, e: Event): void {
    const v = (e.target as HTMLInputElement).value.trim();
    this.store.update((s) => setInitiative(s, id, v === '' ? null : +v));
  }

  protected rollMonsters(all: boolean): void {
    const perGroup = this.state().groupRolls;
    this.store.update((s) => rollMonsterInitiative(s, randomDie(20), { perGroup, all }));
  }

  protected setGroupRolls(on: boolean): void {
    this.store.update((s) => ({ ...s, groupRolls: on }));
  }

  protected sort(): void {
    this.store.update(sortByInitiative);
  }

  protected start(): void {
    this.store.update(startCombat);
  }

  protected next(): void {
    this.store.update(nextTurn);
  }

  protected previous(): void {
    this.store.update(previousTurn);
  }

  protected end(): void {
    this.store.clear();
    this.confirmEnd.set(false);
    this.selectedId.set(null);
  }

  // -- stat block ----------------------------------------------------------------------------

  protected showStatBlock(id: string): void {
    this.statBlockId.set(id);
    this.dialog()?.nativeElement.showModal();
  }

  protected closeStatBlock(): void {
    this.dialog()?.nativeElement.close();
  }

  private scrollToCurrent(): void {
    const row = this.host.nativeElement.querySelector<HTMLElement>('li.current');
    if (row && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest' });
    }
  }

  protected hpText(c: CombatState['combatants'][number]): string {
    if (c.hp === null) return '—';
    return c.temp ? `${c.hp}+${c.temp}` : `${c.hp}`;
  }
}
