import {
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  resource,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  addItem,
  canEquip,
  removeEntry,
  setGear,
  setQty,
  toggleEquip,
} from '../../core/characters/inventory';
import { Host, enhancementHosts, hostOf } from '../../core/characters/enhancement';
import {
  BonusOption,
  armorStats,
  baseCandidates,
  bonusOptions,
  enhancementOf,
  gearChoices,
  gearKind,
  gearOf,
} from '../../core/characters/magic-base';
import { CompendiumService } from '../../core/compendium/compendium.service';
import { DataNamePipe, DataTextService } from '../../core/i18n/data-text.service';
import { TermPipe } from '../../core/i18n/glossary';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { Character, Coins, InventoryEntry } from '../../core/models/character';
import { Item, Spell } from '../../core/models/compendium';
import { attacksFor, proficientWith } from '../../core/rules/attacks';
import { Sheet } from '../../core/rules/sheet';
import {
  addSpellItem,
  consumeSpellItem,
  isScroll,
  levelStats,
  spellBinding,
} from '../../core/spell-items/spell-items';
import { baseSummary } from '../../core/characters/base-label';
import { matchesQuery } from '../../core/characters/sheet-helpers';
import { weaponEntriesOf } from '../../core/characters/weapons';
import { displayOrder, groupEntries, moveGroup } from '../../core/characters/inventory-order';
import { SpellItemPicker } from '../../shared/spell-item-picker';
import { defaultOrder } from '../../shared/picker/entry-order';
import { normalise, rankName } from '../compendium/compendium-search';

/** Attacks with the carried weapons, and the inventory (add, equip, remove). */
@Component({
  selector: 'app-equipment-panel',
  imports: [RouterLink, TranslatePipe, TermPipe, DataNamePipe, SpellItemPicker],
  templateUrl: './equipment-panel.html',
  styleUrl: './equipment-panel.scss',
})
export class EquipmentPanel {
  readonly character = input.required<Character>();
  readonly sheet = input.required<Sheet>();
  /** Which half to show: the attacks table or the inventory. */
  readonly part = input<'attacks' | 'inventory'>('attacks');
  readonly changed = output<Character>();

  private readonly compendium = inject(CompendiumService);
  private readonly dataText = inject(DataTextService);
  private readonly i18n = inject(I18nService);

  private readonly items = resource({
    loader: async () => {
      const [all, spells] = await Promise.all([
        this.compendium.all('item'),
        this.compendium.all('spell'),
      ]);
      return {
        all,
        byId: new Map(all.map((i) => [i.id, i])),
        spells: new Map(spells.map((s) => [s.id, s])),
      };
    },
  });

  protected readonly query = signal('');
  /** Shows the ↑ ↓ buttons to rearrange the inventory. */
  protected readonly reordering = signal(false);

  protected readonly entries = computed(() => {
    const v = this.items.value();
    const inv = this.character().inventory;
    const groups = groupEntries(inv);
    // what each group can do when rearranging: it only moves among its equipped / stowed peers
    const canUp = new Set<string>();
    const canDown = new Set<string>();
    groups.forEach((g, i) => {
      const same = (j: number) => !!groups[j]?.entry.equipped === !!g.entry.equipped;
      if (i > 0 && same(i - 1)) canUp.add(g.entry.id);
      if (i < groups.length - 1 && same(i + 1)) canDown.add(g.entry.id);
    });
    const attachedIds = new Set(groups.flatMap((g) => g.attached.map((a) => a.id)));
    return displayOrder(inv).map((e) => {
      const item = e.itemId ? v?.byId.get(e.itemId) : undefined;
      const gear = v ? gearOf(e, item, v.byId) : null;
      // a magic weapon, armor or shield: its base (to choose or to change) and bonus
      const magic =
        v && item && gearKind(item)
          ? { bases: baseCandidates(item, v.all), bonuses: bonusOptions(item) }
          : null;
      const spec = enhancementOf(item);
      const hosts = spec && v ? enhancementHosts(item, this.character().inventory, v.byId) : [];
      const state = spec && v ? hostOf(e, this.character().inventory, v.byId) : null;
      const hostBonus = state?.state === 'ok' ? state.host.gear.bonus : 0;
      return {
        entry: e,
        /** Linked to a weapon of the inventory: listed right below it, moves with it. */
        attached: attachedIds.has(e.id),
        canUp: canUp.has(e.id),
        canDown: canDown.has(e.id),
        item,
        gear,
        magic,
        // an upgrade of a weapon of the inventory: its host, the weapons it can go on
        upgrade: spec && state ? { spec, state, hosts, hostBonus } : null,
        armor: gear && gear.kind === 'armor' && magic ? armorStats(gear) : null,
        held: this.held(e),
      };
    });
  });

  protected readonly attacks = computed(() => {
    const v = this.items.value();
    const inv = displayOrder(this.character().inventory);
    return attacksFor(this.sheet(), v ? weaponEntriesOf(inv, v.byId) : []);
  });

