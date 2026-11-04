import monsters from '../../../../../data/monsters.json';
import { Monster } from '../models/compendium';
import {
  ParsedAction,
  SECTIONS,
  damageText,
  firstSentence,
  parseAction,
  parseDamage,
  parseMonster,
  parseName,
  usageSlots,
} from './monster-actions';

const all = monsters as unknown as Monster[];
const byId = new Map(all.map((m) => [m.id, m]));

function feature(id: string, name: string): ParsedAction {
  const m = byId.get(id)!;
  const found = parseMonster(m).features.find((f) => f.name === name);
  if (!found) throw new Error(`${id}: ${name} not found`);
  return found;
}

describe('parseName', () => {
  it('reads recharges, uses per day and the rest', () => {
    expect(parseName('Fire Breath (Recharge 5–6)')).toEqual({
      name: 'Fire Breath',
      usage: { kind: 'recharge', min: 5 },
      note: null,
    });
    expect(parseName('Frost Breath (Recharge 6)').usage).toEqual({ kind: 'recharge', min: 6 });
    expect(parseName('Misty Step (3/Day)').usage).toEqual({
      kind: 'perDay',
      count: 3,
      inLair: null,
    });
    expect(parseName('Legendary Resistance (3/Day, or 4/Day in Lair)').usage).toEqual({
      kind: 'perDay',
      count: 3,
      inLair: 4,
    });
    expect(parseName('Spells (2/Day Each)').usage).toEqual({
      kind: 'perDay',
      count: 2,
      inLair: null,
    });
    expect(parseName('Teleport (Recharge after a Short or Long Rest)').usage).toEqual({
      kind: 'rest',
    });
  });

  it('keeps other parentheses as a note', () => {
    expect(parseName('Bite (Bat or Vampire Form Only)')).toEqual({
      name: 'Bite',
      usage: null,
      note: 'Bat or Vampire Form Only',
    });
    expect(parseName('Soul Harvest (1/Day; Requires Soul Bag)')).toEqual({
      name: 'Soul Harvest',
      usage: { kind: 'perDay', count: 1, inLair: null },
      note: 'Requires Soul Bag',
    });
    expect(parseName('Scimitar')).toEqual({ name: 'Scimitar', usage: null, note: null });
  });

  it('gives the number of checkboxes', () => {
    expect(usageSlots(null)).toBe(0);
    expect(usageSlots({ kind: 'recharge', min: 5 })).toBe(1);
    expect(usageSlots({ kind: 'rest' })).toBe(1);
    expect(usageSlots({ kind: 'perDay', count: 3, inLair: 4 })).toBe(3);
  });
});

describe('parseDamage', () => {
  it('reads several parts, flat amounts and conditional ones', () => {
    expect(parseDamage('13 (1d10 + 8) Slashing damage plus 5 (2d4) Fire damage.')).toEqual([
      { average: 13, dice: '1d10 + 8', type: 'slashing', conditional: false },
      { average: 5, dice: '2d4', type: 'fire', conditional: false },
    ]);
    expect(parseDamage('1 Piercing damage plus 5 (2d4) Poison damage.')[0]).toEqual({
      average: 1,
      dice: null,
      type: 'piercing',
      conditional: false,
    });
    const goblin = parseDamage(
      '5 (1d6 + 2) Slashing damage, plus 2 (1d4) Slashing damage if the attack roll had Advantage.',
    );
    expect(goblin.map((d) => d.conditional)).toEqual([false, true]);
    expect(damageText(goblin[0])).toBe('5 (1d6 + 2)');
    expect(damageText({ average: 1, dice: null, type: 'piercing', conditional: false })).toBe('1');
  });
});

describe('firstSentence', () => {
  it('stops at the end of the first sentence', () => {
    expect(firstSentence('The goblin takes the Disengage or Hide action.')).toBe(
      'The goblin takes the Disengage or Hide action.',
    );
    expect(firstSentence('It moves 5 ft. and attacks. Then it hides.')).toBe(
      'It moves 5 ft. and attacks.',
    );
  });
});

