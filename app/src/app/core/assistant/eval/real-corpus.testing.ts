import backgroundsEn from '../../../../../../data/backgrounds.json';
import classesEn from '../../../../../../data/classes.json';
import featsEn from '../../../../../../data/feats.json';
import itemsEn from '../../../../../../data/items.json';
import monstersEn from '../../../../../../data/monsters.json';
import optionsEn from '../../../../../../data/options.json';
import rulesEn from '../../../../../../data/rules.json';
import speciesEn from '../../../../../../data/species.json';
import spellsEn from '../../../../../../data/spells.json';
import subclassesEn from '../../../../../../data/subclasses.json';
import backgroundsEs from '../../../../../../data/es/backgrounds.json';
import classesEs from '../../../../../../data/es/classes.json';
import featsEs from '../../../../../../data/es/feats.json';
import itemsEs from '../../../../../../data/es/items.json';
import monstersEs from '../../../../../../data/es/monsters.json';
import optionsEs from '../../../../../../data/es/options.json';
import rulesEs from '../../../../../../data/es/rules.json';
import speciesEs from '../../../../../../data/es/species.json';
import spellsEs from '../../../../../../data/es/spells.json';
import subclassesEs from '../../../../../../data/es/subclasses.json';
import { Entry } from '../../models/compendium';
import { EntriesByType, buildCorpus } from '../corpus';
import { CorpusDoc } from '../entry-document';
import { Lang } from '../ports';

/**
 * The real compendium (data/*.json and data/es/*.json) as the assistant's corpus. Only specs
 * import this file.
 */
const as = (x: unknown) => x as Entry[];

const EN: EntriesByType = {
  class: as(classesEn),
  subclass: as(subclassesEn),
  option: as(optionsEn),
  spell: as(spellsEn),
  feat: as(featsEn),
  species: as(speciesEn),
  background: as(backgroundsEn),
  item: as(itemsEn),
  rule: as(rulesEn),
  monster: as(monstersEn),
};

const ES: EntriesByType = {
  class: as(classesEs),
  subclass: as(subclassesEs),
  option: as(optionsEs),
  spell: as(spellsEs),
  feat: as(featsEs),
  species: as(speciesEs),
  background: as(backgroundsEs),
  item: as(itemsEs),
  rule: as(rulesEs),
  monster: as(monstersEs),
};

const cache = new Map<Lang, CorpusDoc[]>();

export function realCorpus(lang: Lang): Promise<CorpusDoc[]> {
  let docs = cache.get(lang);
  if (!docs) cache.set(lang, (docs = buildCorpus(lang, EN, lang === 'es' ? ES : {})));
  return Promise.resolve(docs);
}
