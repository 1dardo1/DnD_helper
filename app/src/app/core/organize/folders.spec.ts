import { groupByFolder, removeFolderFrom, renameFolderIn } from './folders';

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
