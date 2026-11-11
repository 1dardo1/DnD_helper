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
} as const;
