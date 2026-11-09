import species from '../../../../../data/species.json';
import { traitChoice } from './trait-choices';

describe('options without flavor text', () => {
  it("Goblin of Zendikar's tribes show only what each gives, not its lore", () => {
    const goblin = (species as { id: string; variants: { name: string; traits: any[] }[] }[]).find(
      (s) => s.id === 'goblin',
    )!;
    const zendikar = goblin.variants.find((v) => /Zendikar/.test(v.name))!;
    const tribe = zendikar.traits.find((t) => t.name === 'Tribe')!;
    const options = traitChoice(tribe.description)!.options;
    expect(options.map((o) => o.name)).toEqual(['Grotag Tribe', 'Lavastep Tribe', 'Tuktuk Tribe']);
    expect(options[0].text).toBe(
      '**Grotag Tamer.** You have proficiency in the Animal Handling skill.',
    );
    for (const o of options) expect(o.text.length).toBeLessThan(200);
  });
});
