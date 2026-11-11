import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ComponentRef,
  DestroyRef,
  ElementRef,
  ViewContainerRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';

import { hasEldritchCannon } from '../../core/artificer/cannon';
import { CompendiumService } from '../../core/compendium/compendium.service';
import { BackupService } from '../../core/characters/backup.service';
import { CharacterStore } from '../../core/characters/character-store.service';
import {
  SHEET_TABS,
  SheetTab,
  readLastTab,
  resolveTab,
  tabFromUrl,
  tabLink,
  visibleTabs,
  writeLastTab,
} from '../../core/characters/sheet-tabs';
import { filterGroups, warningFix } from '../../core/characters/sheet-helpers';
import { SyncService } from '../../core/characters/sync.service';
import { browserStorage, readEditDraft, restoreEditDraft } from '../../core/creation/edit-draft';
import { sessionMemory, writeStep } from '../../core/creation/wizard-memory';
import { DataNamePipe, DataTextPipe, DataTextService } from '../../core/i18n/data-text.service';
import { TermDomain, TermPipe, term } from '../../core/i18n/glossary';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { sheetEn } from '../../core/i18n/sheet.en';
import { sheetEs } from '../../core/i18n/sheet.es';
import { Character } from '../../core/models/character';
import { computeSheet } from '../../core/rules/engine';
import { RulesDataService } from '../../core/rules/rules-data.service';
import { Sheet, SheetFeature, SheetWarning } from '../../core/rules/sheet';
import { summonSourcesOf } from '../../core/summons/catalog';
import { SummonCatalogService } from '../../core/summons/summon-catalog.service';
import { ABILITIES } from '../../core/rules/tables';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { EquipmentPanel } from './equipment-panel';
import { ExportPdfButton } from './export-pdf-button';
import { SpellBook } from './spell-book';
import { ClassThemeDirective } from '../../shared/theme/class-theme.directive';
import { LoadError } from '../compendium/load-error';
import type { CombatTab } from './combat-tab';
import { PlayPanel } from './play-panel';
import { ReplicatePanel } from './replicate-panel';
import { TraitRestDialog } from './trait-rest-dialog';
import { pickValueLabel } from '../../shared/trait-picks';
import { HomebrewBadge } from '../homebrew/homebrew-badge';
import { SummonsPage } from '../summons/summons-page';

/** The sheet's own UI texts (core/i18n/sheet.*.ts), loaded with its chunk. */
const SHEET_TEXTS = { en: sheetEn, es: sheetEs };

/** Notes are saved this long after the last key press. */
const NOTES_DELAY_MS = 1200;

/** The character sheet: everything computed by the rules engine from the character's choices. */
@Component({
  selector: 'app-character-sheet',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    TranslatePipe,
    TermPipe,
    DataNamePipe,
    DataTextPipe,
    MarkdownPipe,
    LoadError,
    PlayPanel,
    SpellBook,
    EquipmentPanel,
    ExportPdfButton,
    ReplicatePanel,
    TraitRestDialog,
    ClassThemeDirective,
    HomebrewBadge,
    SummonsPage,
  ],
  templateUrl: './character-sheet.html',
  styleUrls: ['./character-sheet.scss', './character-sheet-layout.scss'],
  host: { '(document:click)': 'outsideClick($event)' },
})
export class CharacterSheet {
  /** Route parameter. */
  readonly id = input.required<string>();
  private readonly store = inject(CharacterStore);
  private readonly rules = inject(RulesDataService);
  private readonly sync = inject(SyncService);
  private readonly i18n = inject(I18nService);
  private readonly data = inject(DataTextService);
  private readonly router = inject(Router);
  private readonly backup = inject(BackupService);
  protected readonly canShareFiles = this.backup.canShareFiles;

  /** Live cloud status (sync runs in the background after a save). */
  protected readonly status = computed(
    () => this.store.all().find((r) => r.character.id === this.id())?.status,
  );

  /** Notes being edited (null = not touched yet, show the saved ones). */
  protected readonly notesDraft = signal<string | null>(null);
  /** Where the notes are: waiting to be saved, being saved, saved (null: untouched). */
  protected readonly notesState = signal<'pending' | 'saving' | 'saved' | null>(null);
  private notesTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly abilities = ABILITIES;

  constructor() {
    this.i18n.extend(SHEET_TEXTS);
    this.initTabs();
    this.initCombatTab();
    // leaving the sheet with notes still waiting: save them now
    inject(DestroyRef).onDestroy(() => this.flushNotes());
  }

  // -- the combat tab: its own chunk (a dynamic import), so neither the first load nor this
  // sheet's chunk carries it; a @defer block would add Angular's defer runtime to the first load

