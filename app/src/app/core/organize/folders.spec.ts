import { groupByFolder, knownFolderNames, removeFolderFrom, renameFolderIn } from './folders';

interface Item {
  id: string;
  folder?: string | null;
}

const item = (id: string, folder?: string | null): Item => ({ id, folder });
const folderOf = (i: Item) => i.folder;
const setFolder = (i: Item, folder: string | null): Item => ({ ...i, folder });
const names = (items: Item[]) => items.map((i) => i.id);

describe('groupByFolder', () => {
  it('puts everything without a folder in the null group, last', () => {
    const groups = groupByFolder([item('a'), item('b', null)], folderOf);
    expect(groups).toEqual([{ folder: null, items: [item('a'), item('b', null)] }]);
  });

  it('groups items under their folder name, in the order they appear', () => {
    const groups = groupByFolder(
      [item('a', 'Allies'), item('b'), item('c', 'Allies'), item('d', 'Foes')],
      folderOf,
    );
    expect(groups.map((g) => g.folder)).toEqual(['Allies', 'Foes', null]);
    expect(names(groups[0].items)).toEqual(['a', 'c']);
    expect(names(groups[1].items)).toEqual(['d']);
    expect(names(groups[2].items)).toEqual(['b']);
  });

  it('keeps known folders in order and shows them even when empty', () => {
    const groups = groupByFolder([item('a', 'Foes')], folderOf, ['Allies', 'Foes']);
    expect(groups.map((g) => g.folder)).toEqual(['Allies', 'Foes', null]);
    expect(groups[0].items).toEqual([]);
  });

  it('appends a folder found on an item but missing from the known list', () => {
    const groups = groupByFolder([item('a', 'Surprise')], folderOf, ['Allies']);
    expect(groups.map((g) => g.folder)).toEqual(['Allies', 'Surprise', null]);
  });

  it('treats a blank folder name the same as no folder', () => {
    const groups = groupByFolder([item('a', '   ')], folderOf);
    expect(groups).toEqual([{ folder: null, items: [item('a', '   ')] }]);
  });
});

describe('renameFolderIn', () => {
  it('moves only the matching items to the new name, losing none', () => {
    const before = [item('a', 'Allies'), item('b'), item('c', 'Allies'), item('d', 'Foes')];
    const after = renameFolderIn(before, folderOf, setFolder, 'Allies', 'Party');
    expect(after).toHaveLength(before.length);
    expect(after.map((i) => i.folder)).toEqual(['Party', undefined, 'Party', 'Foes']);
    expect(names(after)).toEqual(names(before));
  });

  it('changes nothing when no item has that folder', () => {
    const before = [item('a', 'Foes')];
    expect(renameFolderIn(before, folderOf, setFolder, 'Allies', 'Party')).toEqual(before);
  });
});

describe('removeFolderFrom', () => {
  it('sends the folder’s items back to "no folder" instead of dropping them', () => {
    const before = [item('a', 'Allies'), item('b'), item('c', 'Allies')];
    const after = removeFolderFrom(before, folderOf, setFolder, 'Allies');
    expect(after).toHaveLength(before.length);
    expect(after.map((i) => i.folder)).toEqual([null, undefined, null]);
    expect(names(after)).toEqual(names(before));
  });
});

describe('knownFolderNames', () => {
  it('lists the folders of the items on a device with no local folder names', () => {
    const items = [item('a', 'Allies'), item('b'), item('c', 'Foes'), item('d', 'Allies')];
    expect(knownFolderNames(items, folderOf)).toEqual(['Allies', 'Foes']);
  });

  it('still shows an empty local folder, before the items', () => {
    const items = [item('a', 'Foes')];
    expect(knownFolderNames(items, folderOf, ['Allies'])).toEqual(['Allies', 'Foes']);
  });

  it('never repeats a folder that is both local and on an item', () => {
    const items = [item('a', 'Allies'), item('b', 'Allies')];
    expect(knownFolderNames(items, folderOf, ['Allies', 'Allies'])).toEqual(['Allies']);
  });

  it('keeps local order first, then item folders in the order items first show them', () => {
    const items = [item('a', 'Zeta'), item('b', 'Alfa'), item('c', 'Zeta')];
    expect(knownFolderNames(items, folderOf, ['Foes', 'Allies'])).toEqual([
      'Foes',
      'Allies',
      'Zeta',
      'Alfa',
    ]);
  });

  it('never offers "no folder": null, undefined, empty or blank names are skipped', () => {
    const items = [item('a', ''), item('b', null), item('c'), item('d', '   ')];
    expect(knownFolderNames(items, folderOf, ['', '  '])).toEqual([]);
  });

  it('trims surrounding spaces like groupByFolder, but keeps case as typed', () => {
    const items = [item('a', 'Allies '), item('b', 'allies'), item('c', 'Allies')];
    expect(knownFolderNames(items, folderOf, ['Allies'])).toEqual(['Allies', 'allies']);
  });

  it('agrees with the named groups groupByFolder builds from the same input', () => {
    const items = [item('a', ' Foes'), item('b'), item('c', 'Allies'), item('d', 'Foes ')];
    const known = ['Allies', 'Party'];
    const fromGroups = groupByFolder(items, folderOf, known)
      .map((g) => g.folder)
      .filter((f): f is string => f !== null);
    expect(knownFolderNames(items, folderOf, known)).toEqual(fromGroups);
  });
});
