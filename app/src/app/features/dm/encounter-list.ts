import { Component, computed, inject, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { SyncService } from '../../core/characters/sync.service';
import { CompendiumService } from '../../core/compendium/compendium.service';
import { RepositoryService } from '../../core/data/repository.service';
import { Encounter } from '../../core/dm/encounter';
import { EncounterStore } from '../../core/dm/encounter-store.service';
import { I18nService, LocalDatePipe, TranslatePipe } from '../../core/i18n/i18n.service';
import { FolderPrefs } from '../../core/organize/folder-prefs';
import { groupByFolder, removeFolderFrom, renameFolderIn } from '../../core/organize/folders';
import { RATING_KEY, encounterStats } from './encounter-stats';
import { PasswordForm, PasswordSubmit } from './password-form';

/** The select's "create a new folder" option, never a real folder name. */
const NEW_FOLDER = '\u0000new';

/**
 * The DM's saved encounters: open, create (with the DM's password, or one of its own), duplicate,
 * delete; the DM's password (unlock, change, lock), and encounters this device can't open yet.
 */
@Component({
  selector: 'app-encounter-list',
  imports: [RouterLink, TranslatePipe, LocalDatePipe, PasswordForm],
  template: `
    <a class="back-link" routerLink="/dm">← {{ 'dm.title' | t }}</a>
    <h1>{{ 'dm.encounters.title' | t }}</h1>
    <p>{{ (github() ? 'encounters.introSynced' : 'encounters.intro') | t }}</p>

    <!-- the DM's password -->
    <section class="vault" [attr.data-state]="vaultState()" aria-labelledby="vault-title">
      <h2 id="vault-title">{{ 'vault.title' | t }}</h2>
      @switch (vaultState()) {
        @case ('none') {
          <p>{{ 'vault.noneYet' | t }}</p>
        }
        @case ('locked') {
          <p>{{ 'vault.lockedHelp' | t }}</p>
          <app-password-form
            [submitLabel]="'vault.unlock' | t"
            [busy]="busy() === 'unlock'"
            [error]="unlockError()"
            (submitted)="unlockDm($event)"
          />
        }
        @case ('unlocked') {
          <p>
            {{ 'vault.unlockedHelp' | t }}
            @if (!changing()) {
              <span class="vault-actions">
                <button type="button" (click)="changing.set(true)">
                  {{ 'vault.change' | t }}
                </button>
                <button type="button" class="btn-ghost" (click)="lock()">
                  {{ 'vault.lock' | t }}
                </button>
              </span>
            }
          </p>
          @if (changing()) {
            <p class="muted">{{ 'vault.changeHelp' | t }}</p>
            <app-password-form
              mode="new"
              cancelable
              [submitLabel]="'vault.changeSubmit' | t"
              [busy]="busy() === 'change'"
              (submitted)="changeDm($event)"
              (cancelled)="changing.set(false)"
            />
          }
        }
      }
      @if (github()) {
        <p class="sync-line" role="status">
          @if (store.syncError(); as err) {
            <span class="issue" [title]="err">{{ 'encounters.syncError' | t }}</span>
          } @else if (store.pending()) {
            {{ 'encounters.pending' | t: { count: store.pending() } }}
          } @else {
            {{ 'encounters.synced' | t }}
          }
          @if (store.unprotected()) {
            · {{ 'encounters.unprotected' | t: { count: store.unprotected() } }}
          }
        </p>
      } @else if (store.unprotected()) {
        <p class="sync-line">{{ 'encounters.unprotected' | t: { count: store.unprotected() } }}</p>
      }
    </section>

    @if (!creating()) {
      <p>
        <button type="button" class="primary" (click)="startCreate()">
          + {{ 'encounters.new' | t }}
        </button>
      </p>
    } @else {
      <section class="create card" aria-labelledby="create-title">
        <h2 id="create-title">{{ 'encounters.new' | t }}</h2>
        <app-password-form
          cancelable
          [mode]="createMode()"
          [hidePassword]="!ownPassword() && vaultState() === 'unlocked'"
          [submitLabel]="'encounters.create' | t"
          [busy]="busy() === 'create'"
          [error]="createError()"
          (submitted)="create($event)"
          (cancelled)="creating.set(false)"
        >
          <label class="field">
            {{ 'encounter.name' | t }}
            <input
              type="text"
              name="name"
              [value]="newName()"
              (input)="newName.set($any($event.target).value)"
            />
          </label>
          <p class="muted">
            @if (ownPassword()) {
              {{ 'encounters.ownPasswordHelp' | t }}
            } @else {
              @switch (vaultState()) {
                @case ('none') {
                  {{ 'vault.createHelp' | t }}
                }
                @case ('locked') {
                  {{ 'encounters.dmPasswordLocked' | t }}
                }
                @default {
                  {{ 'encounters.dmPasswordUsed' | t }}
                }
              }
            }
          </p>
          <label>
            <input
              type="checkbox"
              name="own"
              [checked]="ownPassword()"
              (change)="ownPassword.set($any($event.target).checked)"
            />
            {{ 'encounters.useOwnPassword' | t }}
          </label>
        </app-password-form>
      </section>
    }

    @if (store.locked().length) {
      <ul class="encounters">
        @for (l of store.locked(); track l.id) {
          <li class="locked">
            <span class="name">{{ 'encounters.locked' | t }}</span>
            <span class="summary">{{
              (l.dmPassword ? 'encounters.lockedDm' : 'encounters.lockedOwn') | t
            }}</span>
            <small>{{ l.updatedAt | localDate }}</small>
            @if (opening() === l.id) {
              <app-password-form
                cancelable
                [submitLabel]="'vault.open' | t"
                [busy]="busy() === l.id"
                [error]="unlockError()"
                (submitted)="unlockOne(l.id, $event)"
                (cancelled)="opening.set(null)"
              />
            } @else {
              <span class="actions">
                <button type="button" (click)="startOpen(l.id)">{{ 'vault.open' | t }}</button>
              </span>
            }
          </li>
        }
      </ul>
    }

    @if (!store.all().length && !store.locked().length) {
      <p class="folder-empty">{{ 'encounters.empty' | t }}</p>
    } @else if (store.all().length) {
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
              <p class="folder-empty">{{ 'encounters.folderEmpty' | t }}</p>
            } @else {
              <ul class="encounters">
                @for (e of g.items; track e.id) {
                  @let s = stats(e);
                  <li>
                    <a class="name link" [routerLink]="['/dm/encounters', e.id]">{{
                      e.name || ('encounters.unnamed' | t)
                    }}</a>
                    @if (s.rating !== 'none') {
                      <span class="rating" [attr.data-rating]="s.rating">{{
                        ratingKey[s.rating] | t
                      }}</span>
                    }
                    <span class="summary">
                      {{
                        'encounters.summary'
                          | t: { characters: s.characters, creatures: s.creatures }
                      }}
                      @if (xpLoaded()) {
                        · {{ 'encounter.xpValue' | t: { xp: num(s.xp) } }}
                      }
                    </span>
                    <small>{{ e.updatedAt | localDate }}</small>
                    <span class="actions">
                      @if (e.monsters.length) {
                        <a
                          class="btn btn-primary"
                          [routerLink]="['/dm/combat']"
                          [queryParams]="{ encounter: e.id }"
                          >{{ 'encounter.startCombat' | t }}</a
                        >
                      }
                      <button type="button" class="btn-ghost" (click)="duplicate(e)">
                        {{ 'encounters.duplicate' | t }}
                      </button>
                      <button type="button" class="danger" (click)="remove(e)">
                        {{ 'encounters.delete' | t }}
                      </button>
                    </span>
                    <label class="move">
                      {{ 'folders.moveTo' | t }}
                      <select (change)="moveEncounter(e, $any($event.target).value)">
                        <option value="" [selected]="!e.folder">{{ 'folders.none' | t }}</option>
                        @for (f of folderNames(); track f) {
                          <option [value]="f" [selected]="e.folder === f">{{ f }}</option>
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
  `,
  styles: `
    .vault {
      margin: var(--space-3) 0 var(--space-4);
      padding: var(--space-3) var(--space-4);
      border-left: 0.35rem solid var(--vault, var(--line-strong));
      background: color-mix(in srgb, var(--card) 60%, transparent);
      border-radius: var(--radius-sm);
    }
    .vault[data-state='locked'] {
      --vault: var(--warn);
    }
    .vault[data-state='unlocked'] {
      --vault: var(--ok);
    }
    .vault h2 {
      margin: 0 0 var(--space-1);
      font-size: var(--fs-lg);
    }
    .vault p {
      margin: 0 0 var(--space-2);
    }
    .vault-actions {
      display: inline-flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-left: var(--space-2);
    }
    .sync-line {
      font-size: var(--fs-sm);
      color: var(--ink-soft);
    }
    .create {
      margin-bottom: var(--space-4);
    }
    .create h2 {
      margin-top: 0;
    }
    .field {
      display: grid;
      gap: 0.15rem;
      font-size: var(--fs-sm);
      color: var(--ink-soft);
    }
    .field input {
      font-size: var(--fs-md);
    }
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
    .encounters {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
      gap: var(--space-4);
      padding: 0;
      list-style: none;
    }
    li {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2) var(--space-3);
      margin: 0;
      padding: var(--space-3) var(--space-4);
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-1);
    }
    li.locked {
      border-style: dashed;
      background: color-mix(in srgb, var(--card) 55%, var(--paper-2));
    }
    li.locked app-password-form {
      flex: 1 1 100%;
    }
    li:focus-within {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }
    .name {
      flex: 1 1 auto;
      min-width: 0;
      font-family: var(--font-title);
      font-size: var(--fs-xl);
      font-weight: 700;
      line-height: 1.15;
      color: var(--accent);
      text-decoration: none;
      overflow-wrap: anywhere;
    }
    .locked .name {
      color: var(--ink-soft);
    }
    .link::after {
      content: '';
      position: absolute;
      inset: 0;
    }
    .link:focus-visible {
      outline: none;
    }
    .summary,
    small {
      flex: 1 1 100%;
    }
    small {
      color: var(--ink-soft);
    }
    .actions {
      position: relative;
      z-index: 1;
      display: flex;
      gap: var(--space-2);
      margin-left: auto;
    }
    .rating {
      position: relative;
      z-index: 1;
      padding: 0 0.6em;
      font-family: var(--font-title);
      font-size: var(--fs-sm);
      color: var(--rating, var(--ink-soft));
      border: 1px solid currentColor;
      border-radius: 0.8em;
    }
    [data-rating='low'] {
      --rating: var(--ok);
    }
    [data-rating='moderate'] {
      --rating: var(--warn);
    }
    [data-rating='high'],
    [data-rating='aboveHigh'] {
      --rating: var(--danger);
    }
    [data-rating='aboveHigh'] {
      font-weight: 700;
    }
  `,
})
export class EncounterList {
  protected readonly store = inject(EncounterStore);
  private readonly vault = this.store.vault;
  private readonly compendium = inject(CompendiumService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly sync = inject(SyncService);
  private readonly repo = inject(RepositoryService);
  protected readonly ratingKey = RATING_KEY;

  private readonly folderPrefs = new FolderPrefs('dnd-helper.encounterFolders');
  protected readonly newFolderOption = NEW_FOLDER;

  private readonly monsters = resource({ loader: () => this.compendium.all('monster') });
  private readonly xpById = computed(
    () => new Map((this.monsters.value() ?? []).map((m) => [m.id, m.xp])),
  );
  protected readonly xpLoaded = computed(() => !!this.monsters.value());

  /** Encounters go to the repo (GitHub is set up). */
  protected readonly github = computed(() => this.repo.source()?.kind === 'github');

  protected readonly vaultState = computed<'none' | 'locked' | 'unlocked'>(() =>
    !this.vault.hasDmPassword() ? 'none' : this.vault.dmKey() ? 'unlocked' : 'locked',
  );

  /** What's being worked on (key derivation takes a moment): 'create', 'unlock', an id... */
  protected readonly busy = signal<string | null>(null);
  protected readonly unlockError = signal<string | null>(null);
  protected readonly createError = signal<string | null>(null);
  protected readonly changing = signal(false);
  protected readonly creating = signal(false);
  protected readonly newName = signal('');
  protected readonly ownPassword = signal(false);
  /** The locked encounter whose password is being asked. */
  protected readonly opening = signal<string | null>(null);

  /** A new password is typed twice: the DM's the first time, or one of its own. */
  protected readonly createMode = computed(() =>
    this.ownPassword() || this.vaultState() === 'none' ? 'new' : 'current',
  );

  constructor() {
    void this.store.load();
  }

  protected stats(e: Encounter) {
    return encounterStats(e, this.xpById());
  }

  protected num(n: number): string {
    return n.toLocaleString(this.i18n.language());
  }

  // -- folders --------------------------------------------------------------------------------

  /** The encounter list grouped by folder, in the order folders were created (empty ones too). */
  protected groups() {
    return groupByFolder(this.store.all(), (e) => e.folder, this.folderPrefs.names()).filter(
      (g) => g.folder !== null || g.items.length > 0,
    );
  }

  protected folderNames(): string[] {
    return this.folderPrefs.names();
  }

  protected isCollapsed(folder: string | null): boolean {
    return this.folderPrefs.isCollapsed(folder);
  }

  protected toggleFolder(folder: string | null): void {
    this.folderPrefs.toggle(folder);
  }

  protected createFolder(): void {
    const name = prompt(this.i18n.t('folders.namePrompt'))?.trim();
    if (name) this.folderPrefs.ensure(name);
  }

  protected async moveEncounter(e: Encounter, value: string): Promise<void> {
    let folder: string | null = value || null;
    if (value === NEW_FOLDER) {
      const name = prompt(this.i18n.t('folders.namePrompt'))?.trim();
      if (!name) return;
      folder = name;
    }
    if (folder) this.folderPrefs.ensure(folder);
    if (folder === (e.folder ?? null)) return;
    await this.store.save({ ...e, folder });
    this.sync.syncSoon();
  }

  protected async renameFolder(name: string): Promise<void> {
    const next = prompt(this.i18n.t('folders.renamePrompt'), name)?.trim();
    if (!next || next === name) return;
    const to = this.folderPrefs.rename(name, next);
    await this.applyFolderChange(
      renameFolderIn(
        this.store.all(),
        (e) => e.folder,
        (e, folder) => ({ ...e, folder }),
        name,
        to,
      ),
    );
  }

  protected async deleteFolder(name: string): Promise<void> {
    if (!confirm(this.i18n.t('folders.deleteConfirm', { name }))) return;
    await this.applyFolderChange(
      removeFolderFrom(
        this.store.all(),
        (e) => e.folder,
        (e, folder) => ({ ...e, folder }),
        name,
      ),
    );
    this.folderPrefs.remove(name);
  }

  /** Saves every encounter whose folder actually changed, leaving the rest untouched. */
  private async applyFolderChange(updated: Encounter[]): Promise<void> {
    const before = this.store.all();
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].folder !== before[i]?.folder) await this.store.save(updated[i]);
    }
    this.sync.syncSoon();
  }

  // -- the DM's password ------------------------------------------------------------------------

  protected async unlockDm({ password, remember }: PasswordSubmit): Promise<void> {
    await this.run('unlock', async () => {
      const ok = await this.store.unlockDm(password, remember);
      this.unlockError.set(ok ? null : 'vault.wrong');
      if (ok) this.sync.syncSoon();
    });
  }

  protected async changeDm({ password, remember }: PasswordSubmit): Promise<void> {
    await this.run('change', async () => {
      await this.store.changeDmPassword(password, remember);
      this.changing.set(false);
      void this.sync.sync();
    });
  }

  protected async lock(): Promise<void> {
    if (!confirm(this.i18n.t('vault.lockConfirm'))) return;
    await this.store.lock();
  }

  protected startOpen(id: string): void {
    this.unlockError.set(null);
    this.opening.set(id);
  }

  protected async unlockOne(id: string, { password, remember }: PasswordSubmit): Promise<void> {
    await this.run(id, async () => {
      const ok = await this.store.unlock(id, password, remember);
      this.unlockError.set(ok ? null : 'vault.wrong');
      if (ok) {
        this.opening.set(null);
        this.sync.syncSoon();
      }
    });
  }

  // -- encounters ---------------------------------------------------------------------------------

  protected startCreate(): void {
    this.newName.set(this.i18n.t('encounters.defaultName'));
    this.ownPassword.set(false);
    this.createError.set(null);
    this.creating.set(true);
  }

  protected async create({ password, remember }: PasswordSubmit): Promise<void> {
    await this.run('create', async () => {
      this.createError.set(null);
      let key;
      if (this.ownPassword()) {
        key = await this.vault.newKey(password, remember);
      } else if (this.vaultState() === 'none') {
        await this.store.createDmPassword(password, remember);
      } else if (this.vaultState() === 'locked') {
        if (!(await this.store.unlockDm(password, remember))) {
          this.createError.set('vault.wrong');
          return;
        }
      }
      const e = await this.store.create(this.newName().trim(), key);
      this.creating.set(false);
      this.sync.syncSoon();
      await this.router.navigate(['/dm/encounters', e.id]);
    });
  }

  protected async duplicate(e: Encounter): Promise<void> {
    await this.store.duplicate(e.id, this.i18n.t('encounters.copyName', { name: e.name }));
    this.sync.syncSoon();
  }

  protected async remove(e: Encounter): Promise<void> {
    if (!confirm(this.i18n.t('encounters.confirmDelete', { name: e.name }))) return;
    await this.store.remove(e.id);
    this.sync.syncSoon();
  }

  private async run(what: string, work: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(what);
    try {
      await work();
    } finally {
      this.busy.set(null);
    }
  }
}
