import { FoldersKey, foldersEn } from './folders.en';

/** Textos de las carpetas con contraseña (mismas claves que folders.en.ts). */
export const foldersEs: Record<FoldersKey, string> = {
  'folderLock.locked': 'Carpeta con contraseña',
  'folderLock.unlock': 'Desbloquear',
  'folderLock.relock': 'Bloquear',
  'folderLock.newWithPassword': 'Nueva carpeta con contraseña',
  'folderLock.hint':
    'Una carpeta puede tener contraseña: sus personajes se cifran, también en GitHub, y solo se abren con ella. Crea una carpeta (o pulsa «Poner contraseña» en una) para protegerla.',
  'folderLock.set': 'Poner contraseña',
  'folderLock.change': 'Cambiar contraseña',
  'folderLock.remove': 'Quitar contraseña',
  'folderLock.hidden': 'Escribe la contraseña para ver los personajes de esta carpeta.',
  'folderLock.title.unlock': 'Desbloquear «{folder}»',
  'folderLock.title.set': 'Contraseña de «{folder}»',
  'folderLock.title.change': 'Nueva contraseña de «{folder}»',
  'folderLock.title.remove': 'Quitar la contraseña de «{folder}»',
  'folderLock.password': 'Contraseña',
  'folderLock.repeat': 'Repite la contraseña',
  'folderLock.explain':
    'Los personajes de esta carpeta se guardarán cifrados en tu repositorio: sin la contraseña nadie puede leerlos, ni en la app ni en GitHub. Si la olvidas, no se pueden recuperar.',
  'folderLock.explainRemove':
    'Los personajes de esta carpeta volverán a guardarse sin cifrar. Escribe la contraseña actual para confirmarlo.',
  'folderLock.tooShort': 'Como mínimo {n} caracteres.',
  'folderLock.mismatch': 'Las dos contraseñas no coinciden.',
  'folderLock.wrong': 'Contraseña incorrecta.',
  'folderLock.working': 'Un momento…',
  'folderLock.ok': 'Aceptar',
  'folderLock.cancel': 'Cancelar',
  'folderLock.lockedOption': '{folder} (bloqueada)',
};

/** Para I18nService.extend() en las páginas que usan carpetas con contraseña. */
export const FOLDER_TEXTS = { en: foldersEn, es: foldersEs };
