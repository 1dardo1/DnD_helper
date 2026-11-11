/**
 * Texts of the step-by-step creation wizard and the level up (progress, step headers, footer,
 * live summary, hit points), in English. They live in the wizard's own chunk (loaded the first
 * time the wizard opens, I18nService.extend) instead of the first load of the app; wizard.es.ts
 * has the same keys. Notes of review() that only the wizard shows are here too.
 */
export const wizardEn = {
  'wizard.stepOf': 'Step {n} of {total}',
  'wizard.steps': 'Steps',
  'wizard.stepsAria': 'Steps of the creation',
  'wizard.progress': '{done} of {total} steps done',
  'wizard.state.todo': 'To do',
  'wizard.state.todoN': '{n} to choose',
  'wizard.state.warn': 'Has warnings',
  'wizard.state.done': 'Done',
  'wizard.state.optional': 'Optional',
  'wizard.state.current': 'you are here',
  'wizard.back': 'Back',
  'wizard.next': 'Next',
  'wizard.skip': 'Skip',
  'wizard.then': 'then: {step}',
  'wizard.ready': 'Step done',
  'wizard.toChoose': '{n} to choose',
  'wizard.warnings': '{n} warning(s)',
  'wizard.missingTitle': 'Still to do in this step',
  'wizard.missingHint': 'You can go on and come back later: nothing chosen is lost.',
  'wizard.optionalHint': 'Optional: you can skip it and fill it in later on the sheet.',
  'wizard.create': 'Create character',
  'wizard.saveChanges': 'Save changes',
  'wizard.saveLevelUp': 'Save level up',
  'wizard.why': 'Why this step and how it works',
  'wizard.step.spells': 'Spells',
  'wizard.step.hp': 'Hit points',
  'wizard.step.detailsNew': 'Review and create',
  'wizard.step.detailsEdit': 'Review and save',

  'wizard.lead.class':
    'Your class is your adventuring trade: it sets your hit points, the weapons and armor you can use, your saving throws and whether you cast spells. Choose the level you start at; add another class only if you multiclass.',
  'wizard.why.class':
    'It comes first because almost everything depends on it: which ability scores matter most, which skills you can pick and your starting equipment. Most classes choose their subclass at level 3.',
  'wizard.lead.background':
    'Your background is what you did before adventuring. It gives you an origin feat, two skills, a tool, equipment and +3 to share among three ability scores.',
  'wizard.why.background':
    'The background bonus is +2 to one and +1 to another of its three ability scores (or +1 to all three). It is added to the scores you set in the Ability Scores step: it usually goes to your class’s main ability ({primary}).',
  'wizard.lead.species':
    'Your species gives you traits from birth: size, speed, senses such as darkvision, resistances and sometimes spells or a feat. You also choose two languages besides Common here.',
  'wizard.why.species':
    'In the 2024 rules the species no longer raises ability scores (the background does), so you can choose it for its traits and for the character you imagine.',
  'wizard.lead.abilities':
    'Strength, Dexterity, Constitution, Intelligence, Wisdom and Charisma: each one gives a modifier added to your rolls. Set the base scores here; the background bonus is already added in the total.',
  'wizard.why.abilities':
    'It comes after class and background so you know your main ability and where the bonus went. Choose a method: the standard array (six fixed values), point buy (27 points, each value has a cost) or writing them in if your DM lets you roll.',
  'wizard.lead.hp':
    'Your maximum hit points: the hit die of each class level plus your Constitution modifier on every level. Choose for each level how to get it: roll the die, take the average or write a value.',
  'wizard.why.hp':
    'It comes after the ability scores because Constitution counts on every level. By the rule, level 1 of your first class gives the die’s maximum; the rest, the roll or the average your table uses.',
  'wizard.lead.choices':
    'What your class lets you choose: skills, expertise, weapon mastery, tools, the feats of your levels and class options (invocations, maneuvers, plans...).',
  'wizard.why.choices':
    'It comes after the ability scores because some feats and options require them (STR 13...). Proficiencies you already have from your background or species are marked.',
  'wizard.lead.spells':
    'Cantrips are cast at will; prepared spells use spell slots. Each class has its own count, from its table at its level.',
  'wizard.why.spells':
    'Only the spells of your list up to the slot level you reach are shown. Spells from your species or feats are already on the sheet and don’t count here.',
  'wizard.lead.equipment':
    'Choose the starting package of your class and of your background (or take the gold and buy in the shop), and which armor you wear.',
  'wizard.why.equipment':
    'It is optional: you can skip it and write your equipment later on the sheet. Armor and shield change your AC in the summary.',
  'wizard.lead.details':
    'Check the sheet as it will be, give it a name and save it. Anything missing is listed below: tap it to go and solve it.',
  'wizard.why.details':
    'You can create the character even if something is missing and finish it later by editing it; the warnings stay on the sheet.',
  'wizard.lead.levelUp':
    'Choose only what the new level brings. The summary shows the sheet before and after.',

  'wizard.summary': 'Your character',
  'wizard.summary.open': 'Show the summary',
  'wizard.summary.unnamed': 'Unnamed',
  'wizard.summary.noClass': 'No class yet',
  'wizard.summary.pending': 'to do',
  'wizard.summary.goTo': 'Go to {step}',
  'wizard.summary.unset': 'not set yet',
  'wizard.summary.abilitiesUnset': 'Set in the Ability Scores step.',
  'wizard.summary.combat': 'Combat',
  'wizard.summary.hpDice': '{dice} from dice + {con} CON',
  'wizard.summary.hpOther': ' + {n} other',
  'wizard.summary.feats': 'Feats',
  'wizard.summary.from.background': 'background',
  'wizard.summary.from.species': 'species',
  'wizard.summary.from.class': '{cls} {level}',
  'wizard.summary.none': 'none yet',
  'wizard.summary.spellsOf': '{cls}: {cantrips} cantrips · {prepared} prepared',
  'wizard.summary.spellDc': 'DC {dc}, attack {attack}',
  'wizard.summary.items': '{n} items',
  'wizard.summary.noItems': 'No equipment yet (optional)',
  'wizard.summary.attacksNone': 'No weapons yet',
  'wizard.summary.hpShort': 'HP',
  'wizard.summary.acShort': 'AC',
  'wizard.summary.pb': 'Prof. bonus',
  'wizard.summary.ft': 'ft',
  'wizard.summary.speedFt': '{n} ft',
  'wizard.summary.expertise': 'expertise',

  'wizard.review.pending': 'Still to do',
  'wizard.review.allDone': 'Everything is chosen: your character is ready.',
  'wizard.review.goTo': 'go there',
  'wizard.review.identity': 'Name and folder',
  'wizard.review.folder': 'Folder (optional)',
  'wizard.review.folderHint': 'To group it in the list of characters.',
  'wizard.review.sheet': 'The sheet as it will be',

  'wizard.info.atLevel': 'Up to your level {level}',
  'wizard.info.later': 'Later levels',
  'wizard.info.features': 'Features by level',
  'wizard.info.proficiencies': 'Proficiencies',
  'wizard.info.hitDie': 'Hit die',
  'wizard.info.hpFirst': 'Hit points at level 1: {die} + CON',
  'wizard.info.skillsChoose': 'Skills: choose {n} of {list}',
  'wizard.info.multiclass': 'To multiclass into it: {what}',
  'wizard.info.primary': 'Main ability',
  'wizard.info.casterYes': 'Spellcasting',
  'wizard.info.description': 'Description',
  'wizard.info.featText': 'What the feat {feat} does',
  'wizard.info.subclassFeatures': 'What it gives',
  'wizard.info.or': '{a} or {b}',
  'wizard.info.prerequisite': 'Prerequisite',

  'wizard.bg.hint': 'Your class’s main ability is {primary}: it is usually where the +2 goes.',
  'wizard.bg.youGet': 'What this background gives you',
  'wizard.ab.methodHelp.standard': 'Assign 15, 14, 13, 12, 10 and 8, one to each ability.',
  'wizard.ab.methodHelp.point-buy':
    'Everything starts at 8 and you have 27 points: 9 = 1, 10 = 2, 11 = 3, 12 = 4, 13 = 5, 14 = 7, 15 = 9.',
  'wizard.ab.methodHelp.manual':
    'Write the values you rolled (usually 4d6, dropping the lowest die).',
  'wizard.ab.base': 'Base',
  'wizard.ab.bonus': 'Bonus',
  'wizard.ab.total': 'Total',
  'wizard.ab.primary': 'main ability of {cls}',
  'wizard.ab.multiclassNeed': '{cls} needs {min}',
  'wizard.ab.bonusFrom': 'background',
  'wizard.ab.left': '{n} points left',

  'wizard.hp.total': 'Maximum hit points',
  'wizard.hp.formula': '{dice} (dice) {con} (Constitution × {levels}){other} = {total}',
  'wizard.hp.other': ' + {n} (feats and traits)',
  'wizard.hp.all': 'For every level at once',
  'wizard.hp.rollAll': '🎲 Roll every level',
  'wizard.hp.averageAll': 'Average on every level',
  'wizard.hp.writeTotal': 'Write the total by hand',
  'wizard.hp.totalLabel': 'The maximum you want',
  'wizard.hp.spread': 'Spread over the levels',
  'wizard.hp.spreadHint':
    'It is spread over the levels as fixed values (as even as the dice allow); level 1 keeps the maximum of the rule.',
  'wizard.hp.spreadOff': 'The dice don’t reach exactly: it stays at {got} ({off}).',
  'wizard.hp.firstRule': 'Standard rule: level 1 of your first class gives the maximum of the die.',
  'wizard.hp.firstMax': 'Maximum of the die ({die}) — standard rule',
  'wizard.hp.houseRule': 'house rule',
  'wizard.hp.firstNotRolled': 'Not rolled: the maximum ({die}) counts meanwhile.',
  'wizard.hp.ofClass': '{cls} (d{die})',
  'wizard.hp.noClass': 'Choose a class first: the hit points come from its hit die.',

  'wizard.choices.inStep': 'In this step',
  'wizard.mastery.property': 'mastery: {m}',

  'create.missing.cantrips': '{cls}: choose {count} more cantrip(s).',
  'create.missing.spells': '{cls}: choose {count} more prepared spell(s).',
  'create.missing.hpRoll': '{cls} level {level}: roll the hit die (not rolled yet).',
};
