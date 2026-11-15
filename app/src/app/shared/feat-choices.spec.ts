import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { FeatChoice } from '../core/models/character';
import { Spell } from '../core/models/compendium';
import { FeatSource, siberysSpellIds } from '../core/rules/feat-effects';
import { REAL, REAL_SPELLS } from '../core/rules/real-data.testing';
import { FeatChoices } from './feat-choices';
import { Picker } from './picker/picker';

// Real texts: data/feats.json. The selector only shows what the feat's text asks for.

@Component({
  imports: [FeatChoices],
  template: `
    <app-feat-choices
      [source]="source()"
      [choice]="choice()"
      [spells]="spells()"
      [casterLists]="casterLists()"
      (changed)="onChanged($event)"
    />
  `,
})
class Host {
  readonly source = signal<FeatSource>({
    key: 'feat:boon-of-energy-resistance',
    feat: REAL.feats.get('boon-of-energy-resistance')!,
  });
  readonly choice = signal<FeatChoice | undefined>(undefined);
  readonly spells = signal<readonly Spell[]>([]);
  readonly casterLists = signal<readonly string[]>([]);
  readonly emitted: FeatChoice[] = [];

  onChanged(c: FeatChoice): void {
    this.emitted.push(c);
    this.choice.set(c);
  }
}

function mount(featId: string): ComponentFixture<Host> {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.source.set({ key: `feat:${featId}`, feat: REAL.feats.get(featId)! });
  fixture.componentInstance.spells.set(REAL_SPELLS);
  fixture.detectChanges();
  return fixture;
}

/** Picks a value in a <select>, as the player does, and lets the component react. */
function pick(fixture: ComponentFixture<Host>, select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

const selectsOf = (fixture: ComponentFixture<Host>, testId: string) =>
  [...fixture.nativeElement.querySelectorAll(`[data-testid="${testId}"]`)] as HTMLSelectElement[];

const schoolSelect = (fixture: ComponentFixture<Host>) =>
  fixture.debugElement.query(By.css('[data-testid="feat-school"] select'))
    .nativeElement as HTMLSelectElement;

/** The items the picker of a spell pick shows (the component passes them as its items). */
function pickerItems(fixture: ComponentFixture<Host>, testId: string): Spell[] {
  const el = fixture.debugElement.query(By.css(`[data-testid="${testId}"] app-picker`));
  return el ? [...(el.componentInstance as Picker<Spell>).items()] : [];
}

describe('FeatChoices: Boon of Energy Resistance (two damage types)', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Host] }));

  it('shows two damage-type selectors; the type picked in one is disabled in the other', () => {
    const fixture = mount('boon-of-energy-resistance');
    const [first] = selectsOf(fixture, 'feat-resistance');
    expect(selectsOf(fixture, 'feat-resistance')).toHaveLength(2);

    pick(fixture, first, 'Acid');
    const [, again] = selectsOf(fixture, 'feat-resistance');
    expect(again.querySelector('option[value="Acid"]')!.hasAttribute('disabled')).toBe(true);
    expect(again.querySelector('option[value="Cold"]')!.hasAttribute('disabled')).toBe(false);
  });

  it('stores the picks in resistances (never more than two)', () => {
    const fixture = mount('boon-of-energy-resistance');
    const host = fixture.componentInstance;
    const [first] = selectsOf(fixture, 'feat-resistance');
    pick(fixture, first, 'Acid');
    expect(host.emitted.at(-1)).toEqual({ resistances: ['Acid'] });

    const [, second] = selectsOf(fixture, 'feat-resistance');
    pick(fixture, second, 'Necrotic');
    expect(host.emitted.at(-1)).toEqual({ resistances: ['Acid', 'Necrotic'] });
    expect(host.choice()!.resistances).toHaveLength(2);
    expect(host.choice()!.resistance).toBeUndefined();
  });
});

describe('FeatChoices: Planar Wanderer (one of acid, cold or fire)', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Host] }));

  it('shows one selector with exactly acid, cold and fire', () => {
    const fixture = mount('planar-wanderer');
    const selects = selectsOf(fixture, 'feat-resistance');
    expect(selects).toHaveLength(1);
    const values = [...selects[0].options].map((o) => o.value).filter(Boolean);
    expect(values).toEqual(['Acid', 'Cold', 'Fire']);
  });

  it('stores the single pick in resistance', () => {
    const fixture = mount('planar-wanderer');
    const [select] = selectsOf(fixture, 'feat-resistance');
    pick(fixture, select, 'Fire');
    expect(fixture.componentInstance.emitted.at(-1)).toEqual({ resistance: 'Fire' });
  });
});

describe('FeatChoices: Boon of Magic School Mastery (school, then spells of that school)', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Host] }));

  it('after the school, offers the level 1 spells of that school on the casting class lists', () => {
    const fixture = mount('boon-of-magic-school-mastery');
    fixture.componentInstance.casterLists.set(['wizard']);
    pick(fixture, schoolSelect(fixture), 'evocation');

    const expected = REAL_SPELLS.filter(
      (s) => s.level === 1 && s.school === 'evocation' && s.classes.includes('wizard'),
    )
      .map((s) => s.id)
      .sort();
    expect(expected.length).toBeGreaterThan(0);
    const shown = pickerItems(fixture, 'feat-spell');
    expect(shown.map((s) => s.id).sort()).toEqual(expected);
    expect(shown.every((s) => s.level === 1)).toBe(true);
  });

  it('without the casting lists shows a notice instead of an empty spell selector', () => {
    const fixture = mount('boon-of-magic-school-mastery');
    pick(fixture, schoolSelect(fixture), 'evocation');

    const spellPick = fixture.debugElement.query(By.css('[data-testid="feat-spell"]'));
    expect(spellPick.query(By.directive(Picker))).toBeNull();
    expect(spellPick.query(By.css('.hint'))).not.toBeNull();
  });
});

describe('FeatChoices: Boon of Siberys (one unified spell list)', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Host] }));

  it('the unified list contains the twelve spells of the text table', () => {
    const table = siberysSpellIds(REAL.feats.get('boon-of-siberys')!);
    expect(table).toHaveLength(12);

    const fixture = mount('boon-of-siberys');
    const ids = pickerItems(fixture, 'feat-spell').map((s) => s.id);
    for (const id of table) expect(ids).toContain(id);
  });
});
