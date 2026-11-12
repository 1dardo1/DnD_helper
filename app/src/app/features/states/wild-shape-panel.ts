import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { CompendiumService } from '../../core/compendium/compendium.service';
import { DataNamePipe, DataTextService } from '../../core/i18n/data-text.service';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { STATES_TEXTS } from '../../core/i18n/states.es';
import { Character } from '../../core/models/character';
import { Monster } from '../../core/models/compendium';
import { assumeForm, usesLeftFor } from '../../core/play/active-play';
import { leaveForm, playResources } from '../../core/play/play-state';
import { Sheet } from '../../core/rules/sheet';
import {
  eligibleForms,
  formView,
  knownForms,
  toggleKnownForm,
  wildShapeRules,
} from '../../core/rules/wild-shape';
import { MonsterStatBlock } from '../compendium/monster-stat-block';
import { crText } from '../../shared/picker/entry-facets';
import { EntryLabels } from '../../shared/picker/entry-labels.service';
import { WildShapeForm } from './wild-shape-form';

/**
 * Wild Shape in the summons tab: the forms the Druid knows (picked from the Beasts of the
 * compendium the Beast Shapes table allows), a button to take each one, the sheet of the form
 * the Druid is in and the way back. Emits the whole character (known forms are a choice, the
 * form taken is play state); the host saves it.
 */
@Component({
  selector: 'app-wild-shape-panel',
  imports: [RouterLink, TranslatePipe, DataNamePipe, MonsterStatBlock, WildShapeForm],
  templateUrl: './wild-shape-panel.html',
  styleUrl: './wild-shape-panel.scss',
})
export class WildShapePanel {
  readonly character = input.required<Character>();
  readonly sheet = input.required<Sheet>();
  readonly changed = output<Character>();

  private readonly compendium = inject(CompendiumService);
  private readonly i18n = inject(I18nService);
  private readonly data = inject(DataTextService);
  private readonly labels = inject(EntryLabels);

  constructor() {
    this.i18n.extend(STATES_TEXTS);
  }

  private readonly monsters = resource({ loader: () => this.compendium.all('monster') });
  private readonly byId = computed(
    () => new Map((this.monsters.value() ?? []).map((m) => [m.id, m])),
  );

  protected readonly rules = computed(() => wildShapeRules(this.sheet()));
  private readonly resources = computed(() => playResources(this.sheet()));
  protected readonly left = computed(() =>
    usesLeftFor(this.character().state, 'wildShape', this.resources()),
  );
  protected readonly max = computed(
    () => this.resources().find((r) => r.key === 'druid:wild shape')?.max ?? 0,
  );

  protected readonly known = computed(() => {
    const r = this.rules();
    return r ? knownForms(this.character().choices.wildShapeForms, this.byId(), r) : [];
  });
  protected readonly knownIds = computed(() => new Set(this.known().map((k) => k.monster.id)));
  protected readonly full = computed(() => this.known().length >= (this.rules()?.known ?? 0));

  protected readonly form = computed(() => {
    const id = this.character().state.wildShape?.formId;
    const m = id ? this.byId().get(id) : undefined;
    const r = this.rules();
    return m && r ? formView(this.sheet(), m, r) : null;
  });

  protected readonly summary = computed(() => {
    const r = this.rules();
    if (!r) return '';
    const t = (k: string, p?: Record<string, string | number>) => this.i18n.t(k as never, p);
    return t('ws.rules', {
      known: r.known,
      cr: crText(r.maxCr),
      fly: t(r.fly ? 'ws.fly.yes' : 'ws.fly.no'),
      hours: r.hours,
      thp: r.tempHp,
    });
  });

  // -- choosing the known forms ---------------------------------------------------------
  protected readonly choosing = signal(false);
  protected readonly query = signal('');
  protected readonly eligible = computed(() => {
    const r = this.rules();
    if (!r) return [];
    this.data.shownLanguage();
    const q = this.query().trim().toLowerCase();
    return eligibleForms(this.monsters.value() ?? [], r).filter(
      (m) =>
        !q ||
        m.name.toLowerCase().includes(q) ||
        this.data.shortName(m.name).toLowerCase().includes(q),
    );
  });

  protected toggleKnown(id: string): void {
    const ch = this.character();
    const ids = toggleKnownForm(ch.choices.wildShapeForms, id, this.rules()?.known ?? 0);
    const choices: Character['choices'] = { ...ch.choices, wildShapeForms: ids };
    if (!ids.length) delete choices.wildShapeForms;
    this.changed.emit({ ...ch, choices });
  }

  protected search(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
  }

  // -- taking a form ----------------------------------------------------------------------
  protected transform(id: string): void {
    const r = this.rules();
    if (!r) return;
    const ch = this.character();
    const state = assumeForm(ch.state, this.resources(), id, r);
    if (state !== ch.state) this.changed.emit({ ...ch, state });
  }

  protected revert(): void {
    const ch = this.character();
    this.changed.emit({ ...ch, state: leaveForm(ch.state) });
  }

  // -- texts --------------------------------------------------------------------------------
  protected cr(m: Monster): string {
    return crText(m.cr);
  }

  protected speed(m: Monster): string {
    return this.labels.monsterSpeed(m);
  }

  // -- the full stat block ------------------------------------------------------------------
  protected readonly shown = signal<Monster | null>(null);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  protected openSheet(m: Monster): void {
    this.shown.set(m);
    this.dialog()?.nativeElement.showModal();
  }

  protected closeSheet(): void {
    this.dialog()?.nativeElement.close();
  }
}
