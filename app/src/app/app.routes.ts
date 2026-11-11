import { ActivatedRouteSnapshot, Routes } from '@angular/router';

import { unsavedEditGuard } from './features/creation/unsaved-edit.guard';

// Every page is its own chunk (loadComponent): the first load only carries the shell. `title` is
// a translation key (core/navigation/title-strategy.ts); `data.preload` marks the pages most
// likely to be opened next, downloaded once the app is idle (core/navigation/idle-preloading.ts).

/** "Conjuros", "Dotes"...: the compendium section in the URL. */
const typeTitle = (route: ActivatedRouteSnapshot) => `type.${route.paramMap.get('type')}`;
const preload = { preload: true };

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'compendium' },
  {
    path: 'compendium',
    title: 'compendium.title',
    loadComponent: () =>
      import('./features/compendium/compendium-home').then((m) => m.CompendiumHome),
  },
  {
    path: 'compendium/search',
    title: 'search.title',
    loadComponent: () =>
      import('./features/compendium/compendium-search-page').then((m) => m.CompendiumSearchPage),
  },
  {
    path: 'compendium/crafting',
    title: 'crafting.title',
    loadComponent: () => import('./features/compendium/crafting-page').then((m) => m.CraftingPage),
  },
  {
    path: 'compendium/:type',
    title: typeTitle,
    data: preload,
    loadComponent: () => import('./features/compendium/entry-list').then((m) => m.EntryList),
  },
  {
    // ids with "/" (subclasses: "barbarian/path-of-the-zealot") travel encoded as %2F
    path: 'compendium/:type/:id',
    title: typeTitle,
    data: preload,
    loadComponent: () => import('./features/compendium/entry-detail').then((m) => m.EntryDetail),
  },
  {
    path: 'characters',
    title: 'characters.title',
    data: preload,
    loadComponent: () =>
      import('./features/characters/character-list').then((m) => m.CharacterList),
  },
  {
    path: 'characters/new',
    title: 'create.title',
    loadComponent: () =>
      import('./features/creation/character-create').then((m) => m.CharacterCreate),
  },
  {
    path: 'characters/:id/edit',
    title: 'title.edit',
    loadComponent: () =>
      import('./features/creation/character-create').then((m) => m.CharacterCreate),
    canDeactivate: [unsavedEditGuard],
  },
  {
    path: 'characters/:id/level-up',
    title: 'title.levelUp',
    loadComponent: () => import('./features/level-up/level-up').then((m) => m.LevelUp),
  },
  {
    path: 'characters/:id/conflict',
    title: 'title.conflict',
    loadComponent: () =>
      import('./features/characters/character-conflict').then((m) => m.CharacterConflict),
  },
  {
    path: 'characters/:id',
    title: 'title.sheet',
    data: preload,
    loadComponent: () =>
      import('./features/characters/character-sheet').then((m) => m.CharacterSheet),
    // the sheet's tabs (resumen, rasgos, conjuros, equipo, invocaciones, notas): the sheet reads
    // the segment itself, so changing tab doesn't rebuild it. The summons screen keeps its old URL.
    children: [
      { path: '', pathMatch: 'full', children: [] },
      { path: ':tab', children: [] },
    ],
  },
  {
    path: 'dm',
    title: 'dm.title',
    loadComponent: () => import('./features/dm/dm-home').then((m) => m.DmHome),
  },
  {
    path: 'dm/encounters',
    title: 'dm.encounters.title',
    loadComponent: () => import('./features/dm/encounter-list').then((m) => m.EncounterList),
  },
  {
    path: 'dm/encounters/:id',
    title: 'dm.encounters.title',
    loadComponent: () => import('./features/dm/encounter-editor').then((m) => m.EncounterEditor),
  },
  {
    path: 'dm/combat',
    title: 'dm.combat.title',
    loadComponent: () => import('./features/dm/combat/combat-page').then((m) => m.CombatPage),
  },
  {
    path: 'settings',
    title: 'settings.title',
    loadComponent: () => import('./features/settings/settings-page').then((m) => m.SettingsPage),
  },
  { path: '**', redirectTo: 'compendium' },
];
