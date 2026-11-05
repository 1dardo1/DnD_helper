import { Component, computed, inject, input, output, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  addItem,
  canEquip,
  moveEntry,
  removeEntry,
  setGear,
  setQty,
  toggleEquip,
} from '../../core/characters/inventory';
import {
  BonusOption,
  armorStats,
  baseCandidates,
  bonusOptions,
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
import { WeaponEntry, attacksFor } from '../../core/rules/attacks';
import { Sheet } from '../../core/rules/sheet';
import {
  addSpellItem,
  consumeSpellItem,
  isScroll,
  levelStats,
  spellBinding,
} from '../../core/spell-items/spell-items';
import { baseLabel } from '../../core/characters/base-label';
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
    return this.character().inventory.map((e) => {
      const item = e.itemId ? v?.byId.get(e.itemId) : undefined;
      const gear = v ? gearOf(e, item, v.byId) : null;
      // a magic weapon, armor or shield: its base (to choose or to change) and bonus
      const magic =
        v && item && gearKind(item)
          ? { bases: baseCandidates(item, v.all), bonuses: bonusOptions(item) }
          : null;
      return {
        entry: e,
        item,
        gear,
        magic,
        armor: gear && gear.kind === 'armor' && magic ? armorStats(gear) : null,
        held: this.held(e),
      };
    });
  });

  protected readonly attacks = computed(() => {
    const weapons: WeaponEntry[] = this.entries()
      // ammunition (Arrows, Bolts...) is listed as a weapon without damage: it is no attack
      .filter(
        (e) =>
          e.gear?.kind === 'weapon' &&
          !!e.gear.base?.weapon &&
          (e.gear.base.weapon.damage.length > 0 || e.gear.base.weapon.properties.length > 0),
      )
      .map((e) => ({
        id: e.entry.id,
        equipped: e.entry.equipped,
        item: e.gear!.base!,
        magic: e.magic ? { item: e.item!, bonus: e.gear!.bonus } : undefined,
      }));
    return attacksFor(this.sheet(), weapons);
  });

  /** A magic item whose base (and bonus) is being asked before it is added. */
  protected readonly pending = signal<{
    item: Item;
    bases: Item[];
    bonuses: BonusOption[];
    baseId: string;
    bonus: number;
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

  protected baseLabel(b: Item): string {
    return baseLabel(b, this.i18n, this.dataText);
  }

  protected add(item: Item | null): void {
    const v = this.items.value();
    if (!v) return;
    if (item && spellBinding(item)) {
      this.choosing.set(item);
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
    this.changed.emit(
      addItem(this.character(), p.item, '', {
        ...(p.baseId ? { baseId: p.baseId } : {}),
        ...(p.bonuses.length > 1 ? { bonus: p.bonus } : {}),
      }),
    );
    this.pending.set(null);
  }

  protected pendingPatch(patch: { baseId?: string; bonus?: number }): void {
    const p = this.pending();
    if (p) this.pending.set({ ...p, ...patch });
  }

  protected setBase(e: InventoryEntry, baseId: string): void {
    if (baseId) this.changed.emit(setGear(this.character(), e.id, { baseId }));
  }

  protected setBonus(e: InventoryEntry, bonus: string): void {
    this.changed.emit(setGear(this.character(), e.id, { bonus: Number(bonus) }));
  }

  protected equip(e: InventoryEntry): void {
    const map = this.items.value()?.byId;
    if (map) this.changed.emit(toggleEquip(this.character(), e.id, map));
  }

  protected remove(e: InventoryEntry): void {
    const map = this.items.value()?.byId;
    if (map) this.changed.emit(removeEntry(this.character(), e.id, map));
  }

  protected move(e: InventoryEntry, delta: number): void {
    this.changed.emit(moveEntry(this.character(), e.id, delta));
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
