import species from '../../../../../data/species.json';
import { Species } from '../models/compendium';
import { resolveTraitChoice, traitChoice, traitChoiceKey } from './trait-choices';

const byId = new Map((species as Species[]).map((s) => [s.id, s]));

describe('traitChoice', () => {
  it("splits Gnome's Gnomish Lineage into Forest Gnome and Rock Gnome", () => {
    const gnome = byId.get('gnome')!;
    const trait = gnome.traits.find((t) => t.name === 'Gnomish Lineage')!;
    const split = traitChoice(trait.description)!;
    expect(split.options.map((o) => o.name)).toEqual(['Forest Gnome', 'Rock Gnome']);
    expect(split.preamble).toContain('Choose one of the following options');
    expect(split.options[0].text).toContain('Minor Illusion');
    expect(split.options[0].text).toContain('Speak with Animals');
    expect(split.options[1].text).toContain('Mending');
    expect(split.options[1].text).toContain('Prestidigitation');
    // neither option's text leaks into the other
    expect(split.options[0].text).not.toContain('Prestidigitation');
    expect(split.options[1].text).not.toContain('Speak with Animals');
  });

  it("splits the Zendikar Goblin's Tribe into its three tribes", () => {
    const goblin = byId.get('goblin')!;
    const variant = goblin.variants.find((v) => v.name === 'Goblin (Plane Shift: Zendikar)')!;
    const trait = variant.traits.find((t) => t.name === 'Tribe')!;
    const split = traitChoice(trait.description)!;
    expect(split.options.map((o) => o.name)).toEqual([
      'Grotag Tribe',
      'Lavastep Tribe',
      'Tuktuk Tribe',
    ]);
    expect(split.options[0].text).toContain('Animal Handling');
    expect(split.options[1].text).toContain('Dexterity (Stealth)');
    expect(split.options[2].text).toContain("thieves' tools");
    expect(split.options[0].text).not.toContain('Stealth');
  });

  it("splits Goliath's Giant Ancestry into its six benefits, keeping Large Form/Powerful Build as tail", () => {
    const goliath = byId.get('goliath')!;
    const trait = goliath.traits.find((t) => t.name === 'Giant Ancestry')!;
    const split = traitChoice(trait.description)!;
    expect(split.options.map((o) => o.name)).toEqual([
      "Cloud's Jaunt (Cloud Giant)",
      "Fire's Burn (Fire Giant)",
      "Frost's Chill (Frost Giant)",
      "Hill's Tumble (Hill Giant)",
      "Stone's Endurance (Stone Giant)",
      "Storm's Thunder (Storm Giant)",
    ]);
    expect(split.tail).toContain('Large Form');
    expect(split.tail).toContain('Powerful Build');
  });

  it('returns null for traits that only mention "choose" in passing, or for a re-pick each use', () => {
    const duskling = byId.get('duskling')!;
    const inner = duskling.traits.find((t) => t.name === 'Inner Magic')!;
    expect(traitChoice(inner.description)).toBeNull();
  });
});

describe('resolveTraitChoice', () => {
  const gnome = byId.get('gnome')!;
  const lineage = gnome.traits.find((t) => t.name === 'Gnomish Lineage')!;
  const key = traitChoiceKey('gnome', null, lineage.name);

  it('applies only the chosen option', () => {
    const forest = resolveTraitChoice(lineage, key, 'Forest Gnome');
    expect(forest.missing).toBe(false);
    expect(forest.text).toContain('Minor Illusion');
    expect(forest.text).not.toContain('Prestidigitation');

    const rock = resolveTraitChoice(lineage, key, 'Rock Gnome');
    expect(rock.missing).toBe(false);
    expect(rock.text).toContain('Prestidigitation');
    expect(rock.text).not.toContain('Minor Illusion');
  });

  it('applies nothing and reports missing when nothing is chosen', () => {
    const none = resolveTraitChoice(lineage, key, null);
    expect(none.missing).toBe(true);
    expect(none.text).not.toContain('Minor Illusion');
    expect(none.text).not.toContain('Prestidigitation');
  });

  it('leaves a trait not on the allowlist untouched, even if its text has the same shape', () => {
    const goliath = byId.get('goliath')!;
    const ancestry = goliath.traits.find((t) => t.name === 'Giant Ancestry')!;
    const unknownKey = traitChoiceKey('goliath', null, 'Not Giant Ancestry');
    const r = resolveTraitChoice(ancestry, unknownKey, null);
    expect(r.missing).toBe(false);
    expect(r.text).toBe(ancestry.description);
  });
});