  private readonly combatSlot = viewChild('combatSlot', { read: ViewContainerRef });
  private combatRef: ComponentRef<CombatTab> | null = null;
  private combatHost: ViewContainerRef | null = null;
  protected readonly combatLoaded = signal(false);

  private initCombatTab(): void {
    let loading = false;
    effect(() => {
      const slot = this.combatSlot();
      const v = this.view.value();
      // the tab was left (or opened again): what was in the old place is gone with it
      if (this.combatRef && slot !== this.combatHost) {
        this.combatRef.destroy();
        this.combatRef = null;
        this.combatHost = null;
        this.combatLoaded.set(false);
      }
      if (!slot || !v) return;
      if (this.combatRef) {
        this.combatRef.setInput('character', v.record.character);
        this.combatRef.setInput('sheet', v.sheet);
        this.combatRef.setInput('data', v.data);
        return;
      }
      if (loading) return;
      loading = true;
      void import('./combat-tab').then(({ CombatTab }) => {
        loading = false;
        const now = this.view.value();
        const target = this.combatSlot();
        if (!now || !target || this.combatRef) return;
        const ref = target.createComponent(CombatTab);
        ref.setInput('character', now.record.character);
        ref.setInput('sheet', now.sheet);
        ref.setInput('data', now.data);
        ref.instance.changed.subscribe((state) => this.saveState(state));
        this.combatRef = ref;
        this.combatHost = target;
        this.combatLoaded.set(true);
      });
    });
    inject(DestroyRef).onDestroy(() => this.combatRef?.destroy());
  }

  /** Changes when the character shows up (a first visit can arrive before the pull brings it). */
  private readonly present = computed(() =>
    this.store.all().some((r) => r.character.id === this.id()),
  );

  protected readonly view = resource({
    params: () => ({ id: this.id(), present: this.present() }),
    loader: async ({ params }) => {
      const [record, data] = await Promise.all([this.store.get(params.id), this.rules.load()]);
      return record ? { record, data, sheet: computeSheet(record.character, data) } : null;
    },
  });

  /** Every spell, to give the spells of the feats their level (some feats only say "spell"). */
  private readonly compendium = inject(CompendiumService);
  private readonly allSpells = resource({ loader: () => this.compendium.all('spell') });

  /** The spells the feats give (Familiar Friend's Find Familiar...): cantrips first, then by level. */
  protected readonly featSpells = computed(() => {
    const byId = new Map((this.allSpells.value() ?? []).map((sp) => [sp.id, sp]));
    return (this.view.value()?.sheet.featSpells ?? [])
      .map((fs) => {
        const known = byId.get(fs.id);
        return { ...fs, level: known?.level ?? (fs.cantrip ? 0 : null), known: !!known };
      })
      .sort((a, b) => (a.level ?? 1) - (b.level ?? 1) || a.name.localeCompare(b.name));
  });

  /** The stat blocks of the summoning spells, read once (the button to the summons screen). */
  private readonly summonCatalogs = inject(SummonCatalogService);
  private readonly summonCatalog = resource({ loader: () => this.summonCatalogs.load() });
  private readonly summonSources = computed(() => {
    const v = this.view.value();
    const catalog = this.summonCatalog.value();
    if (!v || !catalog) return [];
    return summonSourcesOf(v.record.character, v.sheet, v.data.subclasses, catalog);
  });
  protected readonly spellSummons = computed(
    () => this.summonSources().filter((s) => s.kind === 'spell').length,
  );
  /** The Artillerist's Eldritch Cannon: not a catalog summon source, but shown the same way. */
  protected readonly hasCannon = computed(() => {
    const v = this.view.value();
    return !!v && hasEldritchCannon(v.record.character);
  });
  protected readonly featureSummons = computed(
    () =>
      this.summonSources().filter((s) => s.kind === 'feature').length + (this.hasCannon() ? 1 : 0),
  );

  /** Unsaved changes left in the edit wizard (kept in this browser), to offer going back to them. */
  protected readonly hasEditDraft = computed(() => {
    const record = this.view.value()?.record;
    if (!record) return false;
    return !!restoreEditDraft(
      readEditDraft(browserStorage(), record.character.id),
      record.character,
    );
  });

  /** Features grouped by where they come from (class, subclass, species, feats). */
  protected readonly featureGroups = computed(() => {
    const features = this.view.value()?.sheet.features ?? [];
    const groups = new Map<string, SheetFeature[]>();
    for (const f of features) {
      const key = `${f.source.type}:${f.source.name}`;
      groups.set(key, [...(groups.get(key) ?? []), f]);
    }
    return [...groups.values()].map((fs) => ({ source: fs[0].source, features: fs }));
  });

