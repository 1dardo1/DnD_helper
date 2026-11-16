/**
 * UI texts of the folders with a password (character list), in English. Like browse.en.ts, they
 * travel with the page that uses them (I18nService.extend); folders.es.ts has the same keys.
 */
export const foldersEn = {
  'folderLock.locked': 'Locked folder',
  'folderLock.unlock': 'Unlock',
  'folderLock.relock': 'Lock',
  'folderLock.set': 'Set password',
  'folderLock.change': 'Change password',
  'folderLock.remove': 'Remove password',
  'folderLock.hidden': 'Enter the password to see the characters in this folder.',
  'folderLock.title.unlock': 'Unlock «{folder}»',
  'folderLock.title.set': 'Password for «{folder}»',
  'folderLock.title.change': 'New password for «{folder}»',
  'folderLock.title.remove': 'Remove the password of «{folder}»',
  'folderLock.password': 'Password',
  'folderLock.repeat': 'Repeat the password',
  'folderLock.explain':
    'The characters in this folder will be saved encrypted in your repository: without the password nobody can read them, in the app or on GitHub. If you forget it, they cannot be recovered.',
  'folderLock.explainRemove':
    'The characters in this folder will be saved unencrypted again. Enter the current password to confirm.',
  'folderLock.tooShort': 'At least {n} characters.',
  'folderLock.mismatch': 'The two passwords are different.',
  'folderLock.wrong': 'Wrong password.',
  'folderLock.working': 'Working…',
  'folderLock.ok': 'Accept',
  'folderLock.cancel': 'Cancel',
  'folderLock.lockedOption': '{folder} (locked)',
};

export type FoldersKey = keyof typeof foldersEn;
