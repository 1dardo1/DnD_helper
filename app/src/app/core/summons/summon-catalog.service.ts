import { Injectable, inject } from '@angular/core';

import { CompendiumService } from '../compendium/compendium.service';
import { SummonCatalog, buildCatalog } from './catalog';

/** The summon catalog (the stat blocks of the spells read once), built from the compendium. */
@Injectable({ providedIn: 'root' })
export class SummonCatalogService {
  private readonly compendium = inject(CompendiumService);
  private catalog?: Promise<SummonCatalog>;

  load(): Promise<SummonCatalog> {
    this.catalog ??= Promise.all([this.compendium.all('spell'), this.compendium.all('monster')])
      .then(([spells, monsters]) => buildCatalog(spells, monsters))
      .catch((e) => {
        this.catalog = undefined;
        throw e;
      });
    return this.catalog;
  }
}
