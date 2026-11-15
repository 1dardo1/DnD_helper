import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Character } from '../../core/models/character';
import { RulesData, computeSheet } from '../../core/rules/engine';
import { REAL, hero } from '../../core/rules/real-data.testing';
import { CharacterVitals } from './character-vitals';

@Component({
  imports: [CharacterVitals],
  template: `<app-character-vitals [character]="character()" [data]="data()" />`,
})
class Host {
  readonly character = signal<Character>(undefined as unknown as Character);
  readonly data = signal<RulesData | null>(null);
}

function mount(ch: Character, data: RulesData | null): ComponentFixture<Host> {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.character.set(ch);
  fixture.componentInstance.data.set(data);
  fixture.detectChanges();
  return fixture;
}

const chip = (fixture: ComponentFixture<Host>, testId: string) =>
  fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;

describe('CharacterVitals (the PG and CA chips of the list)', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Host] }));

  it('without the compendium loaded yet, paints nothing', () => {
    const fixture = mount(hero('fighter', 4), null);
    expect(chip(fixture, 'vitals-hp')).toBeNull();
    expect(chip(fixture, 'vitals-ac')).toBeNull();
    expect(fixture.nativeElement.querySelector('.chip')).toBeNull();
  });

  it('when the engine cannot compute the sheet, paints nothing (the list is not broken)', () => {
    // a damaged character without its classes list: the engine cannot compute the sheet at all
    const broken = { ...hero('fighter', 3), classes: undefined } as unknown as Character;
    expect(() => computeSheet(broken, REAL)).toThrow();
    const fixture = mount(broken, REAL);
    expect(chip(fixture, 'vitals-hp')).toBeNull();
    expect(chip(fixture, 'vitals-ac')).toBeNull();
  });

  it('with the data, shows the same hit points and armor class as the sheet', () => {
    const ch = hero('fighter', 4, null, { scores: { CON: 16, DEX: 14 } });
    const sheet = computeSheet(ch, REAL);
    const fixture = mount(ch, REAL);

    const hp = chip(fixture, 'vitals-hp')!;
    const ac = chip(fixture, 'vitals-ac')!;
    expect(hp.textContent).toContain(`${sheet.hitPoints.current}/${sheet.hitPoints.max}`);
    expect(ac.textContent).toContain(String(sheet.armorClass.value));
  });
});
