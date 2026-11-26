import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { MAX_QUESTION_CHARS, SOURCES_SHOWN } from '../../core/assistant/assistant.config';
import { AssistantService } from '../../core/assistant/assistant.service';
import {
  AssistantAnswer,
  AssistantError,
  Lang,
  RetrievalHit,
  parseHitId,
} from '../../core/assistant/ports';
import { assistantEn } from '../../core/i18n/assistant.en';
import { assistantEs } from '../../core/i18n/assistant.es';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { LoadError } from '../compendium/load-error';

const ASSISTANT_TEXTS = { en: assistantEn, es: assistantEs };
const EXAMPLES = ['assistant.example1', 'assistant.example2', 'assistant.example3'] as const;

type Phase = 'idle' | 'searching' | 'answering' | 'done';

/** A piece of the answer: plain text, or a "[spell:fireball]" mark turned into a numbered link. */
interface Segment {
  text?: string;
  cite?: { n: number; hit: RetrievalHit };
}

/**
 * Rules assistant: retrieves the compendium entries closest to a question (in the browser) and,
 * when an AI service is configured, shows an answer written from them with links to the entries.
 * Without the service it still lists the entries: that is the "search only" mode.
 */
@Component({
  selector: 'app-assistant-page',
  imports: [FormsModule, RouterLink, TranslatePipe, LoadError],
  template: `
    <h1>{{ 'assistant.title' | t }}</h1>
    <p class="intro">{{ 'assistant.intro' | t }}</p>

    <form class="ask" role="search" (ngSubmit)="ask()">
      <label for="assistant-q">{{ 'assistant.question' | t }}</label>
      <textarea
        id="assistant-q"
        name="question"
        rows="2"
        [maxLength]="maxChars"
        [placeholder]="'assistant.placeholder' | t"
        [(ngModel)]="question"
        (keydown.enter)="onEnter($event)"
      ></textarea>
      <div class="row">
        <button type="submit" class="primary" [disabled]="busy() || !question.trim()">
          {{ 'assistant.ask' | t }}
        </button>
        <span class="muted counter">{{ question.length }}/{{ maxChars }}</span>
      </div>
    </form>

    @if (phase() === 'idle') {
      <p class="examples">
        <span class="muted">{{ 'assistant.examples' | t }}</span>
        @for (key of examples; track key) {
          <button type="button" class="example btn-ghost" (click)="useExample(key)">
            {{ key | t }}
          </button>
        }
      </p>
    }

    @if (searchError()) {
      <app-load-error [error]="searchError()" [retryable]="true" (retry)="ask()" />
    }

    @if (phase() === 'searching') {
      <p role="status">{{ 'assistant.searching' | t }}</p>
    }

    @if (phase() === 'answering') {
      <p role="status">{{ 'assistant.answering' | t }}</p>
    }

    @if (answer(); as a) {
      <section class="answer card" aria-labelledby="answer-title">
        <h2 id="answer-title">{{ 'assistant.answerTitle' | t }}</h2>
        <p class="text">
          @for (s of segments(); track $index) {
            @if (s.cite; as c) {
              <a
                class="cite"
                [routerLink]="link(c.hit)"
                [title]="c.hit.title"
                [attr.aria-label]="c.hit.title"
                >{{ c.n }}</a
              >
            } @else {
              <span>{{ s.text }}</span>
            }
          }
        </p>
        @if (citedHits().length) {
          <p class="chips">
            @for (h of citedHits(); track h.id) {
              <a class="chip" [routerLink]="link(h)">{{ h.title }}</a>
            }
          </p>
        }
        <p class="disclaimer">
          <small class="muted">
            {{ 'assistant.disclaimer' | t }}
            @if (a.model) {
              · {{ 'assistant.model' | t: { model: a.model } }}
            }
          </small>
        </p>
      </section>
    }

    @if (notice(); as n) {
      <section class="notice sticky" role="status">
        <p>{{ n.key | t }}</p>
        @if (n.setUp) {
          <p>
            <a routerLink="/settings">{{ 'assistant.setUp' | t }}</a>
          </p>
        }
        @if (n.retry) {
          <button type="button" (click)="regenerate()" [disabled]="busy()">
            {{ 'assistant.retry' | t }}
          </button>
        }
      </section>
    }

    @if (phase() === 'done' && !searchError()) {
      <section aria-labelledby="sources-title">
        <h2 id="sources-title">{{ 'assistant.sources' | t }}</h2>
        @if (hits().length) {
          <p class="muted">
            <small>{{ 'assistant.sourcesHelp' | t }}</small>
          </p>
          <ol class="sources">
            @for (h of hits(); track h.id) {
              <li [class.is-cited]="isCited(h)">
                <div class="head">
                  <a class="name" [routerLink]="link(h)">{{ h.title }}</a>
                  <span class="chip kind">{{ 'assistant.type.' + h.type | t }}</span>
                  @if (isCited(h)) {
                    <span class="chip cited">{{ 'assistant.cited' | t }}</span>
                  }
                </div>
                <p class="snippet">{{ h.snippet }}</p>
              </li>
            }
          </ol>
        } @else {
          <p>{{ 'assistant.noResults' | t }}</p>
        }
      </section>
    }
  `,
  styles: `
    .intro {
      max-width: 42rem;
    }
    .ask {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      max-width: 42rem;
    }
    textarea {
      width: 100%;
      resize: vertical;
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
    .counter {
      font-size: var(--fs-sm);
      margin-left: auto;
    }
    .examples {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
    }
    .example {
      text-align: left;
      font-size: var(--fs-sm);
      border-color: var(--line);
      box-shadow: none;
    }
    .answer {
      max-width: 46rem;
      margin-block: var(--space-4);
    }
    .answer h2 {
      margin-top: 0;
    }
    .text {
      white-space: pre-wrap;
    }
    .cite {
      display: inline-block;
      min-width: 1.4em;
      margin-inline: 0.1em;
      padding: 0 0.3em;
      font-size: 0.8em;
      font-family: var(--font-title);
      text-align: center;
      text-decoration: none;
      vertical-align: super;
      line-height: 1.3;
      color: var(--wax);
      border: 1px solid currentColor;
      border-radius: 0.6em;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .chips .chip {
      text-decoration: none;
      white-space: normal;
    }
    .notice {
      max-width: 46rem;
    }
    .sources {
      max-width: 46rem;
      padding: 0;
      list-style: none;
    }
    .sources li {
      margin: 0;
      padding: var(--space-2) 0.25rem;
      border-bottom: 1px dashed var(--line);
    }
    .sources .head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.25rem var(--space-2);
    }
    .sources .name {
      font-weight: 600;
    }
    .sources .kind {
      --stamp: var(--ink-soft);
    }
    .sources .cited {
      --stamp: var(--wax);
    }
    .snippet {
      margin: 0.2rem 0 0;
      font-size: var(--fs-sm);
      color: var(--ink-soft);
    }
    .is-cited .name {
      color: var(--wax);
    }
  `,
})
export class AssistantPage {
  private readonly assistant = inject(AssistantService);
  private readonly i18n = inject(I18nService);

