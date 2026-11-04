import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'compendium' },
  {
    path: 'compendium',
    loadComponent: () =>
      import('./features/compendium/compendium-home').then((m) => m.CompendiumHome),
  },
  {
    path: 'compendium/search',
    loadComponent: () =>
      import('./features/compendium/compendium-search-page').then((m) => m.CompendiumSearchPage),
  },
  {
    path: 'compendium/:type',
    loadComponent: () => import('./features/compendium/entry-list').then((m) => m.EntryList),
  },
  {
    // ids with "/" (subclasses: "barbarian/path-of-the-zealot") travel encoded as %2F
    path: 'compendium/:type/:id',
    loadComponent: () => import('./features/compendium/entry-detail').then((m) => m.EntryDetail),
  },
  {
    path: 'characters',
    loadComponent: () =>
      import('./features/characters/character-list').then((m) => m.CharacterList),
  },
  {
    path: 'characters/new',
    loadComponent: () =>
      import('./features/creation/character-create').then((m) => m.CharacterCreate),
  },
  {
    path: 'characters/:id/edit',
    loadComponent: () =>
      import('./features/creation/character-create').then((m) => m.CharacterCreate),
  },
  {
    path: 'characters/:id/level-up',
    loadComponent: () => import('./features/level-up/level-up').then((m) => m.LevelUp),
  },
  {
    path: 'characters/:id/conflict',
    loadComponent: () =>
      import('./features/characters/character-conflict').then((m) => m.CharacterConflict),
  },
  {
    path: 'characters/:id',
    loadComponent: () =>
      import('./features/characters/character-sheet').then((m) => m.CharacterSheet),
  },
  {
    path: 'dm',
    loadComponent: () => import('./features/dm/dm-home').then((m) => m.DmHome),
  },
  {
    path: 'dm/encounters',
    loadComponent: () => import('./features/dm/encounter-list').then((m) => m.EncounterList),
  },
  {
    path: 'dm/encounters/:id',
    loadComponent: () => import('./features/dm/encounter-editor').then((m) => m.EncounterEditor),
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings-page').then((m) => m.SettingsPage),
  },
  { path: '**', redirectTo: 'compendium' },
];
