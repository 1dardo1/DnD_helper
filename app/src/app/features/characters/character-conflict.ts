import { Component, inject, input, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CharacterStore } from '../../core/characters/character-store.service';
import { describeDifferences } from '../../core/characters/differences';
import { SyncService } from '../../core/characters/sync.service';
import { I18nService, LocalDatePipe, TranslatePipe } from '../../core/i18n/i18n.service';
import { RulesDataService } from '../../core/rules/rules-data.service';
import { LoadError } from '../compendium/load-error';

/**
 * Two versions of the same character side by side, showing only what differs in game terms,
 * and three plain choices: keep this one, keep the other one, or keep both.
 */
@Component({
  selector: 'app-character-conflict',
  imports: [RouterLink, TranslatePipe, LocalDatePipe, LoadError],
  templateUrl: './character-conflict.html',
  styleUrl: './character-conflict.scss',
})
export class CharacterConflict {
  /** Route parameter. */
  readonly id = input.required<string>();
  private readonly store = inject(CharacterStore);
  private readonly sync = inject(SyncService);
  private readonly rules = inject(RulesDataService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  protected readonly busy = signal(false);

  protected readonly view = resource({
    params: () => this.id(),
    loader: async ({ params }) => {
      const [record, data] = await Promise.all([this.store.get(params), this.rules.load()]);
      if (!record || record.status !== 'conflict' || !record.remote) return null;
      return {
        record,
        mine: record.character,
        theirs: record.remote,
        differences: describeDifferences(record.character, record.remote, data, (id) =>
          this.i18n.t(`skill.${id}` as never),
        ),
      };
    },
  });

  protected async keep(which: 'mine' | 'theirs' | 'both'): Promise<void> {
    this.busy.set(true);
    try {
      if (which === 'mine') await this.store.keepLocal(this.id());
      else if (which === 'theirs') await this.store.keepRemote(this.id());
      else await this.store.keepBoth(this.id(), this.i18n.t('conflict.copySuffix'));
      void this.sync.sync();
      await this.router.navigate(['/characters']);
    } finally {
      this.busy.set(false);
    }
  }
}
