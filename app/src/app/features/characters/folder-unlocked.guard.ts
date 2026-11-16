import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';

import { CharacterStore } from '../../core/characters/character-store.service';
import { FolderLockService } from '../../core/organize/folder-lock.service';

/**
 * A character in a folder with a password opens only once the folder's password has been entered
 * in this session; otherwise the list opens, asking for it. Call it in an injection context.
 */
export function folderUnlocked(route: ActivatedRouteSnapshot): Promise<boolean | UrlTree> {
  const store = inject(CharacterStore);
  const locks = inject(FolderLockService);
  const router = inject(Router);
  const id = route.paramMap.get('id');
  if (!id || id === 'new') return Promise.resolve(true);
  return store.get(id).then((r) => {
    const folder = r?.character.folder;
    if (!r || !locks.isLocked(folder)) return true;
    return router.createUrlTree(['/characters'], { queryParams: { unlock: folder } });
  });
}