  protected readonly maxChars = MAX_QUESTION_CHARS;
  protected readonly examples = EXAMPLES;
  protected question = '';

  protected readonly phase = signal<Phase>('idle');
  protected readonly hits = signal<RetrievalHit[]>([]);
  protected readonly answer = signal<AssistantAnswer | null>(null);
  protected readonly answerError = signal<AssistantError | null>(null);
  protected readonly searchError = signal<unknown>(null);

  protected readonly busy = computed(
    () => this.phase() === 'searching' || this.phase() === 'answering',
  );

  /** The note above the sources: why there's no answer (search-only mode, or what failed). */
  protected readonly notice = computed(() => {
    if (this.phase() !== 'done' || this.searchError() || !this.hits().length) return null;
    if (!this.assistant.aiEnabled()) return { key: 'assistant.searchOnly', setUp: true };
    const e = this.answerError();
    if (!e) return null;
    const known = [
      'network',
      'timeout',
      'rate_limited',
      'upstream_error',
      'bad_request',
      'too_large',
      'forbidden',
    ];
    return {
      key: `assistant.error.${known.includes(e.kind) ? e.kind : 'other'}`,
      retry: e.retryable || e.kind === 'forbidden' || e.kind === 'http_error',
    } as { key: string; setUp?: boolean; retry?: boolean };
  });