  /** The groups split the way the official sheet does: class, species traits, feats/background. */
  protected readonly classGroups = computed(() =>
    this.featureGroups().filter((g) => g.source.type === 'class' || g.source.type === 'subclass'),
  );
  protected readonly speciesGroups = computed(() =>
    this.featureGroups().filter((g) => g.source.type === 'species'),
  );
  protected readonly otherGroups = computed(() =>
    this.featureGroups().filter((g) => !['class', 'subclass', 'species'].includes(g.source.type)),
  );

  // -- tabs -------------------------------------------------------------------------------

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly url = signal(this.router.url);
  /** The tab the URL names (null on the bare character URL). */
  private readonly requested = computed(() => tabFromUrl(this.url(), this.id()));

  /** The tabs this character has (the summons ones need the stat blocks to be read). */
  protected readonly tabs = computed<SheetTab[]>(() => {
    const v = this.view.value();
    if (!v) return [];
    return visibleTabs(v.sheet, {
      featSpells: v.sheet.featSpells.length,
      summonSources: this.summonSources().length,
      summoned: Object.keys(v.record.character.state.summons?.creatures ?? {}).length,
      hasCannon: this.hasCannon(),
    });
  });
  protected readonly tab = computed(() => resolveTab(this.requested(), this.tabs()));
  protected readonly tabLink = tabLink;
  protected readonly allTabs = SHEET_TABS;
  private readonly loaded = computed(() => !!this.view.value());
  private readonly tabsReady = computed(
    () => !!this.view.value() && !this.summonCatalog.isLoading(),
  );

