import { Component, OnInit, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CharacterStore } from '../../core/characters/character-store.service';
import { SyncService } from '../../core/characters/sync.service';
import { CompendiumService } from '../../core/compendium/compendium.service';
import { DataTextService } from '../../core/i18n/data-text.service';
import { I18nService, LocalDatePipe, TranslatePipe } from '../../core/i18n/i18n.service';
import { Character, CharacterRecord } from '../../core/models/character';
import { FolderPrefs } from '../../core/organize/folder-prefs';
import {
  groupByFolder,
  knownFolderNames,
  removeFolderFrom,
  renameFolderIn,
} from '../../core/organize/folders';
import { RulesDataService } from '../../core/rules/rules-data.service';
import { BackupPanel } from '../../shared/backup-panel';
import { PortraitAvatar } from '../../shared/portrait-avatar';
import { ClassThemeDirective } from '../../shared/theme/class-theme.directive';
import { CharacterVitals } from './character-vitals';

/** The select's "create a new folder" option, never a real folder name. */
const NEW_FOLDER = '\u0000new';

/** Characters on this device (plus any new ones in the repo), with their cloud status. */
@Component({
  selector: 'app-character-list',
  imports: [
    RouterLink,
    TranslatePipe,
    LocalDatePipe,
    ClassThemeDirective,
    BackupPanel,
    PortraitAvatar,
    CharacterVitals,
  ],
  template: `
    <h1>{{ 'characters.title' | t }}</h1>
    <p>
      <a class="btn btn-primary new" routerLink="/characters/new">+ {{ 'nav.create' | t }}</a>
    </p>

    @if (sync.lastError()) {
      <p role="alert">{{ 'common.error' | t: { message: sync.lastError() ?? '' } }}</p>
    }

    @if (!store.all().length) {
      <p>{{ 'characters.empty' | t }}</p>
    } @else {
      <p>
        <button type="button" class="btn-ghost new-folder" (click)="createFolder()">
          + {{ 'folders.new' | t }}
        </button>
      </p>
      @for (g of groups(); track g.folder ?? '') {
        <section class="folder-group">
          <h2 class="folder-header">
            <button
              type="button"
              class="collapse"
              [attr.aria-expanded]="!isCollapsed(g.folder)"
              (click)="toggleFolder(g.folder)"
            >
              <span class="chevron" [class.open]="!isCollapsed(g.folder)">▸</span>
              {{ g.folder ?? ('folders.none' | t) }}
              <span class="count">{{ g.items.length }}</span>
            </button>
            @if (g.folder) {
              <span class="folder-actions">
                <button type="button" (click)="renameFolder(g.folder)">
                  {{ 'folders.rename' | t }}
                </button>
                <button type="button" class="danger" (click)="deleteFolder(g.folder)">
                  {{ 'folders.delete' | t }}
                </button>
              </span>
            }
          </h2>
          @if (!isCollapsed(g.folder)) {
            @if (!g.items.length) {
              <p class="folder-empty">{{ 'characters.folderEmpty' | t }}</p>
            } @else {
              <ul class="characters">
                @for (r of g.items; track r.character.id) {
                  <li
                    [appClassTheme]="{
                      classId: r.character.classes[0]?.id,
                      subclassId: r.character.classes[0]?.subclassId,
                    }"
                  >
                    <a [routerLink]="['/characters', r.character.id]" class="name-link"
                      ><app-portrait-avatar
                        class="avatar"
                        [portrait]="r.character.portrait"
                        [name]="r.character.name"
                      /><strong>{{ r.character.name }}</strong></a
                    >
                    @if (summary(r.character); as line) {
                      <span class="summary">{{ line }}</span>
                    }
                    <app-character-vitals [character]="r.character" [data]="rules.value()" />
                    <span class="status" [attr.data-status]="r.status">{{
                      'characters.status.' + r.status | t
                    }}</span>
                    @if (r.status === 'conflict') {
                      <a [routerLink]="['/characters', r.character.id, 'conflict']">{{
                        'conflict.resolve' | t
                      }}</a>
                    }
                    <small
                      >{{ r.character.updatedAt | localDate }} · {{ r.character.updatedBy }}</small
                    >
                    <label class="move">
                      {{ 'folders.moveTo' | t }}
                      <select (change)="moveCharacter(r.character, $any($event.target).value)">
                        <option value="" [selected]="!r.character.folder">
                          {{ 'folders.none' | t }}
                        </option>
                        @for (f of folderNames(); track f) {
                          <option [value]="f" [selected]="r.character.folder === f">{{ f }}</option>
                        }
                        <option [value]="newFolderOption">{{ 'folders.createOption' | t }}</option>
                      </select>
                    </label>
                  </li>
                }
              </ul>
            }
          }
        </section>
      }
    }

    <section class="backup" aria-labelledby="backup-title">
      <h2 id="backup-title">{{ 'backup.title' | t }}</h2>
      <app-backup-panel />
    </section>
  `,
  styles: `
    .new-folder {
      font-family: var(--font-note);
      font-weight: 700;
    }
    .folder-group {
      margin-bottom: var(--space-4);
    }
    .folder-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2) var(--space-3);
      margin: 0 0 var(--space-2);
    }
    .folder-header .collapse {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-title);
      font-size: var(--fs-lg);
      font-weight: 700;
      color: var(--ink);
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
    }
    .chevron {
      display: inline-block;
      transition: transform 0.15s ease;
    }
    .chevron.open {
      transform: rotate(90deg);
    }
    .folder-header .count {
      font-family: var(--font-note);
      font-size: var(--fs-sm);
      color: var(--ink-soft);
    }
    .folder-actions {
      display: flex;
      gap: var(--space-2);
      margin-left: auto;
    }
    .folder-empty {
      color: var(--ink-soft);
      font-style: italic;
    }
    .move {
      position: relative;
      z-index: 1;
      display: flex;
      flex: 1 1 100%;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--fs-sm);
      color: var(--ink-soft);
    }
    .characters {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
      gap: var(--space-4);
      padding: 0;
      list-style: none;
    }
    .characters li {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2) var(--space-3);
      align-items: center;
      margin: 0;
      padding: 2.6rem var(--space-4) var(--space-3);
      background-color: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-1);
    }
    .characters li.class-theme::after {
      top: 1.5rem;
      width: 4.5rem;
    }
    .characters li > a:first-child {
      flex: 1 1 100%;
      font-family: var(--font-hand);
      font-size: var(--fs-2xl);
      line-height: 1.1;
      color: var(--accent);
      text-decoration: none;
    }
    .characters li > a.name-link {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
    .avatar {
      --portrait: 3.25rem;
    }
    .characters li > a:first-child::after {
      content: '';
      position: absolute;
      inset: 0;
    }
    .characters li > a:first-child strong {
      font-weight: 700;
    }
    .characters li:focus-within {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }
    .characters li > a:first-child:focus-visible {
      outline: none;
    }
    .characters li > a:not(:first-child) {
      position: relative;
      z-index: 1;
      padding-block: 0.5rem;
      margin-block: -0.5rem;
      font-weight: 700;
      color: var(--danger);
    }
    .characters small,
    .characters .summary {
      flex: 1 1 100%;
    }
    .characters .summary {
      margin-top: calc(-1 * var(--space-1));
      font-family: var(--font-note);
      font-size: var(--fs-lg);
    }
    .backup {
      margin-top: var(--space-5);
    }
    .new {
      font-family: var(--font-note);
      font-weight: 700;
    }
  `,
})
export class CharacterList implements OnInit {
  protected readonly store = inject(CharacterStore);
  protected readonly sync = inject(SyncService);
  private readonly data = inject(DataTextService);
  private readonly compendium = inject(CompendiumService);
  private readonly i18n = inject(I18nService);
  private readonly rulesData = inject(RulesDataService);

