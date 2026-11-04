import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
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
  OrderEntry,
  canMove,
  emptyCombat,
  hasCombat,
  initiativeOrder,
  isDefeated,
  moveInOrder,
  randomDie,
  rollMonsterInitiative,
  setInitiative,
} from '../../../core/dm/combat';
import { CombatEncounter, ENCOUNTER_SOURCE } from '../../../core/dm/combat-encounter';
import { addEncounter } from '../../../core/dm/combat-sources';
import { CombatStore } from '../../../core/dm/combat-store.service';
import { DataTextService } from '../../../core/i18n/data-text.service';
import { I18nService, TranslatePipe } from '../../../core/i18n/i18n.service';
import { MonsterStatBlock } from '../../compendium/monster-stat-block';
import { CombatSetup } from './combat-setup';
import { MonsterCard } from './monster-card';

/** The order column beside the monster card from this width; below, the card goes under it. */
const WIDE = '(min-width: 56rem)';

interface Row extends OrderEntry {
  label: string;
  /** Monsters: "CA 15 · PG 7/10". */
  meta: string;
  down: boolean;
  up: boolean;
  downMove: boolean;
}

/**
 * The DM's combat helper (/dm/combat, ?encounter=<id> loads an encounter and rolls the monsters'
 * initiative): one column with everyone in initiative order (players type what they rolled with
 * their own dice) and the summary card of the monster tapped in it. No turns or rounds. Everything
 * is saved on the device as it changes (CombatStore).
 */
