import { Component, computed, inject, input, output } from '@angular/core';

import {
  ALL_TOOLS,
  RARE_LANGUAGES,
  STANDARD_LANGUAGES,
  TOOL_GROUPS,
} from '../core/creation/creation-rules';
import { DataTextService } from '../core/i18n/data-text.service';
import { TermPipe } from '../core/i18n/glossary';
import { TranslatePipe } from '../core/i18n/i18n.service';
import { FeatChoice } from '../core/models/character';
import { Spell } from '../core/models/compendium';
import {
  FeatSource,
  PickContext,
  PickRule,
  SPELL_ABILITIES,
  abilityRule,
  featList,
  featPicks,
  featRules,
  pickable,
  siberysSpellIds,
  togglePick,
} from '../core/rules/feat-effects';
import { SKILL_ABILITY } from '../core/rules/tables';
import { ENTRY_FACETS } from './picker/entry-facets';
import { Picker } from './picker/picker';

/**
 * What a feat asks the player to choose: the spellcasting ability, the spell list, the cantrips
 * and spell, skills and tools, a language, a damage type. Shows nothing for a feat without choices.
 * It only reports the new choice; the screen stores it (character.choices.featChoices).
 */
@Component({
  selector: 'app-feat-choices',
  imports: [TranslatePipe, TermPipe, Picker],
  template: `
    @if (shown()) {
      <fieldset class="feat-choices" [attr.data-testid]="'feat-choices-' + source().key">
        <legend>{{ 'featchoice.title' | t: { feat: featName() } }}</legend>

        @if (abilityNeeded()) {
          <label>
            {{ 'featchoice.ability' | t }}
            <select
              [value]="cv().ability ?? ''"
              (change)="set({ ability: abilityValue($event) })"
              data-testid="feat-ability"
            >
              <option value="">—</option>
              @for (a of abilities; track a) {
                <option [value]="a">{{ 'ability.' + a | t }}</option>
              }
            </select>
          </label>
        }

        @if (picks().list && !source().fixedList) {
          <label>
            {{ 'featchoice.list' | t }}
            <select
              [value]="cv().list ?? ''"
              (change)="setList(text($event))"
              data-testid="feat-list"
            >
              <option value="">—</option>
              @for (l of picks().list; track l) {
                <option [value]="l">{{ listLabel(l) }}</option>
              }
            </select>
          </label>
        } @else if (list(); as l) {
          <p class="hint">{{ 'featchoice.listFixed' | t: { list: listLabel(l) } }}</p>
        }

        @if (picks().cantrips; as cr) {
          <div class="spell-pick" data-testid="feat-cantrips">
            <h3 [class.issue]="cantripsPicked() > cr.count">
              {{ 'sheet.cantrips' | t }} ({{ cantripsPicked() }} / {{ cr.count }})
            </h3>
            @if (listMissing()) {
              <p class="hint">{{ 'featchoice.pickListFirst' | t }}</p>
            } @else {
              <app-picker
                multiple
                [items]="cantripOptions()"
                [facets]="spellFacets"
                [selected]="cv().cantrips ?? []"
                [label]="'sheet.cantrips' | t"
                (picked)="pickCantrip($event.id, $event.on)"
              />
            }
          </div>
        }

        @if (picks().school; as schools) {
          <label data-testid="feat-school">
            {{ 'featchoice.school' | t }}
            <select [value]="cv().school ?? ''" (change)="setSchool(text($event))">
              <option value="">—</option>
              @for (sc of schools; track sc) {
                <option [value]="sc">{{ sc | term: 'school' }}</option>
              }
            </select>
          </label>
        }

        @if (picks().spell; as sp) {
          <div class="spell-pick" data-testid="feat-spell">
            <h3>
              @if (sp.maxLevel !== undefined) {
                {{ 'featchoice.spellUpTo' | t: { level: sp.maxLevel } }}
              } @else {
                {{ 'featchoice.spell' | t: { level: levelOf(sp) } }}
              }
            </h3>
            @if (sp.table) {
              <p class="hint">{{ 'featchoice.tableHint' | t }}</p>
            }
            @if (blockedKey(sp); as blocked) {
              <p class="hint">{{ blocked | t }}</p>
            } @else {
              <app-picker
                [items]="spellOptions()"
                [facets]="spellFacets"
                [selected]="cv().spell ? [cv().spell!] : []"
                [label]="'featchoice.spell' | t: { level: levelOf(sp) }"
                (picked)="set({ spell: $event.id })"
              />
            }
          </div>
        }

        @if (picks().signature; as sg) {
          <div class="spell-pick" data-testid="feat-signature">
            <h3>{{ 'featchoice.signature' | t: { level: levelOf(sg) } }}</h3>
            @if (blockedKey(sg); as blocked) {
              <p class="hint">{{ blocked | t }}</p>
            } @else {
              <app-picker
                [items]="signatureOptions()"
                [facets]="spellFacets"
                [selected]="cv().signature ? [cv().signature!] : []"
                [label]="'featchoice.signature' | t: { level: levelOf(sg) }"
                (picked)="set({ signature: $event.id })"
              />
            }
          </div>
        }

        @for (n of skillOrToolSlots(); track n) {
          <label>
            {{ 'featchoice.skillOrTool' | t: { n: n + 1 } }}
            <select [value]="mixed(n)" (change)="setMixed(n, text($event))">
              <option value="">—</option>
              <optgroup [label]="'featchoice.group.skills' | t">
                @for (sk of skills; track sk) {
                  <option [value]="'skill:' + sk" [disabled]="takenElsewhere('skill:' + sk, n)">
                    {{ 'skill.' + sk | t }}
                  </option>
                }
              </optgroup>
              <optgroup [label]="'featchoice.group.tools' | t">
                @for (tl of allTools; track tl) {
                  <option [value]="'tool:' + tl" [disabled]="takenElsewhere('tool:' + tl, n)">
                    {{ tl | term: 'tool' }}
                  </option>
                }
              </optgroup>
            </select>
          </label>
        }

        @for (n of skillSlots(); track n) {
          <label>
            {{ 'featchoice.skill' | t: { n: n + 1 } }}
            <select [value]="cv().skills?.[n] ?? ''" (change)="setList2('skills', n, text($event))">
              <option value="">—</option>
              @for (sk of skillOptions(); track sk) {
                <option [value]="sk">{{ 'skill.' + sk | t }}</option>
              }
            </select>
          </label>
        }

        @for (n of toolSlots(); track n) {
          <label>
            {{ 'featchoice.tool' | t: { n: n + 1 } }}
            <select
              [value]="cv().tools?.[n] ?? ''"
              (change)="setList2('tools', n, text($event))"
              data-testid="feat-tool"
            >
              <option value="">—</option>
              @for (tl of toolOptions(); track tl) {
                <option
                  [value]="tl"
                  [disabled]="(cv().tools ?? []).includes(tl) && cv().tools?.[n] !== tl"
                >
                  {{ tl | term: 'tool' }}
                </option>
              }
            </select>
          </label>
        }

        @if (picks().language; as lang) {
          <label>
            {{ 'featchoice.language' | t: { lang: (lang | term: 'language') } }}
            <select
              [value]="cv().languages?.[0] ?? ''"
              (change)="setList2('languages', 0, text($event))"
            >
              <option value="">—</option>
              @for (l of languages; track l) {
                <option [value]="l">{{ l | term: 'language' }}</option>
              }
            </select>
          </label>
        }

        @if (picks().resistance; as kinds) {
          <label>
            {{ 'featchoice.resistance' | t }}
            <select
              [value]="cv().resistance ?? ''"
              (change)="set({ resistance: text($event) || undefined })"
            >
              <option value="">—</option>
              @for (k of kinds; track k) {
                <option [value]="k">{{ k | term: 'damage' }}</option>
              }
            </select>
          </label>
        }
      </fieldset>
    }
  `,
  styles: `
    .feat-choices {
      display: grid;
      gap: var(--space-2);
    }
    label {
      display: grid;
      gap: 0.2rem;
    }
    .spell-pick {
      display: grid;
      gap: var(--space-2);
    }
    .spell-pick h3 {
      margin: 0;
    }
  `,
})
export class FeatChoices {
  readonly source = input.required<FeatSource>();
  readonly choice = input<FeatChoice | undefined>(undefined);
  readonly spells = input<readonly Spell[]>([]);
  /** Spell lists of the character's casting classes (casterSpellLists in engine.ts). */
  readonly casterLists = input<readonly string[]>([]);
  readonly changed = output<FeatChoice>();

