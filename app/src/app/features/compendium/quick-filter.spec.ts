import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Entry } from '../../core/models/compendium';
import { facetOptionsFor } from '../../shared/picker/entry-facets';
import { FacetView } from '../../shared/picker/filter-bar';
import { QUICK_FACET, quickStrip, quickToggle } from './quick-filter';

const root = join(process.cwd(), '..');
const read = (f: string): Entry[] => JSON.parse(readFileSync(join(root, 'data', f), 'utf8'));

/** The facet as the list builds it, with the raw values as labels. */
function view(entries: Entry[], key: string, selected = ''): FacetView {
  return {
    key,
    label: key,
    options: facetOptionsFor(entries, key as never, (v) => v),
    selected,
    mode: 'or',
    canCombine: false,
    canExclude: true,
  };
}

describe('quick filter strip', () => {
  const spells = read('spells.json');
  const monsters = read('monsters.json');

  it('offers the spell levels of the real data, cantrips first, as chips', () => {
    const strip = quickStrip('spell', [view(spells, 'level')])!;
    expect(strip.key).toBe('level');
    expect(strip.all).toBe(true);
    expect(strip.chips.map((c) => c.value)).toEqual(
      ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].filter((l) =>
        spells.some((s) => String((s as unknown as { level: number }).level) === l),
      ),
    );
    expect(strip.chips.every((c) => !c.on)).toBe(true);
  });

  it('presses the chip of the one value selected, and none when several are', () => {
    expect(quickStrip('spell', [view(spells, 'level', '3')])!.chips.find((c) => c.on)?.value).toBe(
      '3',
    );
    const several = quickStrip('spell', [view(spells, 'level', '3,4')])!;
    expect(several.all).toBe(false);
    expect(several.chips.some((c) => c.on)).toBe(false);
  });

  it('offers every challenge-rating band of the real monsters', () => {
    const facet = view(monsters, 'cr');
    const strip = quickStrip('monster', [facet]);
    expect(strip).not.toBeNull();
    expect(strip!.chips.map((c) => c.value)).toEqual(facet.options.map((o) => o.value));
    expect(strip!.chips.length).toBeGreaterThan(3);
  });

  it('has no strip for a type without a quick facet or when the facet is missing', () => {
    expect(QUICK_FACET.background).toBeUndefined();
    expect(quickStrip('background', [view(spells, 'level')])).toBeNull();
    expect(quickStrip('spell', [])).toBeNull();
  });

  it('tapping selects that value alone, and tapping it again clears it', () => {
    expect(quickToggle('', '3')).toBe('3');
    expect(quickToggle('3', '3')).toBe('');
    expect(quickToggle('3', '4')).toBe('4');
    expect(quickToggle('3,4', '3')).toBe('3');
    expect(quickToggle('!3', '3')).toBe('3');
  });
});
