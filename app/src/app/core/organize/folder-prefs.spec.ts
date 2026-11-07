import { FolderPrefs } from './folder-prefs';

describe('FolderPrefs', () => {
  beforeEach(() => localStorage.clear());

  it('starts with no folders and nothing collapsed', () => {
    const prefs = new FolderPrefs('test.folders');
    expect(prefs.names()).toEqual([]);
    expect(prefs.isCollapsed(null)).toBe(false);
    expect(prefs.isCollapsed('Allies')).toBe(false);
  });

  it('remembers created folders across instances (same storage key)', () => {
    new FolderPrefs('test.folders').ensure('Allies');
    expect(new FolderPrefs('test.folders').names()).toEqual(['Allies']);
  });

  it('does not add the same folder twice', () => {
    const prefs = new FolderPrefs('test.folders');
    prefs.ensure('Allies');
    prefs.ensure('Allies');
    expect(prefs.names()).toEqual(['Allies']);
  });

  it('ignores a blank name', () => {
    const prefs = new FolderPrefs('test.folders');
    prefs.ensure('   ');
    expect(prefs.names()).toEqual([]);
  });

  it('renames a folder, keeping its position', () => {
    const prefs = new FolderPrefs('test.folders');
    prefs.ensure('Allies');
    prefs.ensure('Foes');
    expect(prefs.rename('Allies', 'Party')).toBe('Party');
    expect(prefs.names()).toEqual(['Party', 'Foes']);
  });

  it('carries the collapsed state over to the new name on rename', () => {
    const prefs = new FolderPrefs('test.folders');
    prefs.ensure('Allies');
    prefs.toggle('Allies');
    prefs.rename('Allies', 'Party');
    expect(prefs.isCollapsed('Party')).toBe(true);
    expect(prefs.isCollapsed('Allies')).toBe(false);
  });

  it('removes a folder from the known list', () => {
    const prefs = new FolderPrefs('test.folders');
    prefs.ensure('Allies');
    prefs.ensure('Foes');
    prefs.remove('Allies');
    expect(prefs.names()).toEqual(['Foes']);
  });

  it('toggles the collapsed state, including the "no folder" group (null)', () => {
    const prefs = new FolderPrefs('test.folders');
    expect(prefs.isCollapsed(null)).toBe(false);
    prefs.toggle(null);
    expect(prefs.isCollapsed(null)).toBe(true);
    prefs.toggle(null);
    expect(prefs.isCollapsed(null)).toBe(false);
  });

  it('keeps separate screens (storage keys) independent', () => {
    const chars = new FolderPrefs('test.characters');
    const encounters = new FolderPrefs('test.encounters');
    chars.ensure('Allies');
    expect(encounters.names()).toEqual([]);
  });
});
