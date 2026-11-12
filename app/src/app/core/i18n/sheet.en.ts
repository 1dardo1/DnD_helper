/**
 * UI texts of the character sheet, in English. They travel with the sheet's own chunk (loaded
 * with its route, I18nService.extend) instead of the first load of the app; sheet.es.ts has the
 * same keys.
 */
export const sheetEn = {
  'sheetx.fix': 'Fix it',
  'sheetx.fixHere': 'Show me',
  'sheetx.notes.saving': 'Saving…',
  'sheetx.notes.saved': 'Saved',
  'sheetx.notes.pending': 'Saving in a moment…',
  'sheetx.notes.hint': 'Saved by itself as you type.',
  'sheetx.filter.features': 'Find a feature or trait',
  'sheetx.filter.spells': 'Find a spell',
  'sheetx.filter.items': 'Find in the inventory',
  'sheetx.filter.clear': 'Clear the search',
  'sheetx.filter.none': 'Nothing matches «{q}».',
  'sheetx.openAll': 'Open all',
  'sheetx.closeAll': 'Close all',
  'sheetx.jump': 'Go to',
  'sheetx.removed': '«{name}» removed.',
  'sheetx.undo': 'Undo',
  'sheetx.bar.amount': 'Hit points to take or give',
  'sheetx.bar.conditions': 'Active conditions (changed in the Summary)',
  'sheetx.spell.concShort': 'C',
  'sheetx.spell.ritualShort': 'R',
  'sheetx.spell.concentration': 'Concentration',
  'sheetx.spell.ritual': 'Ritual',
  'sheetx.conc.title': 'Concentrating on',
  'sheetx.conc.start': 'Concentrate',
  'sheetx.conc.active': 'Concentrating',
  'sheetx.conc.drop': 'Drop',
  'sheetx.conc.close': 'Close',
  'sheetx.conc.replaced': 'You stop concentrating on {old} to concentrate on {new}.',
  'sheetx.conc.check':
    '{damage} damage while concentrating on {spell}: Constitution saving throw, DC {dc} (10 or half the damage, whichever is higher).',
  'sheetx.conc.passed': 'Passed',
  'sheetx.conc.failed': 'Failed (concentration lost)',
  'sheetx.conc.lost.hp': 'You drop to 0 HP: your concentration on {spell} ends.',
  'sheetx.conc.lost.condition': 'Your condition breaks your concentration on {spell}.',
  'sheetx.conc.lost.rest': 'The rest ends your concentration on {spell}.',
} as const;