  protected readonly citedHits = computed(() => {
    const byId = new Map(this.hits().map((h) => [h.id, h]));
    return (this.answer()?.citations ?? []).flatMap((id) => byId.get(id) ?? []);
  });

  /** The answer with its "[id]" marks as numbered links (numbers follow the cited list). */
  protected readonly segments = computed<Segment[]>(() => {
    const a = this.answer();
    if (!a) return [];
    const byId = new Map(this.hits().map((h) => [h.id, h]));
    const numbers = new Map(this.citedHits().map((h, i) => [h.id, i + 1]));
    const out: Segment[] = [];
    let last = 0;
    for (const m of a.answer.matchAll(/\[([^\s[\]]+)\]/g)) {
      const hit = byId.get(m[1]);
      if (!hit) continue;
      if (m.index > last) out.push({ text: a.answer.slice(last, m.index) });
      if (!numbers.has(hit.id)) numbers.set(hit.id, numbers.size + 1);
      out.push({ cite: { n: numbers.get(hit.id)!, hit } });
      last = m.index + m[0].length;
    }
    if (last < a.answer.length) out.push({ text: a.answer.slice(last) });
    return out;
  });

  /** Every request gets a number; an answer to an older one is ignored. */
  private seq = 0;

  constructor() {
    this.i18n.extend(ASSISTANT_TEXTS);
  }

  protected isCited(h: RetrievalHit): boolean {
    return this.citedHits().some((c) => c.id === h.id);
  }

  protected link(h: RetrievalHit): string[] {
    const p = parseHitId(h.id);
    return ['/compendium', p?.type ?? h.type, p?.entryId ?? h.id];
  }

  protected useExample(key: (typeof EXAMPLES)[number]): void {
    this.question = this.i18n.t(key as never);
    void this.ask();
  }

  /** Enter asks; Shift+Enter makes a new line. */
  protected onEnter(event: Event): void {
    const e = event as KeyboardEvent;
    if (e.shiftKey || e.isComposing) return;
    e.preventDefault();
    void this.ask();
  }

  protected async ask(): Promise<void> {
    const question = this.question.trim();
    if (!question || this.busy()) return;
    const id = ++this.seq;
    const lang = this.i18n.language() as Lang;
    this.phase.set('searching');
    this.hits.set([]);
    this.answer.set(null);
    this.answerError.set(null);
    this.searchError.set(null);
    try {
      const hits = await this.assistant.search(question, lang);
      if (id !== this.seq) return;
      this.hits.set(hits.slice(0, SOURCES_SHOWN));
    } catch (e) {
      if (id !== this.seq) return;
      this.searchError.set(e);
      this.phase.set('done');
      return;
    }
    await this.generate(id, question, lang);
  }

  /** Asks the AI service again with the same entries (after a network error, a rate limit...). */
  protected async regenerate(): Promise<void> {
    const question = this.question.trim();
    if (!question || this.busy() || !this.hits().length) return;
    const id = ++this.seq;
    this.answerError.set(null);
    await this.generate(id, question, this.i18n.language() as Lang);
  }

  private async generate(id: number, question: string, lang: Lang): Promise<void> {
    if (!this.assistant.aiEnabled() || !this.hits().length) {
      this.phase.set('done');
      return;
    }
    this.phase.set('answering');
    try {
      const answer = await this.assistant.answer(question, lang, this.hits());
      if (id !== this.seq) return;
      this.answer.set(answer);
    } catch (e) {
      if (id !== this.seq) return;
      this.answerError.set(e instanceof AssistantError ? e : new AssistantError('network'));
    }
    this.phase.set('done');
  }
}