describe('attacks', () => {
  it('goblin warrior: melee and ranged', () => {
    const scimitar = feature('goblin-warrior', 'Scimitar');
    expect(scimitar.kind).toBe('attack');
    expect(scimitar.attack).toEqual({
      mode: 'melee',
      bonus: 4,
      reach: 5,
      range: null,
      note: false,
    });
    expect(scimitar.damage.length).toBe(2);
    expect(scimitar.damage[1].conditional).toBe(true);
    const bow = feature('goblin-warrior', 'Shortbow');
    expect(bow.attack).toEqual({
      mode: 'ranged',
      bonus: 4,
      reach: null,
      range: { normal: 80, long: 320 },
      note: false,
    });
    expect(bow.damage[0]).toEqual({
      average: 5,
      dice: '1d6 + 2',
      type: 'piercing',
      conditional: false,
    });
  });

  it('bugbear warrior: grab (condition, escape DC) and melee-or-ranged with a note', () => {
    const grab = feature('bugbear-warrior', 'Grab');
    expect(grab.attack?.reach).toBe(10);
    expect(grab.damage.map(damageText)).toEqual(['9 (2d6 + 2)']);
    expect(grab.conditions).toEqual(['grappled']);
    expect(grab.escapeDc).toBe(12);
    expect(grab.more).toBe(true);
    const hammer = feature('bugbear-warrior', 'Light Hammer');
    expect(hammer.attack).toEqual({
      mode: 'meleeOrRanged',
      bonus: 4,
      reach: 10,
      range: { normal: 20, long: 60 },
      note: true,
    });
    expect(hammer.more).toBe(false);
  });

  it('adult red dragon: rend with two damage types', () => {
    const rend = feature('adult-red-dragon', 'Rend');
    expect(rend.attack?.bonus).toBe(14);
    expect(rend.damage.map((d) => [damageText(d), d.type])).toEqual([
      ['13 (1d10 + 8)', 'slashing'],
      ['5 (2d4)', 'fire'],
    ]);
    expect(rend.more).toBe(false);
  });

  it('lich and mage: spell-like attacks with reach or range', () => {
    const burst = feature('lich', 'Eldritch Burst');
    expect(burst.attack).toEqual({
      mode: 'meleeOrRanged',
      bonus: 12,
      reach: 5,
      range: { normal: 120, long: null },
      note: false,
    });
    expect(burst.damage[0].type).toBe('force');
    const touch = feature('lich', 'Paralyzing Touch');
    expect(touch.conditions).toEqual(['paralyzed']);
    expect(feature('mage', 'Arcane Burst').damage.map(damageText)).toEqual(['16 (3d8 + 3)']);
  });

  it('odd forms: "to hit", "feet", no "Hit:", no damage', () => {
    expect(feature('bat', 'Bite').attack?.bonus).toBe(4);
    expect(feature('giant-rat', 'Bite').damage.map(damageText)).toEqual(['5 (1d4 + 3)']);
    const roper = feature('roper', 'Tentacle');
    expect(roper.attack?.reach).toBe(60);
    expect(roper.damage).toEqual([]);
    expect(roper.conditions).toEqual(['grappled', 'poisoned']);
    const wb = byId.get('werebear')!;
    const claw = parseMonster(wb).features.find((f) => f.attack?.range);
    expect(claw?.attack?.reach).toBe(5);
  });

  it('a hit that forces a save (death dog)', () => {
    const bite = feature('death-dog', 'Bite');
    expect(bite.kind).toBe('attack');
    expect(bite.save?.ability).toBe('CON');
    expect(bite.save?.dc).toBe(12);
  });
});

describe('saving throws', () => {
  it('breath weapons: cone, line, half on a success, recharge', () => {
    const fire = feature('adult-red-dragon', 'Fire Breath');
    expect(fire.kind).toBe('save');
    expect(fire.usage).toEqual({ kind: 'recharge', min: 5 });
    expect(fire.save).toEqual({
      ability: 'DEX',
      dc: 21,
      area: { shape: 'cone', size: 60, width: null },
      within: null,
      half: true,
    });
    expect(fire.damage.map(damageText)).toEqual(['59 (17d6)']);
    expect(fire.more).toBe(false);
    const line = feature('ancient-blue-dragon', 'Lightning Breath');
    expect(line.save?.area).toEqual({ shape: 'line', size: 120, width: 10 });
  });

  it('one creature within a distance; effects without damage', () => {
    const consume = feature('aboleth', 'Consume Memories');
    expect(consume.save).toEqual({
      ability: 'INT',
      dc: 16,
      area: null,
      within: 30,
      half: true,
    });
    const dominate = feature('aboleth', 'Dominate Mind');
    expect(dominate.usage).toEqual({ kind: 'perDay', count: 2, inLair: null });
    expect(dominate.save?.ability).toBe('WIS');
    expect(dominate.damage).toEqual([]);
    expect(dominate.conditions).toEqual(['charmed']);
    expect(dominate.more).toBe(true);
  });

  it('emanations, legendary actions and saves after a move', () => {
    const disrupt = feature('lich', 'Disrupt Life');
    expect(disrupt.section).toBe('legendaryActions');
    expect(disrupt.save?.area).toEqual({ shape: 'emanation', size: 20, width: null });
    expect(disrupt.damage.map(damageText)).toEqual(['31 (9d6)']);
    const engulf = feature('gelatinous-cube', 'Engulf');
    expect(engulf.kind).toBe('save');
    expect(engulf.save?.dc).toBe(12);
    expect(engulf.more).toBe(true);
    const charge = feature('centaur-trooper', 'Trampling Charge');
    expect(charge.section).toBe('bonusActions');
    expect(charge.save?.ability).toBe('STR');
    expect(charge.conditions).toEqual(['prone']);
  });

  it('a reaction whose response is a save (the "––" form)', () => {
    const m = all.find((x) =>
      x.reactions.some((r) => /Response––\w+ Saving Throw/.test(r.description)),
    )!;
    const p = parseMonster(m).features.find((f) => f.section === 'reactions' && f.save);
    expect(p?.save?.dc).toBeGreaterThan(0);
  });
});