  /** The compendium tables for the HP/AC chips, loaded once for the whole list (null: not yet). */
  protected readonly rules = resource({ loader: () => this.rulesData.load() });

  private readonly folderPrefs = new FolderPrefs('dnd-helper.characterFolders');
  protected readonly newFolderOption = NEW_FOLDER;

  /** The character list grouped by folder, in the order folders were created (empty ones too). */
  protected readonly groups = () =>
    groupByFolder(this.store.all(), (r) => r.character.folder, this.folderPrefs.names()).filter(
      (g) => g.folder !== null || g.items.length > 0,
    );

  protected folderNames(): string[] {
    return knownFolderNames(this.store.all(), (r) => r.character.folder, this.folderPrefs.names());
  }

  protected isCollapsed(folder: string | null): boolean {
    return this.folderPrefs.isCollapsed(folder);
  }

  protected toggleFolder(folder: string | null): void {
    this.folderPrefs.toggle(folder);
  }

  /** English names of classes and species by id, for the "Fighter 3 · Human" line. */
  private readonly names = resource({
    loader: async () => {
      const [classes, species] = await Promise.all([
        this.compendium.all('class'),
        this.compendium.all('species'),
      ]);
      return new Map([...classes, ...species].map((e) => [e.type + ':' + e.id, e.name]));
    },
  });

