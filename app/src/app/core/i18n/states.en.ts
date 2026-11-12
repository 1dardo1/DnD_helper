/**
 * UI texts of the active states (Rage, Hex...) and of Wild Shape, in English. They travel with
 * the chunks that show them (combat tab, summons tab, attacks table: I18nService.extend) instead
 * of the first load of the app; states.es.ts has the same keys.
 */
export const statesEn = {
  'state.title': 'Active states',
  'state.on': 'On',
  'state.off': 'Off',
  'state.activate': 'Switch on',
  'state.activateCost': 'Switch on (spends 1 · {left} left)',
  'state.noUses': 'No uses left',
  'state.end': 'End',
  'state.ended.heavyArmor': 'It has ended: you are wearing Heavy armor.',
  'state.ended.incapacitated': 'It has ended: you have the Incapacitated condition.',
  'state.ended.unconscious': 'It has ended: you have the Unconscious condition.',
  'state.fx.rage':
    '+{n} damage with Strength attacks (already added) · Resistance to Bludgeoning, Piercing and Slashing damage · Advantage on Strength checks and saving throws · no Concentration and no spells',
  'state.dur.rage':
    'Lasts until the end of your next turn; extend it by attacking an enemy, forcing an enemy to make a saving throw or with a Bonus Action (up to 10 minutes). Ends with Heavy armor or the Incapacitated condition.',
  'state.dur.ragePersistent':
    'Lasts 10 minutes without extending it; ends if you have the Unconscious condition or don Heavy armor.',
  'state.fx.hex':
    '+1d6 Necrotic damage to the cursed creature on every hit with an attack roll; it has Disadvantage on checks with the chosen ability',
  'state.fx.huntersMark':
    '+1{die} Force damage to the marked creature on every hit with an attack roll; Advantage on Wisdom (Perception or Survival) checks to find it',
  'state.dur.concentration': 'Concentration, up to 1 hour. A Short or Long Rest ends it.',
  'state.fx.innateSorcery':
    'Sorcerer spell save DC {dc} (+1, already added) · Advantage on the attack rolls of Sorcerer spells',
  'state.dur.innateSorcery': 'Lasts 1 minute.',
  'state.whileOff': 'only while it is on',
  'combat.note.rageOn': 'Rage: +{n} damage already added',
  'combat.note.lunarRadiance': 'Lunar Radiance: you can deal Radiant damage instead',
  'ws.title': 'Wild Shape',
  'ws.rules':
    '{known} known forms · max CR {cr} · {fly} · lasts {hours} h · {thp} Temporary HP when you shape-shift',
  'ws.fly.yes': 'Fly Speed allowed',
  'ws.fly.no': 'no Fly Speed',
  'ws.transform': 'Shape-shift',
  'ws.transformCost': 'Shape-shift (spends 1 · {left} left)',
  'ws.revert': 'Back to your normal form',
  'ws.pickForm': 'Form',
  'ws.noForms': "You don't know any form yet.",
  'ws.goForms': 'Choose forms',
  'ws.current': 'Current form: {name}',
  'ws.since': 'since {date} · lasts {hours} h',
  'ws.known': 'Known forms ({n}/{max})',
  'ws.knownHint':
    'Whenever you finish a Long Rest, you can replace one of your known forms with another eligible form.',
  'ws.choose': 'Choose forms',
  'ws.done': 'Done',
  'ws.search': 'Search a Beast',
  'ws.learn': 'Learn',
  'ws.forget': 'Forget',
  'ws.full': 'You already know {max} forms: forget one to learn another.',
  'ws.notAllowed': 'Not allowed at your level',
  'ws.sheet': 'Stat block',
  'ws.eligible': '{n} eligible Beasts',
  'ws.crShort': 'CR {cr}',
  'ws.acCircle': '13 + WIS (Circle Forms)',
  'ws.yourHp': 'Your HP',
  'ws.keeps': 'You keep',
  'ws.keepsText':
    'your creature type, Hit Points and Hit Point Dice, Intelligence, Wisdom and Charisma, class features, languages and feats, and your skill and saving throw proficiencies with your Proficiency Bonus (the Beast’s modifier when it is higher).',
  'ws.changes': 'It changes',
  'ws.changesText':
    'Strength, Dexterity and Constitution, AC, Speeds, size, senses and attacks become the Beast’s. The form’s limbs decide how you handle objects.',
  'ws.spells.none':
    'You can’t cast spells (shape-shifting doesn’t break your Concentration). Spell save DC {dc}.',
  'ws.spells.circle':
    'You can only cast your Circle of the Moon spells in this form. Spell save DC {dc}.',
  'ws.spells.all':
    'You can cast spells, except those with a costly or consumed Material component. Spell save DC {dc}.',
  'ws.fromBeast': 'from the Beast',
  'ws.attacks': 'Attacks of the form',
  'ws.toughness': '+WIS (Improved Circle Forms)',
} as const;
