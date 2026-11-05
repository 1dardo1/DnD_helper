import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CharacterStore } from '../../core/characters/character-store.service';
import { DataNamePipe } from '../../core/i18n/data-text.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { Item, Spell } from '../../core/models/compendium';
import { addSpellItem, spellBinding } from '../../core/spell-items/spell-items';
import { SpellItemPicker } from '../../shared/spell-item-picker';

/** Item page: add an item that holds a spell (Spell Scroll...) to a character, choosing the spell. */
@Component({
  selector: 'app-add-spell-item',
  imports: [RouterLink, TranslatePipe, DataNamePipe, SpellItemPicker],
  template: `
    <section class="add-spell">
      <h3>{{ 'spellitem.addTitle' | t }}</h3>
      @if (store.all().length === 0) {
        <p class="muted">{{ 'spellitem.noCharacters' | t }}</p>
      } @else {
        <label>
          {{ 'spellitem.character' | t }}
          <select (change)="selected.set($any($event.target).value)">
            @for (r of store.all(); track r.character.id) {
              <option [value]="r.character.id" [selected]="r.character.id === characterId()">
                {{ r.character.name }}
              </option>
            }
          </select>
        </label>
        @if (!choosing()) {
          <button type="button" (click)="choosing.set(true)">
            + {{ 'spellitem.anySpell' | t }}
          </button>
        } @else {
          <app-spell-item-picker
            [item]="item()"
            [binding]="binding()!"
            (picked)="add($event)"
            (cancelled)="choosing.set(false)"
          />
        }
      }
      @if (done(); as d) {
        <p class="ok" role="status">
          {{ 'spellitem.added' | t: { spell: (d.spell | dataName), name: d.name } }}
          <a [routerLink]="['/characters', d.id]">{{ 'spellitem.openSheet' | t }}</a>
        </p>
      }
    </section>
  `,
  styles: `
    .add-spell {
      margin-block: var(--space-4);
      padding: var(--space-3);
      border: 1px dashed var(--line-strong);
      border-radius: var(--radius-md);
    }
    h3 {
      margin-top: 0;
    }
    label {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-2);
    }
    button {
      min-height: var(--tap, 2.75rem);
    }
  `,
})
export class AddSpellItem {
  readonly item = input.required<Item>();
  protected readonly store = inject(CharacterStore);

  protected readonly binding = computed(() => spellBinding(this.item()));
  protected readonly selected = signal<string | null>(null);
  protected readonly choosing = signal(false);
  protected readonly done = signal<{ spell: string; name: string; id: string } | null>(null);

  protected readonly characterId = computed(
    () => this.selected() ?? this.store.all()[0]?.character.id ?? '',
  );

  constructor() {
    void this.store.load();
  }

  protected async add(spell: Spell): Promise<void> {
    const id = this.characterId();
    const record = id ? await this.store.get(id) : undefined;
    if (!record) return;
    await this.store.save(addSpellItem(record.character, this.item(), spell.id));
    this.choosing.set(false);
    this.done.set({ spell: spell.name, name: record.character.name, id: record.character.id });
  }
}