  /** "Guerrero 3 / Mago 1 · Humano", in the reader's language (empty while loading). */
  protected summary(c: Character): string {
    const names = this.names.value();
    if (!names) return '';
    const name = (key: string) => this.data.shortName(names.get(key) ?? '');
    const classes = c.classes.map((k) => `${name('class:' + k.id) || k.id} ${k.level}`).join(' / ');
    const species = c.species ? name('species:' + c.species.id) : '';
    return [classes, species].filter(Boolean).join(' · ');
  }

  async ngOnInit(): Promise<void> {
    await this.store.load();
    void this.sync.sync();
  }

  // -- folders --------------------------------------------------------------------------------

  protected createFolder(): void {
    const name = prompt(this.i18n.t('folders.namePrompt'))?.trim();
    if (name) this.folderPrefs.ensure(name);
  }

  protected async moveCharacter(character: Character, value: string): Promise<void> {
    let folder: string | null = value || null;
    if (value === NEW_FOLDER) {
      const name = prompt(this.i18n.t('folders.namePrompt'))?.trim();
      if (!name) return;
      folder = name;
    }
    if (folder) this.folderPrefs.ensure(folder);
    if (folder === (character.folder ?? null)) return;
    await this.sync.save({ ...character, folder });
  }

  protected async renameFolder(name: string): Promise<void> {
    const next = prompt(this.i18n.t('folders.renamePrompt'), name)?.trim();
    if (!next || next === name) return;
    const to = this.folderPrefs.rename(name, next);
    await this.applyFolderChange(
      renameFolderIn(
        this.records(),
        (r) => r.character.folder,
        (r, folder) => ({ ...r, character: { ...r.character, folder } }),
        name,
        to,
      ),
    );
  }

  protected async deleteFolder(name: string): Promise<void> {
    if (!confirm(this.i18n.t('folders.deleteConfirm', { name }))) return;
    await this.applyFolderChange(
      removeFolderFrom(
        this.records(),
        (r) => r.character.folder,
        (r, folder) => ({ ...r, character: { ...r.character, folder } }),
        name,
      ),
    );
    this.folderPrefs.remove(name);
  }

  private records(): CharacterRecord[] {
    return this.store.all();
  }

  /** Saves every character whose folder actually changed, leaving the rest untouched. */
  private async applyFolderChange(updated: CharacterRecord[]): Promise<void> {
    const before = this.records();
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].character.folder !== before[i]?.character.folder) {
        await this.sync.save(updated[i].character);
      }
    }
  }
}
