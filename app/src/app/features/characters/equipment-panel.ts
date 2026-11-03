import { Component, computed, inject, input, output, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  addItem,
  canEquip,
  moveEntry,
  removeEntry,
  setQty,
  toggleEquip,
} from '../../core/characters/inventory';
import { CompendiumService } from '../../core/compendium/compendium.service';
import { DataNamePipe, DataTextService } from '../../core/i18n/data-text.service';
import { TermPipe } from '../../core/i18n/glossary';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { Character, Coins, InventoryEntry } from '../../core/models/character';
import { Item } from '../../core/models/compendium';
import { WeaponEntry, attacksFor } from '../../core/rules/attacks';
import { Sheet } from '../../core/rules/sheet';
import { defaultOrder } from '../../shared/picker/entry-order';
import { normalise, rankName } from '../compendium/compendium-search';

/** Attacks with the carried weapons, and the inventory (add, equip, remove). */
@Component({
  selector: 'app-equipment-panel',
  imports: [RouterLink, TranslatePipe, TermPipe, DataNamePipe],
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

  private readonly items = resource({
    loader: async () => {
      const all = await this.compendium.all('item');
      return { all, byId: new Map(all.map((i) => [i.id, i])) };
    },
  });

  protected readonly query = signal('');
  /** Shows the ↑ ↓ buttons to rearrange the inventory. */
  protected readonly reordering = signal(false);

  protected readonly entries = computed(() => {
    const byId = this.items.value()?.byId;
    return this.character().inventory.map((e) => ({
      entry: e,
      item: e.itemId ? byId?.get(e.itemId) : undefined,
    }));
  });

  protected readonly attacks = computed(() => {
    const weapons: WeaponEntry[] = this.entries()
      .filter((e) => !!e.item?.weapon)
      .map((e) => ({ id: e.entry.id, equipped: e.entry.equipped, item: e.item! }));
    return attacksFor(this.sheet(), weapons);
  });

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

  protected add(item: Item | null): void {
    const map = this.items.value()?.byId;
    if (!map) return;
    this.changed.emit(addItem(this.character(), item, item ? '' : this.query()));
    this.query.set('');
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
