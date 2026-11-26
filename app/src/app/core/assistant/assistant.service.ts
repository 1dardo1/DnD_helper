import { Injectable, computed, inject } from '@angular/core';

import { CompendiumService } from '../compendium/compendium.service';
import { ENTRY_TYPES, Entry, EntryType } from '../models/compendium';
import { SettingsService } from '../settings/settings.service';
import { ASSISTANT_URL, MAX_CONTEXTS, MAX_QUESTION_CHARS } from './assistant.config';
import { EntriesByType, buildCorpus } from './corpus';
import {
  HttpAnswerProvider,
  NoAiAnswerProvider,
  normaliseAssistantUrl,
} from './http-answer-provider';
import { LexicalRetriever } from './lexical-retriever';
import { AnswerContext, AnswerProvider, AssistantAnswer, Lang, RetrievalHit } from './ports';

/** What the page asks of the assistant: retrieval first (always), the generated answer after. */
@Injectable({ providedIn: 'root' })
export class AssistantService {
  private readonly compendium = inject(CompendiumService);
  private readonly settings = inject(SettingsService);

  private readonly retriever = new LexicalRetriever((lang) => this.loadCorpus(lang));

  /** The proxy's address: the one in Settings, else the one built into the app ('' = none). */
  readonly url = computed(
    () =>
      normaliseAssistantUrl(this.settings.settings().assistantUrl) ||
      normaliseAssistantUrl(ASSISTANT_URL),
  );
  /** False in "search only" mode. */
  readonly aiEnabled = computed(() => !!this.url());

  private provider(): AnswerProvider {
    const url = this.url();
    return url ? new HttpAnswerProvider(url) : new NoAiAnswerProvider();
  }

  /** The entries that best answer the question (builds the index on first use). */
  search(question: string, lang: Lang, k = MAX_CONTEXTS): Promise<RetrievalHit[]> {
    return this.retriever.search(question.slice(0, MAX_QUESTION_CHARS), lang, k);
  }

  /** The generated answer, from the entries found (throws AssistantError). */
  answer(
    question: string,
    lang: Lang,
    hits: RetrievalHit[],
    signal?: AbortSignal,
  ): Promise<AssistantAnswer> {
    const contexts: AnswerContext[] = hits.slice(0, MAX_CONTEXTS).map((h) => ({
      id: h.id,
      type: h.type,
      title: h.title,
      text: h.text,
    }));
    return this.provider().answer(question, lang, contexts, signal);
  }

  private async loadCorpus(lang: Lang) {
    const english: EntriesByType = {};
    const translated: EntriesByType = {};
    await Promise.all(
      ENTRY_TYPES.map(async (type: EntryType) => {
        english[type] = (await this.compendium.all(type)) as Entry[];
        if (lang === 'es') {
          // no translation yet (or offline without it): the English text is better than none
          translated[type] = await this.compendium
            .translated(type, lang)
            .then((x) => x as Entry[])
            .catch(() => []);
        }
      }),
    );
    return buildCorpus(lang, english, translated);
  }
}