describe('other features', () => {
  it('multiattack, plain actions and traits', () => {
    expect(feature('adult-red-dragon', 'Multiattack').kind).toBe('multiattack');
    expect(feature('goblin-warrior', 'Nimble Escape').kind).toBe('other');
    const lr = feature('adult-red-dragon', 'Legendary Resistance');
    expect(lr.section).toBe('traits');
    expect(lr.usage).toEqual({ kind: 'perDay', count: 3, inLair: 4 });
    expect(feature('mage', 'Misty Step').usage).toEqual({ kind: 'perDay', count: 3, inLair: null });
  });

  it('spellcasting: DC, attack, at will and per-day lists', () => {
    const sc = feature('adult-red-dragon', 'Spellcasting');
    expect(sc.kind).toBe('spellcasting');
    expect(sc.spellcasting).toEqual({
      ability: 'CHA',
      dc: 20,
      attack: 12,
      groups: [
        { perDay: null, spells: ['Command', 'Detect Magic', 'Scorching Ray'] },
        { perDay: 1, spells: ['Fireball'] },
      ],
    });
    const mage = feature('mage', 'Spellcasting').spellcasting!;
    expect([mage.ability, mage.dc, mage.attack]).toEqual(['INT', 14, null]);
    expect(mage.groups.map((g) => [g.perDay, g.spells.length])).toEqual([
      [null, 5],
      [2, 2],
      [1, 2],
    ]);
    expect(feature('giant-owl', 'Spellcasting').spellcasting?.dc).toBeNull();
  });

  it('legendary action uses and keys', () => {
    const p = parseMonster(byId.get('adult-red-dragon')!);
    expect([p.legendaryUses, p.legendaryUsesInLair]).toEqual([3, 4]);
    expect(p.features.find((f) => f.name === 'Pounce')?.key).toBe('legendaryActions:2');
    expect(parseMonster(byId.get('goblin-warrior')!).legendaryUses).toBeNull();
  });
});

describe('the whole bestiary', () => {
  it('reads nearly every attack and saving throw', () => {
    const count = { attacks: 0, attacksRead: 0, saves: 0, savesRead: 0, other: 0, total: 0 };
    const kinds: Record<string, number> = {};
    const unread: string[] = [];
    for (const m of all) {
      for (const section of SECTIONS) {
        m[section].forEach((f, i) => {
          const p = parseAction(f, section, i);
          count.total++;
          kinds[p.kind] = (kinds[p.kind] ?? 0) + 1;
          const d = f.description;
          if (/^(Melee|Ranged|Melee or Ranged) Attack Roll/.test(d)) {
            count.attacks++;
            if (p.kind === 'attack' && (p.damage.length || p.conditions.length))
              count.attacksRead++;
            else unread.push(`${m.id} ${f.name}`);
          } else if (section !== 'traits' && /Saving Throw[\s:_*]*DC \d+/.test(d)) {
            count.saves++;
            if (p.save && (p.damage.length || p.conditions.length || p.more)) count.savesRead++;
            else unread.push(`${m.id} ${f.name}`);
          } else if (p.kind === 'other') count.other++;
        });
      }
    }
    // 1315 features: 423 attacks and 173 saving throws, all read
    expect([count.total, count.attacks, count.saves]).toEqual([1315, 423, 173]);
    expect(kinds['multiattack']).toBeGreaterThan(170);
    expect(count.attacksRead).toBe(count.attacks);
    expect(count.savesRead).toBe(count.saves);
    expect(unread).toEqual([]);
  });

  it('every attack has a bonus and a reach or range; every save an ability and DC', () => {
    for (const m of all) {
      for (const f of parseMonster(m).features) {
        if (f.attack) {
          expect(Number.isFinite(f.attack.bonus), `${m.id} ${f.name}`).toBe(true);
          expect(f.attack.reach ?? f.attack.range, `${m.id} ${f.name}`).not.toBeNull();
        }
        if (f.save) {
          expect(f.save.ability, `${m.id} ${f.name}`).toBeTruthy();
          expect(f.save.dc, `${m.id} ${f.name}`).toBeGreaterThan(0);
        }
        for (const d of f.damage) expect(d.average, `${m.id} ${f.name}`).toBeGreaterThan(0);
      }
    }
  });
});
