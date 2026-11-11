import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DataNamePipe, DataTextPipe } from '../../core/i18n/data-text.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { DndClass, Feature, Subclass } from '../../core/models/compendium';
import { MarkdownPipe } from '../markdown.pipe';
import { useWizardTexts } from './wizard-texts';

/**
 * What a class or a subclass gives, for its card's "Ver más" in the wizard and the level up: hit
 * die and hit points, skills to choose, multiclass requirement, and its features by level (those
 * up to the character's level first, each one unfolds its text), so the choice can be made
 * without leaving for the compendium (the link is still there, last).
 */
@Component({
  selector: 'app-class-info',
  imports: [RouterLink, TranslatePipe, DataNamePipe, DataTextPipe, MarkdownPipe],
  template: `
    @if (cls(); as c) {
      <dl class="facts">
        <dt>{{ 'wizard.info.hitDie' | t }}</dt>
        <dd>d{{ c.hitDie }} · {{ 'wizard.info.hpFirst' | t: { die: c.hitDie } }}</dd>
        <dt>{{ 'wizard.info.primary' | t }}</dt>
        <dd>{{ abbrs(c.primaryAbility) }}</dd>
        <dt>{{ 'sheet.skills' | t }}</dt>
        <dd>
          {{
            'wizard.info.skillsChoose'
              | t: { n: c.proficiencies.skills.choose, list: skills(c.proficiencies.skills.from) }
          }}
        </dd>
        @if (multiclass(); as m) {
          <dt>{{ 'create.multiclass' | t }}</dt>
          <dd>{{ 'wizard.info.multiclass' | t: { what: m } }}</dd>
        }
      </dl>
    }
    @if (now().length) {
      <h4>{{ 'wizard.info.atLevel' | t: { level: level() } }}</h4>
      <ul class="features">
        @for (f of now(); track $index) {
          <li>
            <details (toggle)="toggled(f, $event)">
              <summary>
                <span class="lv">{{ f.level }}</span> {{ f.name | dataName }}
              </summary>
              @if (isOpen(f)) {
                <div class="md" [innerHTML]="f.description | dataText | markdown"></div>
              }
            </details>
          </li>
        }
      </ul>
    }
    @if (later().length) {
      <details class="later">
        <summary>{{ 'wizard.info.later' | t }} ({{ later().length }})</summary>
        <ul class="features">
          @for (f of later(); track $index) {
            <li>
              <details (toggle)="toggled(f, $event)">
                <summary>
                  <span class="lv">{{ f.level }}</span> {{ f.name | dataName }}
                </summary>
                @if (isOpen(f)) {
                  <div class="md" [innerHTML]="f.description | dataText | markdown"></div>
                }
              </details>
            </li>
          }
        </ul>
      </details>
    }
    @if (entry(); as e) {
      @if (e.description) {
        <details class="desc">
          <summary>{{ 'wizard.info.description' | t }}</summary>
          <div class="md" [innerHTML]="e.description | dataText | markdown"></div>
        </details>
      }
      <p class="open">
        <a [routerLink]="['/compendium', e.type, e.id]">{{ 'picker.open' | t }}</a>
      </p>
    }
  `,
  styles: `
    :host {
      display: block;
      font-size: var(--fs-sm);
    }

    .facts {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 0.15rem var(--space-3);
      margin: 0 0 var(--space-2);

      dt {
        color: var(--ink-soft);
        font-style: italic;
      }

      dd {
        margin: 0;
      }
    }

    h4 {
      margin: var(--space-3) 0 var(--space-1);
      color: var(--accent);
    }

    .features {
      margin: 0;
      padding: 0;
      list-style: none;

      summary {
        min-height: 2.2rem;
        display: flex;
        align-items: center;
        gap: var(--space-2);
        cursor: pointer;
      }

      .md {
        padding: 0 0 var(--space-2) 2.2rem;
      }
    }

    .lv {
      display: inline-grid;
      place-items: center;
      min-width: 1.6rem;
      height: 1.6rem;
      font-size: var(--fs-xs);
      font-weight: 700;
      color: var(--ink-soft);
      border: 1px solid var(--line-strong);
      border-radius: 50%;
    }

    .later,
    .desc {
      margin-top: var(--space-2);

      > summary {
        min-height: var(--tap);
        display: flex;
        align-items: center;
        color: var(--ink-blue);
        cursor: pointer;
      }
    }

    .open {
      margin: var(--space-3) 0 0;
    }
  `,
})
export class ClassInfo {
  readonly cls = input<DndClass | null | undefined>(null);
  readonly sub = input<Subclass | null | undefined>(null);
  /** The character's level in the class: its features up to it are shown first. */
  readonly level = input(1);

  private readonly i18n = useWizardTexts();
  private readonly opened = signal<ReadonlySet<Feature>>(new Set());

  protected readonly entry = computed(() => this.cls() ?? this.sub() ?? null);
  private readonly features = computed(() =>
    [...(this.entry()?.features ?? [])].sort((a, b) => a.level - b.level),
  );
  protected readonly now = computed(() => this.features().filter((f) => f.level <= this.level()));
  protected readonly later = computed(() => this.features().filter((f) => f.level > this.level()));

  /** "INT 13", "STR 13 or DEX 13"... */
  protected readonly multiclass = computed(() => {
    const groups = this.cls()?.multiclass.prerequisites ?? [];
    return groups
      .map((g) =>
        g.anyOf
          .map((a) => `${this.i18n.t(`abbr.${a}` as never)} ${g.min}`)
          .reduce((a, b) => this.i18n.t('wizard.info.or' as never, { a, b })),
      )
      .join(', ');
  });

  protected abbrs(list: readonly string[]): string {
    return list.map((a) => this.i18n.t(`abbr.${a}` as never)).join(', ');
  }

  protected skills(list: readonly string[]): string {
    return list.map((s) => this.i18n.t(`skill.${s}` as never)).join(', ');
  }

  protected isOpen(f: Feature): boolean {
    return this.opened().has(f);
  }

  /** The text of a feature is only rendered once it's unfolded (classes have dozens). */
  protected toggled(f: Feature, e: Event): void {
    const open = (e.target as HTMLDetailsElement).open;
    this.opened.update((s) => {
      const next = new Set(s);
      if (open) next.add(f);
      else next.delete(f);
      return next;
    });
  }
}
