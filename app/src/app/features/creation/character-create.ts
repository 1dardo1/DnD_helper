import { Component } from '@angular/core';

import { TranslatePipe } from '../../core/i18n/i18n.service';

/** Character creation wizard (class → background → species → ability scores → ...). Next phase. */
@Component({
  selector: 'app-character-create',
  imports: [TranslatePipe],
  template: `
    <h1>{{ 'create.title' | t }}</h1>
    <p>{{ 'common.comingSoon' | t }}</p>
  `,
})
export class CharacterCreate {}
