import { sheetEn } from './sheet.en';

/** Textos de la hoja de personaje en español (mismas claves que sheet.en.ts). */
export const sheetEs: Record<keyof typeof sheetEn, string> = {
  'sheetx.fix': 'Corregir',
  'sheetx.fixHere': 'Ver dónde',
  'sheetx.notes.saving': 'Guardando…',
  'sheetx.notes.saved': 'Guardado',
  'sheetx.notes.pending': 'Se guardará en un momento…',
  'sheetx.notes.hint': 'Se guardan solas mientras escribes.',
  'sheetx.filter.features': 'Buscar rasgo',
  'sheetx.filter.spells': 'Buscar conjuro',
  'sheetx.filter.items': 'Buscar en el inventario',
  'sheetx.filter.clear': 'Borrar la búsqueda',
  'sheetx.filter.none': 'Nada coincide con «{q}».',
  'sheetx.openAll': 'Abrir todos',
  'sheetx.closeAll': 'Cerrar todos',
  'sheetx.jump': 'Ir a',
  'sheetx.removed': '«{name}» quitado.',
  'sheetx.undo': 'Deshacer',
  'sheetx.bar.amount': 'Puntos de golpe que quitar o sumar',
  'sheetx.bar.conditions': 'Estados activos (se cambian en Resumen)',
  'sheetx.spell.concShort': 'C',
  'sheetx.spell.ritualShort': 'R',
  'sheetx.spell.concentration': 'Concentración',
  'sheetx.spell.ritual': 'Ritual',
};