  private initTabs(): void {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((e) => {
      if (!(e instanceof NavigationEnd)) return;
      this.url.set(e.urlAfterRedirects);
      this.menuOpen.set(false);
    });

    // The bare URL goes to the last tab used; a tab this character doesn't have, to the summary.
    // Replacing the URL keeps the back button from bouncing.
    effect(() => {
      if (!this.tabsReady()) return;
      const id = this.id();
      const requested = this.requested();
      const tabs = this.tabs();
      const wanted =
        requested === null ? readLastTab(browserStorage(), id) : (requested as SheetTab | null);
      const target = resolveTab(wanted, tabs);
      if (requested === target) return;
      void this.router.navigate(tabLink(id, target), { replaceUrl: true });
    });

    // remember the tab of each character
    effect(() => {
      if (this.tabsReady() && this.requested() === this.tab()) {
        writeLastTab(browserStorage(), this.id(), this.tab());
      }
    });

    // keep the active tab in view in the (scrolling) strip of a phone
    effect(() => {
      this.tab();
      // the bar and the tabs only exist once the character is loaded: measure them then too
      this.loaded();
      setTimeout(() => {
        const strip = this.host.nativeElement.querySelector<HTMLElement>('.tabs');
        const on = strip?.querySelector<HTMLElement>('[aria-current]');
        if (strip && on)
          strip.scrollLeft = on.offsetLeft - (strip.clientWidth - on.offsetWidth) / 2;
        this.measure();
      });
    });

    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const measure = () => this.measure();
      window.addEventListener('resize', measure);
      void document.fonts?.ready.then(measure);
      destroyRef.onDestroy(() => {
        window.removeEventListener('resize', measure);
        this.barObserver?.disconnect();
      });
    });
  }

  private barObserver?: ResizeObserver;
  private observedBar: Element | null = null;

  /**
   * The sticky vitals bar sits under the app's top strap (sticky too, with ribbons hanging below
   * it; on phones the strap scrolls away) and the tabs under the bar: both heights go to CSS.
   */
  private measure(): void {
    const style = this.host.nativeElement.style;
    const strap = document.querySelector<HTMLElement>('.topbar');
    let top = 0;
    if (strap && getComputedStyle(strap).position === 'sticky') {
      top = strap.getBoundingClientRect().bottom;
      strap.querySelectorAll('nav a').forEach((a) => {
        top = Math.max(top, a.getBoundingClientRect().bottom);
      });
    }
    style.setProperty('--sheet-top', `${Math.ceil(top)}px`);
    const bar = this.host.nativeElement.querySelector('.sheet-bar');
    if (bar && bar !== this.observedBar && typeof ResizeObserver !== 'undefined') {
      this.barObserver?.disconnect();
      this.barObserver = new ResizeObserver(() => this.measure());
      this.barObserver.observe(bar);
      this.observedBar = bar;
    }
    if (bar) style.setProperty('--bar-h', `${bar.getBoundingClientRect().height}px`);
    // the strip of tabs sticks under the bar on phones and tablets (the combat tab's own strip
    // of columns sticks under it)
    const tabs = this.host.nativeElement.querySelector('.tabs');
    if (tabs) style.setProperty('--tabs-h', `${tabs.getBoundingClientRect().height}px`);
  }

  /** The summons tab saved its own change: keep the sheet's copy up to date (no second save). */
  protected summonsChanged(character: Character): void {
    const v = this.view.value();
    if (v) this.view.set({ ...v, record: { ...v.record, character } });
  }

  /** Typing in the notes: they save themselves a moment after the last key. */
  protected typeNotes(text: string): void {
    this.notesDraft.set(text);
    this.notesState.set('pending');
    if (this.notesTimer) clearTimeout(this.notesTimer);
    this.notesTimer = setTimeout(() => this.flushNotes(), NOTES_DELAY_MS);
  }

  protected flushNotes(): void {
    if (this.notesTimer) clearTimeout(this.notesTimer);
    this.notesTimer = null;
    const v = this.view.value();
    const notes = this.notesDraft();
    if (!v || notes === null || this.notesState() !== 'pending') return;
    if (notes === v.record.character.notes) {
      this.notesState.set('saved');
      return;
    }
    this.notesState.set('saving');
    this.saveCharacter({ ...v.record.character, notes });
    void this.stateSaves.then(() => {
      if (this.notesState() === 'saving') this.notesState.set('saved');
    });
  }

  private stateSaves = Promise.resolve();

  /**
   * In-game changes: shown at once (a tap must not wait for the database), saved in order, and
   * uploaded a few seconds after the last one.
   */
  protected saveState(state: Character['state']): void {
    const v = this.view.value();
    if (v) this.saveCharacter({ ...v.record.character, state });
  }

  /** Same as saveState, for other quick changes (prepared spells). */
  protected saveCharacter(character: Character): void {
    const v = this.view.value();
    if (!v) return;
    this.view.set({
      ...v,
      record: { ...v.record, character },
      sheet: computeSheet(character, v.data),
    });
    this.stateSaves = this.stateSaves
      .then(() => this.sync.saveSoon(character))
      .then(
        () => undefined,
        (e) => console.error(e),
      );
  }

  protected async remove(): Promise<void> {
    const record = this.view.value()?.record;
    this.menuOpen.set(false);
    if (!record) return;
    if (!confirm(this.i18n.t('sheet.confirmDelete', { name: record.character.name }))) return;
    await this.sync.remove(record.character.id);
    await this.router.navigate(['/characters']);
  }

  /** The character file (as in the repo): a download, or the share sheet on phones. */
  protected async exportCharacter(c: Character, share = false): Promise<void> {
    try {
      await this.backup.exportCharacter(c, share);
    } catch (e) {
      alert(this.i18n.t('common.error', { message: (e as Error).message }));
    }
  }

  /** What was picked inside a trait (species-picks.ts), in the current language. */
  protected chosenText(chosen: { kind: string; values: string[] }[]): string {
    const spells = new Map((this.allSpells.value() ?? []).map((sp) => [sp.id, sp.name]));
    return chosen
      .flatMap((c) =>
        c.values.map((v) =>
          pickValueLabel(this.i18n, this.data, (id) => spells.get(id), c.kind, v),
        ),
      )
      .join(', ');
  }

  /** A list of game terms in the current language. */
  protected terms(values: string[], domain: TermDomain, sep = ', '): string {
    return values.map((v) => term(this.i18n.language(), domain, v)).join(sep);
  }

  protected className(sheet: Sheet, id: string): string {
    return this.data.name(sheet.classes.find((c) => c.id === id)?.name ?? id);
  }

  /** Where a "To review" warning gets fixed (a step of the editor, or a tab of this sheet). */
  protected readonly warningFix = warningFix;

  /** Opens the editor on the step that fixes the warning. */
  protected fixInEditor(step: string): void {
    const id = this.id();
    writeStep(sessionMemory(), id, step);
    void this.router.navigate(['/characters', id, 'edit']);
  }

  // -- quick filter of the features tab --

  protected readonly featureQuery = signal('');
  /** "Open all" in the features tab (a search opens what it finds, too). */
  protected readonly featuresOpen = signal(false);
  private featureText = (f: SheetFeature): string[] => [
    f.name,
    this.data.name(f.name),
    this.data.text(f.description),
  ];
  protected readonly featureCount = computed(() => this.view.value()?.sheet.features.length ?? 0);
  protected readonly shownClassGroups = computed(() =>
    filterGroups(this.classGroups(), this.featureQuery(), this.featureText),
  );
  protected readonly shownSpeciesGroups = computed(() =>
    filterGroups(this.speciesGroups(), this.featureQuery(), this.featureText),
  );
  protected readonly shownOtherGroups = computed(() =>
    filterGroups(this.otherGroups(), this.featureQuery(), this.featureText),
  );
  protected readonly featuresFound = computed(
    () =>
      this.shownClassGroups().length +
        this.shownSpeciesGroups().length +
        this.shownOtherGroups().length >
      0,
  );

  /** Summary on phones: the chips that jump to a part of the (long) page. */
  protected jumpTo(id: string): void {
    this.host.nativeElement
      .querySelector(`#${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected warning(w: SheetWarning): string {
    const params = { ...w.params };
    if (params['what']) params['what'] = this.i18n.t(`sheet.what.${params['what']}` as never);
    if (params['cls']) params['cls'] = this.data.shortName(params['cls']);
    if (params['title']) params['title'] = this.data.text(params['title']);
    return this.i18n.t(w.key, params);
  }

  /** "10 + DEX + shield" with the abbreviations of the current language. */
  protected formula(f: string): string {
    return f
      .replace(/\b(STR|DEX|CON|INT|WIS|CHA)\b/g, (a) => this.i18n.t(`abbr.${a}` as never))
      .replace(/\bshield\b/, this.i18n.t('sheet.shield'))
      .replace(/\(max (\d+)\)/, (_, n) => this.i18n.t('sheet.maxN', { n }));
  }

  protected skillsOf(sheet: Sheet, ability: string) {
    return sheet.skills.filter((sk) => sk.ability === ability);
  }

  /** Uses left of a feat's free cast ("1/1"), from the play state. */
  protected freeLeft(c: Character, sheet: Sheet, key: string | null): string | null {
    const use = key ? sheet.featUses.find((u) => u.key === key) : null;
    if (!use) return null;
    return `${use.max - Math.min(c.state.resources[use.key] ?? 0, use.max)}/${use.max}`;
  }

  protected clsName(s: { classes: { id: string; name: string }[] }, id: string): string {
    return s.classes.find((k) => k.id === id)?.name ?? id;
  }

  protected signed(n: number): string {
    return n >= 0 ? `+${n}` : `${n}`;
  }

  /** Actions menu of the header (phones and tablets). */
  protected readonly menuOpen = signal(false);

  /** Level up is offered until level 20. */
  protected canLevelUp(c: Character): boolean {
    return c.classes.reduce((n, k) => n + k.level, 0) < 20;
  }

  /** Keyboard in the menu: Escape closes, arrows / Home / End move between the items. */
  protected menuKey(e: KeyboardEvent): void {
    const root = e.currentTarget as HTMLElement;
    if (e.key === 'Escape' && this.menuOpen()) {
      e.preventDefault();
      this.menuOpen.set(false);
      root.querySelector<HTMLElement>('.menu-button')?.focus();
      return;
    }
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const items = Array.from(
      root.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'),
    );
    if (!this.menuOpen()) {
      if (e.key !== 'ArrowDown') return;
      e.preventDefault();
      this.menuOpen.set(true);
      setTimeout(() => root.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
      return;
    }
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? items.length - 1
          : e.key === 'ArrowDown'
            ? (i + 1) % items.length
            : (i - 1 + items.length) % items.length;
    items[next].focus();
  }

  /** A click outside the menu closes it. */
  protected outsideClick(e: Event): void {
    if (this.menuOpen() && !(e.target as HTMLElement).closest?.('.menu')) this.menuOpen.set(false);
  }

  /** Focus left the menu: close it. */
  protected menuFocusOut(e: FocusEvent): void {
    const root = e.currentTarget as HTMLElement;
    if (e.relatedTarget && !root.contains(e.relatedTarget as Node)) this.menuOpen.set(false);
  }

  protected classLine(sheet: Sheet): string {
    return sheet.classes
      .map((c) => {
        const sub = c.subclass ? ` (${this.data.shortName(c.subclass)})` : '';
        return `${this.data.shortName(c.name)} ${c.level}${sub}`;
      })
      .join(' / ');
  }

  protected speeds(sheet: Sheet): { kind: string; value: number }[] {
    return Object.entries(sheet.speed).map(([kind, value]) => ({ kind, value }));
  }

  /** Spell slot levels that have at least one slot. */
  protected slotLevels(sheet: Sheet): { level: number; count: number }[] {
    return sheet.spellcasting.slots
      .map((count, i) => ({ level: i + 1, count }))
      .filter((s) => s.count > 0);
  }
}