  private readonly dataText = inject(DataTextService);

  protected readonly abilities = SPELL_ABILITIES;
  protected readonly skills = Object.keys(SKILL_ABILITY);
  protected readonly languages = [...STANDARD_LANGUAGES, ...RARE_LANGUAGES];
  protected readonly allTools = ALL_TOOLS;

  /** Spell facets for a pick: the list and the level are already fixed by the feat. */
  protected readonly spellFacets = ENTRY_FACETS.spell.filter((k) => k !== 'class' && k !== 'level');

  protected readonly picks = computed(() => featPicks(this.source().feat));
  protected readonly featName = computed(() => this.dataText.shortName(this.source().feat.name));
  protected readonly cv = computed(() => this.choice() ?? {});
  protected readonly list = computed(() => featList(this.source(), this.choice()));

  /** Whether the feat's spellcasting ability is for the player to choose. */
  protected readonly abilityNeeded = computed(() => {
    const feat = this.source().feat;
    const p = this.picks();
    return (
      abilityRule(feat).mode === 'choice' &&
      (featRules(feat).spells.length > 0 || !!p.cantrips || !!p.spell)
    );
  });

  protected readonly shown = computed(() => {
    const p = this.picks();
    return this.abilityNeeded() || Object.keys(p).length > 0;
  });

  protected readonly listMissing = computed(() => !!this.picks().list && !this.list());
  /** Ids of the spells of the feat's own table (Siberys Dragonmark Spells); none for other feats. */
  private readonly tableIds = computed(() => siberysSpellIds(this.source().feat));

