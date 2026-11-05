import { term } from '../i18n/glossary';
import { DataTextService } from '../i18n/data-text.service';
import { I18nService } from '../i18n/i18n.service';
import { Item } from '../models/compendium';

/**
 * One line to choose the base of a magic weapon or armor:
 * "Cota de mallas · pesada · CA 16 · Sigilo con desventaja",
 * "Arco largo · 1d8 perforante · Alcance 150/600 · usa Des".
 */
export function baseLabel(b: Item, i18n: I18nService, data: DataTextService): string {
  return [data.name(b.name), baseSummary(b, i18n)].filter(Boolean).join(' · ');
}

/** The label without the name, for a line under the selector: "medium · AC 15 · Stealth...". */
export function baseSummary(b: Item, i18n: I18nService): string {
  const lang = i18n.language();
  const parts: string[] = [];
  if (b.armor) {
    if (b.armor.kind !== 'shield') parts.push(term(lang, 'armor', b.armor.kind));
    parts.push(i18n.t('gear.ac', { ac: b.armor.baseAC ?? 0 }));
    if (b.armor.stealthDisadvantage) parts.push(i18n.t('gear.stealth'));
  } else if (b.weapon) {
    const w = b.weapon;
    const d = w.damage[0];
    if (d) parts.push(`${d.dice} ${term(lang, 'damage', d.type)}`);
    parts.push(w.range ? i18n.t('gear.range', { r: w.range }) : i18n.t('gear.reach'));
    const finesse = w.properties.some((x) => /^finesse/i.test(x));
    parts.push(
      i18n.t(finesse ? 'gear.abilityFinesse' : w.ranged ? 'gear.abilityDex' : 'gear.abilityStr'),
    );
  }
  return parts.join(' · ');
}
