import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompendiumService } from '../../core/compendium/compendium.service';
import { Character } from '../../core/models/character';
import { promptRestChoices } from '../../core/play/rest-choices';
import { computeSheet } from '../../core/rules/engine';
import { featResistKey } from '../../core/rules/feat-effects';
import { RulesDataService } from '../../core/rules/rules-data.service';
import { Sheet } from '../../core/rules/sheet';
import { REAL, hero } from '../../core/rules/real-data.testing';
import { TraitRestDialog } from './trait-rest-dialog';

// Real text: data/feats.json, Boon of Energy Resistance (two of nine damage types, changeable on
// a Long Rest only, see feat-effects.ts' resistanceChangesOnRest).
const BOON_KEY = 'feat:boon-of-energy-resistance';
const RESIST_KEY = featResistKey(BOON_KEY);

@Component({
  imports: [TraitRestDialog],
  template: `
    <app-trait-rest-dialog
      [character]="character()"
      [sheet]="sheet()"
      (changed)="answers.push($event)"
    />
  `,
})
class Host {
  readonly character = signal<Character>(undefined as unknown as Character);
  readonly sheet = signal<Sheet>(undefined as unknown as Sheet);
  readonly answers: Character[] = [];
}

/** A level 4 Fighter with the Boon, two types chosen, and the rest question `rest` asks. */
function afterRest(rest: 'short' | 'long'): Character {
  const base = hero('fighter', 4, null, {
    feats: ['boon-of-energy-resistance'],
    featChoices: { [BOON_KEY]: { resistances: ['Fire', 'Cold'] } },
  });
  const sheet = computeSheet(base, REAL);
  return { ...base, state: promptRestChoices(base.state, sheet, rest) };
}

function mount(ch: Character): ComponentFixture<Host> {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.character.set(ch);
  fixture.componentInstance.sheet.set(computeSheet(ch, REAL));
  fixture.detectChanges();
  return fixture;
}

/** The dialog's item for the boon, once its data has loaded. */
async function itemOf(fixture: ComponentFixture<Host>): Promise<HTMLElement | null> {
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement.querySelector(`[data-testid="restpick-${RESIST_KEY}"]`);
}

describe('TraitRestDialog: the feat damage types after a rest', () => {
  beforeEach(() => {
    // the compendium is not needed here: the real tables are given straight away
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        { provide: RulesDataService, useValue: { load: async () => REAL } },
        { provide: CompendiumService, useValue: { all: async () => [] } },
      ],
    });
    // jsdom has no <dialog> modal support
    const proto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
    proto['showModal'] ??= function (this: HTMLDialogElement) {
      this.open = true;
    };
    proto['close'] ??= function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    };
  });

  it('after a Long Rest the feat choice is offered', async () => {
    const fixture = mount(afterRest('long'));
    expect(await itemOf(fixture)).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="trait-rest-dialog"]')).not.toBeNull();
  });

  it('after a Short Rest it is not offered: no dialog at all', async () => {
    const fixture = mount(afterRest('short'));
    expect(await itemOf(fixture)).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="trait-rest-dialog"]')).toBeNull();
  });

  it('answering "change" writes the types to featChoices and not to traitPicks', async () => {
    const ch = afterRest('long');
    const fixture = mount(ch);
    const li = (await itemOf(fixture))!;

    // "Change", then uncheck Cold and check Radiant (the boxes of the pick)
    (li.querySelectorAll('button')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    const box = (name: string) =>
      [...li.querySelectorAll('label')]
        .find((l) => l.textContent?.trim() === name)!
        .querySelector('input') as HTMLInputElement;
    box('Cold').checked = false;
    box('Cold').dispatchEvent(new Event('change'));
    fixture.detectChanges();
    box('Radiant').checked = true;
    box('Radiant').dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const done = fixture.nativeElement.querySelector(
      '.actions button.primary',
    ) as HTMLButtonElement;
    done.click();
    fixture.detectChanges();

    const out = fixture.componentInstance.answers.at(-1)!;
    expect(out.choices.featChoices?.[BOON_KEY]?.resistances).toEqual(['Fire', 'Radiant']);
    expect(out.choices.traitPicks?.[RESIST_KEY]).toBeUndefined();
    expect(out.choices.traitPicks ?? {}).toEqual(ch.choices.traitPicks ?? {});
    expect(out.state.restChoices).toBeUndefined();
  });
});