  /** "cleric" -> "Clérigo" / "Cleric". */
  protected listLabel(id: string): string {
    return this.dataText.shortName(id[0].toUpperCase() + id.slice(1));
  }

  protected skillOrToolSlots(): number[] {
    return range(this.picks().skillsOrTools ?? 0);
  }
  protected skillSlots(): number[] {
    return range(this.picks().skills?.count ?? 0);
  }
  protected toolSlots(): number[] {
    return range(this.picks().tools?.count ?? 0);
  }
  protected skillOptions(): string[] {
    return this.picks().skills?.from ?? this.skills;
  }
  protected toolOptions(): string[] {
    const group = this.picks().tools?.group;
    return group ? (TOOL_GROUPS[group] ?? []) : [];
  }

  protected readonly cantripsPicked = computed(() => this.choice()?.cantrips?.length ?? 0);

  protected cantripOptions(): Spell[] {
    const rule = this.picks().cantrips;
    if (!rule || this.listMissing()) return [];
    return pickable(this.spells(), rule, this.list()) as Spell[];
  }

  protected spellOptions(): Spell[] {
    const rule = this.picks().spell;
    if (!rule || this.blockedKey(rule)) return [];
    return pickable(this.spells(), rule, this.list(), this.pickContext()) as Spell[];
  }

  protected signatureOptions(): Spell[] {
    const rule = this.picks().signature;
    if (!rule || this.blockedKey(rule)) return [];
    return pickable(this.spells(), rule, this.list(), this.pickContext()) as Spell[];
  }

  /** The level a spell rule is about: its maximum ("level 7 or lower") or its exact level. */
  protected levelOf(rule: { level?: number; maxLevel?: number }): number {
    return rule.maxLevel ?? rule.level ?? 0;
  }

  /** The translation key of what must be chosen before a spell rule can offer spells; '' if none. */
  protected blockedKey(rule: PickRule): string {
    const p = this.picks();
    if (!rule.lists && !rule.classLists && p.list && !this.list())
      return 'featchoice.pickListFirst';
    if (rule.schoolOfChoice && !this.choice()?.school) return 'featchoice.pickSchoolFirst';
    if (rule.classLists && this.casterLists().length === 0) return 'featchoice.noCaster';
    return '';
  }

  protected setSchool(school: string): void {
    // the spells picked from the old school no longer apply
    this.set({ school: school || undefined, spell: undefined, signature: undefined });
  }

  /** What the spell rules are picked among: the list, the school, the casting classes' lists. */
  private pickContext(): PickContext {
    return {
      list: this.list(),
      school: this.choice()?.school ?? null,
      casterLists: this.casterLists(),
      table: this.tableIds(),
    };
  }

  /** Ticks or unticks a cantrip; a pick beyond the feat's count is ignored. */
  protected pickCantrip(id: string, on: boolean): void {
    const rule = this.picks().cantrips;
    if (!rule) return;
    this.set({ cantrips: togglePick(this.choice()?.cantrips ?? [], id, on, rule.count) });
  }

  // -- Skilled: skills and tools in one list ------------------------------------------------

  /** The n-th pick of skills-or-tools, as "skill:arcana" / "tool:Dice" ('' = none). */
  protected mixed(n: number): string {
    const c = this.choice();
    const all = [
      ...(c?.skills ?? []).map((s) => `skill:${s}`),
      ...(c?.tools ?? []).map((t) => `tool:${t}`),
    ];
    return all[n] ?? '';
  }

  protected takenElsewhere(value: string, n: number): boolean {
    return this.skillOrToolSlots().some((i) => i !== n && this.mixed(i) === value);
  }

  protected setMixed(n: number, value: string): void {
    const all = this.skillOrToolSlots().map((i) => (i === n ? value : this.mixed(i)));
    const picked = all.filter(Boolean);
    this.set({
      skills: picked.filter((v) => v.startsWith('skill:')).map((v) => v.slice(6)),
      tools: picked.filter((v) => v.startsWith('tool:')).map((v) => v.slice(5)),
    });
  }

  // -- changes ----------------------------------------------------------------------------

  protected set(patch: Partial<FeatChoice>): void {
    const next = { ...(this.choice() ?? {}), ...patch };
    for (const k of Object.keys(next) as (keyof FeatChoice)[])
      if (next[k] === undefined || (Array.isArray(next[k]) && !(next[k] as unknown[]).length))
        delete next[k];
    this.changed.emit(next);
  }

  protected setList(list: string): void {
    // the spells picked from another list no longer apply
    this.set({ list: list || undefined, cantrips: [], spell: undefined });
  }

  protected setList2(field: 'skills' | 'tools' | 'languages', n: number, value: string): void {
    const list = [...(this.choice()?.[field] ?? [])];
    list[n] = value;
    this.set({ [field]: list.filter(Boolean) });
  }

  protected abilityValue(e: Event): FeatChoice['ability'] {
    return ((e.target as HTMLSelectElement).value || undefined) as FeatChoice['ability'];
  }

  protected text(e: Event): string {
    return (e.target as HTMLSelectElement).value;
  }
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