  // -- Weapon Mastery (Barbarian, Fighter, Paladin, Ranger, Rogue) --------------------------
  // Change this choice freely: every one of the five classes lets the player re-pick on a Long
  // Rest, and Barbarian/Fighter also gain a new slot on level up, so nothing here needs to wait
  // for a specific moment the way Replicate Magic Item's Long Rest prompt does.
  protected readonly masterySlots = computed(() => this.sheet().combat.masterySlots);
  protected readonly masteryChosenItems = computed(() => {
    const byId = this.items.value()?.byId;
    const chosen = this.character().choices.weaponMasteries ?? [];
    return byId ? chosen.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : [])) : [];
  });
  /** Proficient weapons with a mastery property, to choose from. */
  protected readonly masteryOptions = computed(() => {
    const byId = this.items.value()?.byId;
    if (!byId) return [];
    const weapons = this.sheet().proficiencies.weapons;
    return [...byId.values()]
      .filter((i) => i.weapon?.mastery && proficientWith(weapons, i))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
  /** Weapon ids being edited (null = the editor is closed). */
  protected readonly masteryEditing = signal<string[] | null>(null);

  protected startMasteryEdit(): void {
    this.masteryEditing.set([...(this.character().choices.weaponMasteries ?? [])]);
  }

  protected cancelMasteryEdit(): void {
    this.masteryEditing.set(null);
  }

  protected toggleMastery(id: string, on: boolean): void {
    this.masteryEditing.update((l) => {
      if (!l) return l;
      return on ? [...l, id] : l.filter((x) => x !== id);
    });
  }

  protected saveMastery(): void {
    const draft = this.masteryEditing();
    if (!draft) return;
    this.masteryEditing.set(null);
    const ch = this.character();
    this.changed.emit({ ...ch, choices: { ...ch.choices, weaponMasteries: draft } });
  }

  protected checked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }

  /** A magic item whose base (and bonus) is being asked before it is added. */
  protected readonly pending = signal<{
    item: Item;
    bases: Item[];
    bonuses: BonusOption[];
    baseId: string;
    bonus: number;
    /** Upgrade of a weapon of the inventory: the weapons it can go on (maybe none). */
    hosts?: Host[];
    hostId?: string;
  } | null>(null);

  /**
   * Compendium items matching the search (English or translated name): the best matches first
   * ("Cuerda" before "Cuerda de escalada"), then mundane before magic, weapons and armor first.
   */
  protected readonly results = computed(() => {
    const q = norm(this.query());
    if (q.length < 2) return [];
    const found = (this.items.value()?.all ?? []).filter((i) =>
      norm(this.dataText.searchText(i.name)).includes(q),
    );
    const match = (i: Item) =>
      Math.min(
        ...[i.name, this.dataText.shortName(i.name)].map((n) => rankName(normalise(n), q) ?? 9),
      );
    const rank = new Map(found.map((i) => [i, match(i)]));
    return defaultOrder(found, (i) => this.dataText.shortName(i.name))
      .sort((a, b) => rank.get(a)! - rank.get(b)!)
      .slice(0, 8);
  });

  protected readonly canEquip = canEquip;
  protected readonly spellBinding = spellBinding;

  /** Item waiting for the player to choose its spell (Spell Scroll...). */
  protected readonly choosing = signal<Item | null>(null);
  protected readonly choosingBinding = computed(() => spellBinding(this.choosing()));

  /** The spell an item holds, with the DC and attack bonus its level gives. */
  private held(e: InventoryEntry) {
    const item = e.itemId ? this.items.value()?.byId.get(e.itemId) : undefined;
    const spell = e.spellId ? this.items.value()?.spells.get(e.spellId) : undefined;
    if (!spell) return null;
    const b = spellBinding(item);
    return { spell, stats: b ? levelStats(b, spell.level) : undefined, scroll: isScroll(item) };
  }

  protected pickSpell(spell: Spell): void {
    const item = this.choosing();
    if (!item) return;
    this.changed.emit(addSpellItem(this.character(), item, spell.id));
    this.choosing.set(null);
    this.query.set('');
  }

  protected useUp(e: InventoryEntry): void {
    this.changed.emit(consumeSpellItem(this.character(), e.id));
  }

  /** The option text of a base: only its name; the details go in a line under the selector. */
  protected baseName(b: Item): string {
    return this.dataText.shortName(b.name);
  }

  protected baseSummary(b: Item | undefined | null): string {
    return b ? baseSummary(b, this.i18n) : '';
  }

  protected pendingSummary(bases: Item[], baseId: string): string {
    return this.baseSummary(bases.find((b) => b.id === baseId));
  }

  /** The upgrade whose weapon is being changed (its selector is shown). */
  protected readonly changingHost = signal<string | null>(null);

  protected add(item: Item | null): void {
    const v = this.items.value();
    if (!v) return;
    if (item && spellBinding(item)) {
      this.choosing.set(item);
      return;
    }
    if (item && enhancementOf(item)) {
      const hosts = enhancementHosts(item, this.character().inventory, v.byId);
      this.pending.set({
        item,
        bases: [],
        bonuses: [],
        baseId: '',
        bonus: 0,
        hosts,
        hostId: hosts.length === 1 ? hosts[0].entry.id : '',
      });
      this.query.set('');
      return;
    }
    const choices = item ? gearChoices(item, v.all) : null;
    if (item && choices) {
      // several bases fit (or "+1, +2 or +3"): ask before adding
      this.pending.set({
        item,
        ...choices,
        baseId: choices.bases.length === 1 ? choices.bases[0].id : '',
        bonus: choices.bonuses[0]?.bonus ?? 0,
      });
    } else this.changed.emit(addItem(this.character(), item, item ? '' : this.query()));
    this.query.set('');
  }

  protected confirmPending(): void {
    const p = this.pending();
    if (!p || (p.bases.length > 1 && !p.baseId)) return;
    if (p.hosts && !p.hostId) return;
    this.changed.emit(
      addItem(this.character(), p.item, '', {
        ...(p.baseId ? { baseId: p.baseId } : {}),
        ...(p.hostId ? { onEntryId: p.hostId } : {}),
        ...(p.bonuses.length > 1 ? { bonus: p.bonus } : {}),
      }),
    );
    this.pending.set(null);
  }

  protected pendingPatch(patch: { baseId?: string; bonus?: number; hostId?: string }): void {
    const p = this.pending();
    if (p) this.pending.set({ ...p, ...patch });
  }

  protected setBase(e: InventoryEntry, baseId: string): void {
    if (baseId) this.changed.emit(setGear(this.character(), e.id, { baseId }));
  }

  protected setHost(e: InventoryEntry, onEntryId: string): void {
    if (onEntryId) this.changed.emit(setGear(this.character(), e.id, { onEntryId }));
    this.changingHost.set(null);
  }

  /** "Sniper's Bracelet (Longbow)" / "Longbow": a weapon of the inventory, to choose as a host. */
  protected hostLabel(h: Host): string {
    const name = this.dataText.name(h.gear.item.name);
    return h.gear.item === h.gear.base || !h.gear.base
      ? name
      : `${name} (${this.dataText.name(h.gear.base.name)})`;
  }

  protected setBonus(e: InventoryEntry, bonus: string): void {
    this.changed.emit(setGear(this.character(), e.id, { bonus: Number(bonus) }));
  }

  protected equip(e: InventoryEntry): void {
    const map = this.items.value()?.byId;
    if (map) this.changed.emit(toggleEquip(this.character(), e.id, map));
  }

  /** The last entry removed, to put it back ("Undo") for a few seconds. */
  protected readonly removed = signal<{ name: string; inventory: InventoryEntry[] } | null>(null);
  private removedTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearRemoved());
  }

  protected remove(e: InventoryEntry, item: Item | null | undefined): void {
    const map = this.items.value()?.byId;
    if (!map) return;
    const name = item ? this.dataText.shortName(item.name) : e.name || e.itemId || '';
    const before = this.character().inventory;
    this.changed.emit(removeEntry(this.character(), e.id, map));
    this.clearRemoved();
    this.removed.set({ name, inventory: before });
    this.removedTimer = setTimeout(() => this.removed.set(null), 8000);
  }

  protected undoRemove(): void {
    const r = this.removed();
    this.clearRemoved();
    if (r) this.changed.emit({ ...this.character(), inventory: r.inventory });
  }

  private clearRemoved(): void {
    if (this.removedTimer) clearTimeout(this.removedTimer);
    this.removedTimer = null;
    this.removed.set(null);
  }

  /** Quick search over a long inventory (by the names shown and the English ones). */
  protected readonly filter = signal('');
  protected readonly shownEntries = computed(() => {
    const q = this.filter();
    const all = this.entries();
    if (!q.trim()) return all;
    return all.filter((r) =>
      matchesQuery(
        q,
        r.entry.name,
        r.entry.itemId,
        r.item?.name,
        r.item ? this.dataText.name(r.item.name) : null,
      ),
    );
  });

  protected move(e: InventoryEntry, delta: number): void {
    const ch = this.character();
    const inventory = moveGroup(ch.inventory, e.id, delta < 0 ? -1 : 1);
    if (inventory !== ch.inventory) this.changed.emit({ ...ch, inventory });
  }

  protected qty(e: InventoryEntry, ev: Event): void {
    this.changed.emit(
      setQty(this.character(), e.id, Number((ev.target as HTMLInputElement).value)),
    );
  }

  protected readonly coinKeys = ['pp', 'gp', 'ep', 'sp', 'cp'] as const;

  protected setCoin(k: keyof Coins, ev: Event): void {
    const n = Math.max(0, Math.floor(Number((ev.target as HTMLInputElement).value)) || 0);
    const money: Coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0, ...this.character().money, [k]: n };
    this.changed.emit({ ...this.character(), money });
  }

  protected signed(n: number): string {
    return n >= 0 ? `+${n}` : `${n}`;
  }

  protected text(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
