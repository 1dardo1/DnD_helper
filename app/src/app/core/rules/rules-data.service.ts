import { Injectable, inject } from '@angular/core';

import { CompendiumService } from '../compendium/compendium.service';
import { RulesData } from './engine';

/** Builds the engine's lookup tables from the compendium (loaded once, then from memory). */
@Injectable({ providedIn: 'root' })
export class RulesDataService {
  private readonly compendium = inject(CompendiumService);

  async load(): Promise<RulesData> {
    const [classes, subclasses, species, backgrounds, feats, items] = await Promise.all([
      this.compendium.all('class'),
      this.compendium.all('subclass'),
      this.compendium.all('species'),
      this.compendium.all('background'),
      this.compendium.all('feat'),
      this.compendium.all('item'),
    ]);
    const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));
    return {
      classes: byId(classes),
      subclasses: byId(subclasses),
      species: byId(species),
      backgrounds: byId(backgrounds),
      feats: byId(feats),
      items: byId(items),
    };
  }
}
