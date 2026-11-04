import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { knownPlans, planCounts, ResolvedPlan } from '../../core/artificer/plans';
import {
  PlanRef,
  ReplicatedItem,
  canTransmute,
  changeReplicated,
  createReplicated,
  createdItems,
  dismissReplicatePrompt,
  removeReplicated,
  transformReplicated,
} from '../../core/artificer/replicated-state';
import { CompendiumService } from '../../core/compendium/compendium.service';
import { DataNamePipe, DataTextService } from '../../core/i18n/data-text.service';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { Character } from '../../core/models/character';
import { RulesDataService } from '../../core/rules/rules-data.service';

/** Transmute Magic Item comes with the Artificer's level 6 Magic Item Tinker. */
const TINKER_LEVEL = 6;

/**
 * Replicate Magic Item on the sheet (Artificer 2+): the plans known with a "create" button, the
 * items created so far (the oldest vanishes over the maximum), Transmute from level 6, and the
 * Long Rest question (state.replicatePrompt). It only computes the new character; the sheet saves.
 */
@Component({
  selector: 'app-replicate-panel',
  imports: [RouterLink, TranslatePipe, DataNamePipe],
  templateUrl: './replicate-panel.html',
  styleUrl: './replicate-panel.scss',
})
export class ReplicatePanel {
  readonly character = input.required<Character>();
  readonly changed = output<Character>();

  private readonly rules = inject(RulesDataService);
  private readonly compendium = inject(CompendiumService);
  private readonly dataText = inject(DataTextService);
  private readonly i18n = inject(I18nService);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  private readonly data = resource({
    loader: async () => {
      const [rules, options] = await Promise.all([
        this.rules.load(),
        this.compendium.all('option'),
      ]);
      return { rules, options: new Map(options.map((o) => [o.id, o])) };
    },
  });

  /** Artificer level (0 = none). */
  protected readonly level = computed(
    () => this.character().classes.find((k) => k.id === 'artificer')?.level ?? 0,
  );
  protected readonly counts = computed(() => {
    const cls = this.data.value()?.rules.classes.get('artificer');
    return cls ? planCounts(cls, this.level()) : null;
  });
  protected readonly max = computed(() => this.counts()?.items ?? 2);
  protected readonly plans = computed<ResolvedPlan[]>(() => {
    const d = this.data.value();
    return d ? knownPlans(this.character().choices.options, d.options, d.rules.items) : [];
  });
  protected readonly created = computed(() =>
    createdItems(this.character()).map((r) => ({
      ...r,
      item: this.data.value()?.rules.items.get(r.itemId),
      name: this.character().inventory.find((e) => e.id === r.inventoryId)?.name || r.itemId,
      plan: this.plans().find((p) => p.id === r.planId),
    })),
  );
  protected readonly tinker = computed(() => this.level() >= TINKER_LEVEL);
  protected readonly canTransmute = computed(() => canTransmute(this.character()));
  /** Plans without a created item yet. */
  protected readonly free = computed(() => {
    const used = new Set(this.created().map((c) => c.planId));
    return this.plans().filter((p) => !used.has(p.id));
  });
  protected readonly prompt = computed(
    () => this.level() >= 2 && this.character().state.replicatePrompt === true,
  );

  /** What vanished in the last action, to tell the player. */
  protected readonly message = signal('');
  /** Creation whose Transmute target is being picked (inventory id). */
  protected readonly transforming = signal<string | null>(null);
  /** Long Rest question: 'ask' (keep / change) or 'change' (pick what goes and what is made). */
  protected readonly mode = signal<'ask' | 'change'>('ask');
  protected readonly removing = signal<string[]>([]);
  protected readonly making = signal<string[]>([]);

  constructor() {
    effect(() => {
      const el = this.dialog()?.nativeElement;
      if (!el) return;
      if (this.prompt() && !el.open) {
        this.mode.set('ask');
        this.removing.set([]);
        this.making.set([]);
        el.showModal();
      } else if (!this.prompt() && el.open) el.close();
    });
  }

  private ref(p: ResolvedPlan): PlanRef {
    return { planId: p.id, itemId: p.itemId, name: p.name };
  }

  private vanishedText(list: ReplicatedItem[]): string {
    const names = list.map((r) => {
      const name = this.character().inventory.find((e) => e.id === r.inventoryId)?.name;
      return this.dataText.shortName(name || r.itemId);
    });
    return names.length ? this.i18n.t('plans.vanished', { names: names.join(', ') }) : '';
  }

  protected create(p: ResolvedPlan): void {
    const items = this.data.value()?.rules.items;
    if (!items) return;
    const res = createReplicated(this.character(), this.ref(p), this.max(), items);
    if (!res.created) return;
    this.message.set(this.vanishedText(res.vanished));
    this.changed.emit(res.character);
  }

  protected remove(inventoryId: string): void {
    const items = this.data.value()?.rules.items;
    if (items) this.changed.emit(removeReplicated(this.character(), inventoryId, items));
    this.message.set('');
  }

  protected transform(inventoryId: string, planId: string): void {
    const items = this.data.value()?.rules.items;
    const plan = this.plans().find((p) => p.id === planId);
    if (!items || !plan) return;
    const next = transformReplicated(this.character(), inventoryId, this.ref(plan), items);
    this.transforming.set(null);
    this.message.set('');
    if (next) this.changed.emit(next);
  }

  // -- Long Rest question --

  protected keep(): void {
    this.changed.emit({
      ...this.character(),
      state: dismissReplicatePrompt(this.character().state),
    });
  }

  protected toggle(signalOf: 'removing' | 'making', id: string, on: boolean): void {
    const s = signalOf === 'removing' ? this.removing : this.making;
    s.update((l) => (on ? [...new Set([...l, id])] : l.filter((x) => x !== id)));
  }

  protected apply(): void {
    const items = this.data.value()?.rules.items;
    if (!items) return;
    const make = this.making()
      .map((id) => this.plans().find((p) => p.id === id))
      .filter((p): p is ResolvedPlan => !!p)
      .map((p) => this.ref(p));
    const res = changeReplicated(this.character(), this.removing(), make, this.max(), items);
    this.message.set('');
    this.changed.emit({ ...res.character, state: dismissReplicatePrompt(res.character.state) });
  }

  /** Plans that can be made in the "change" step, once the ticked items are gone. */
  protected readonly makeable = computed(() => {
    const gone = new Set(this.removing());
    const used = new Set(
      this.created()
        .filter((c) => !gone.has(c.inventoryId))
        .map((c) => c.planId),
    );
    return this.plans().filter((p) => !used.has(p.id));
  });

  protected value(e: Event): string {
    return (e.target as HTMLSelectElement).value;
  }

  protected checked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }
}
