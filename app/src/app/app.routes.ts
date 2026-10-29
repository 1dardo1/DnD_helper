import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'compendium' },
  {
    path: 'compendium',
    loadComponent: () =>
      import('./features/compendium/compendium-home').then((m) => m.CompendiumHome),
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
    path: 'characters/:id',
    loadComponent: () =>
      import('./features/characters/character-sheet').then((m) => m.CharacterSheet),
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings-page').then((m) => m.SettingsPage),
  },
  { path: '**', redirectTo: 'compendium' },
];