@Component({
  selector: 'app-combat-page',
  imports: [TranslatePipe, NgTemplateOutlet, CombatSetup, MonsterCard, MonsterStatBlock],
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
  private readonly injector = inject(Injector);

  protected readonly state = this.store.state;
  protected readonly wide = signal(false);
  protected readonly setupOpen = signal(!hasCombat(this.state()));
  protected readonly confirmNew = signal(false);
  /** An encounter from ?encounter= waiting for "replace, add or ignore" (a combat is going on). */
  protected readonly pending = signal<CombatEncounter | null>(null);
  protected readonly encounterMissing = signal(false);
  protected readonly encounterLocked = signal(false);

  protected readonly monsters = resource({ loader: () => this.compendium.all('monster') });
  protected readonly byId = computed(
    () => new Map((this.monsters.value() ?? []).map((m) => [m.id, m])),
  );

  protected readonly playerLabel = computed(() => this.i18n.t('combat.player'));

  private readonly labels = computed(() => {
    this.data.shownLanguage();
    const s = this.state();
    const count = new Map<string, number>();
    for (const m of s.monsters) count.set(m.monsterId, (count.get(m.monsterId) ?? 0) + 1);
    const out = new Map<string, string>();
    s.players.forEach((p, i) => out.set(p.id, p.name || `${this.playerLabel()} ${i + 1}`));
    for (const m of s.monsters) {
      const name = this.data.shortName(m.name);
      out.set(
        m.id,
        (count.get(m.monsterId) ?? 0) > 1 || m.number > 1 ? `${name} ${m.number}` : name,
      );
    }
    return out;
  });

  private readonly order = computed(() => initiativeOrder(this.state()));

  private readonly rows = computed<Row[]>(() => {
    const s = this.state();
    const order = this.order();
    const ac = this.i18n.t('monster.ac');
    const hp = this.i18n.t('monster.hp');
    const monsters = new Map(s.monsters.map((m) => [m.id, m]));
    return order.map((e) => {
      const m = monsters.get(e.id);
      return {
        ...e,
        label: this.labels().get(e.id) ?? '',
        meta: m ? `${ac} ${m.ac} · ${hp} ${m.hp}/${m.hpMax}${m.temp ? ` +${m.temp}` : ''}` : '',
        down: !!m && isDefeated(m),
        up: canMove(order, e.id, -1),
        downMove: canMove(order, e.id, 1),
      };
    });
  });
  protected readonly rolledRows = computed(() => this.rows().filter((r) => r.initiative !== null));
  protected readonly unrolledRows = computed(() =>
    this.rows().filter((r) => r.initiative === null),
  );
  protected readonly anyRolled = computed(() =>
    this.state().monsters.some((m) => m.initiative !== null),
  );

  /** The monster whose card is shown: the one tapped, or the first in the order. */
  protected readonly selected = computed(() => {
    const s = this.state();
    const chosen = s.monsters.find((m) => m.id === s.selectedId);
    if (chosen) return chosen;
    const first = this.order().find((e) => e.kind === 'monster');
    return s.monsters.find((m) => m.id === first?.id) ?? null;
  });
  protected readonly selectedLabel = computed(() => this.labels().get(this.selected()?.id ?? ''));

  /** The monster whose stat block is shown in the dialog. */
  protected readonly statBlockId = signal<string | null>(null);
  protected readonly statBlock = computed(() => this.byId().get(this.statBlockId() ?? ''));
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
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
    if (id) {
      // straight to the order and the cards: no setup step
      this.setupOpen.set(false);
      void this.openEncounter(id);
    }
  }

  // -- encounter -----------------------------------------------------------------------------

  private async openEncounter(id: string): Promise<void> {
    const encounter = await this.encounters.get(id);
    if (!encounter) {
      this.encounterLocked.set(!!this.encounters.isLocked?.(id));
      this.encounterMissing.set(true);
      this.forgetQuery();
      return;
    }
    if (!hasCombat(this.state())) await this.loadEncounter(encounter, 'replace');
    else if (this.state().encounterId !== encounter.id) this.pending.set(encounter);
    else this.forgetQuery();
  }

  /** Loads it and rolls the monsters' initiative straight away: the players only type theirs. */
  protected async loadEncounter(
    encounter: CombatEncounter,
    mode: 'replace' | 'add' | 'ignore',
  ): Promise<void> {
    this.pending.set(null);
    this.forgetQuery();
    if (mode === 'ignore') return;
    const [monsters, names] = await Promise.all([
      this.compendium.all('monster'),
      this.characterNames(encounter),
    ]);
    const byId = new Map(monsters.map((m) => [m.id, m]));
    const d20 = randomDie(20);
    this.store.update((s) => {
      const base: CombatState =
        mode === 'replace' ? { ...emptyCombat(0), perMonster: s.perMonster } : s;
      const next = addEncounter(base, encounter, byId, names);
      return { ...rollMonsterInitiative(next, d20, { missing: mode === 'add' }), selectedId: null };
    });
    this.setupOpen.set(false);
  }

  private async characterNames(e: CombatEncounter): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    for (const p of e.party) {
      if (!p.characterId) continue;
      try {
        const record = await this.characters.get(p.characterId);
        if (record?.character.name) out.set(p.characterId, record.character.name);
      } catch {
        // not on this device: the name typed in the encounter, or "Player N"
      }
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

  // -- order ---------------------------------------------------------------------------------

  protected roll(): void {
    this.store.update((s) => rollMonsterInitiative(s, randomDie(20)));
  }

  protected setInit(id: string, e: Event): void {
    const v = (e.target as HTMLInputElement).value.trim();
    this.store.update((s) => setInitiative(s, id, v === '' ? null : +v));
  }

  protected move(id: string, step: -1 | 1): void {
    this.store.update((s) => moveInOrder(s, id, step));
  }

  protected select(id: string): void {
    this.store.update((s) => (s.selectedId === id ? s : { ...s, selectedId: id }));
    afterNextRender(() => this.scrollTo('.card-col', !this.wide()), { injector: this.injector });
  }

  protected toOrder(): void {
    this.scrollTo('.order-col', true);
  }

  private scrollTo(selector: string, always: boolean): void {
    const el = this.host.nativeElement.querySelector<HTMLElement>(selector);
    if (!el || typeof el.scrollIntoView !== 'function') return;
    const top = el.getBoundingClientRect().top;
    if (always || top < 0) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  protected startNew(): void {
    this.store.clear();
    this.confirmNew.set(false);
    this.setupOpen.set(true);
  }

  // -- stat block ----------------------------------------------------------------------------

  protected showStatBlock(id: string): void {
    this.statBlockId.set(id);
    this.dialog()?.nativeElement.showModal();
  }

  protected closeStatBlock(): void {
    this.dialog()?.nativeElement.close();
  }

  protected readonly statBlockName = computed(() => this.data.shortName(this.statBlock()?.name));
}
