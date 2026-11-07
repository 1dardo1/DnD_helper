/**
 * Pure logic for organizing a list of items (characters, encounters...) into folders. Each item
 * carries its own folder name (or null/undefined for "no folder"); there's no separate folder
 * entity on the backend, so grouping, renaming and deleting are plain array transforms. Used by
 * character-list.ts and encounter-list.ts; the folders the user has created are kept separately
 * as a local preference (folder-prefs.ts) so an empty one doesn't disappear.
 */

export interface FolderGroup<T> {
  /** null = the "no folder" group. */
  folder: string | null;
  items: T[];
}

/**
 * Groups `items` by the folder `folderOf` reports for each, preserving each group's relative
 * order. `knownFolders` are included (even empty) and set the order of the named groups; a
 * folder found on an item but missing from `knownFolders` is appended after them. The "no
 * folder" group always comes last.
 */
export function groupByFolder<T>(
  items: readonly T[],
  folderOf: (item: T) => string | null | undefined,
  knownFolders: readonly string[] = [],
): FolderGroup<T>[] {
  const byFolder = new Map<string, T[]>();
  const noFolder: T[] = [];
  for (const item of items) {
    const folder = folderOf(item)?.trim();
    if (!folder) {
      noFolder.push(item);
      continue;
    }
    const list = byFolder.get(folder);
    if (list) list.push(item);
    else byFolder.set(folder, [item]);
  }
  const order = [...knownFolders];
  for (const folder of byFolder.keys()) {
    if (!order.includes(folder)) order.push(folder);
  }
  const groups: FolderGroup<T>[] = order.map((folder) => ({
    folder,
    items: byFolder.get(folder) ?? [],
  }));
  groups.push({ folder: null, items: noFolder });
  return groups;
}

/**
 * `items` with every one whose folder is `from` moved to `to` (everything else unchanged, same
 * length and order): used when a folder is renamed, so nothing in it is lost.
 */
export function renameFolderIn<T>(
  items: readonly T[],
  folderOf: (item: T) => string | null | undefined,
  setFolder: (item: T, folder: string | null) => T,
  from: string,
  to: string,
): T[] {
  return items.map((item) => (folderOf(item) === from ? setFolder(item, to) : item));
}

/**
 * `items` with every one whose folder is `folder` moved back to "no folder" (everything else
 * unchanged, same length and order): used when a folder is deleted, so its items come back to
 * the unfiled list rather than being removed.
 */
export function removeFolderFrom<T>(
  items: readonly T[],
  folderOf: (item: T) => string | null | undefined,
  setFolder: (item: T, folder: string | null) => T,
  folder: string,
): T[] {
  return items.map((item) => (folderOf(item) === folder ? setFolder(item, null) : item));
}
