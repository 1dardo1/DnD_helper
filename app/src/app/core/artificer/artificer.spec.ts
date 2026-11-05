import classes from '../../../../../data/classes.json';
import items from '../../../../../data/items.json';
import options from '../../../../../data/options.json';
import { newCharacter, normalizeCharacter } from '../models/character';
import { ClassOption, DndClass, Item } from '../models/compendium';
import { optionGroupsFor } from '../creation/creation-rules';
import { levelGains } from '../creation/level-up';
import {
  PLAN_GROUP,
  isPickable,
  orphanedPlanIds,
  planLevelIssues,
  planOverflow,
  togglePlanChoice,
  withPlanChoices,
  knownPlans,
  pickableItems,
  pickSlots,
  planCounts,
  plansReplaced,
  plansTaken,
  resolvePlan,
} from './plans';
import {
  TRANSMUTE_KEY,
  canTransmute,
  changeReplicated,
  createReplicated,
  createdItems,
  dismissReplicatePrompt,
  normalizeReplicated,
  promptAfterLongRest,
  removeReplicated,
  transformReplicated,
} from './replicated-state';

const artificer = (classes as unknown as DndClass[]).find((c) => c.id === 'artificer')!;
const opts = options as unknown as ClassOption[];
const plans = opts.filter((o) => o.group === PLAN_GROUP);
const itemList = items as unknown as Item[];
const itemMap = new Map(itemList.map((i) => [i.id, i]));
const optMap = new Map(opts.map((o) => [o.id, o]));

const ref = (id: string) => {
  const p = resolvePlan(`${PLAN_GROUP}/${id}`, optMap, itemMap)!;
  return { planId: p.id, itemId: p.itemId, name: p.name };
};

function artificerAt(level: number) {
  const ch = newCharacter('Tinker', 'test');
  ch.classes = [{ id: 'artificer', level, subclassId: null, hp: [] }];
  return ch;
}

describe('plans: data', () => {
  it('every plan is a compendium item or a kind of item to pick', () => {
    expect(plans.length).toBeGreaterThan(40);
    for (const p of plans) {
      expect(p.classId).toBe('artificer');
      if (p.itemPick) expect(p.itemId).toBeUndefined();
      else expect(itemMap.has(p.itemId!)).toBe(true);
      expect(p.prerequisites?.level).toBeGreaterThanOrEqual(2);
    }
  });

  it('has the three repeatable rows and the level 2 list', () => {
    expect(plans.filter((p) => p.itemPick).map((p) => p.itemPick!.rarity)).toEqual([
      'common',
      'rare',
      'uncommon',
    ]);
    const first = plans.filter((p) => p.prerequisites?.level === 2 && !p.itemPick);
    expect(first.map((p) => p.name)).toContain('Bag of Holding');
    expect(first.find((p) => p.name === 'Manifold Tool')?.attunement).toBe(true);
  });
});

describe('plans: counts', () => {
  it('reads Plans Known and Magic Items from the class table', () => {
    expect(planCounts(artificer, 1)).toBeNull();
    expect(planCounts(artificer, 2)).toEqual({ known: 4, items: 2 });
    expect(planCounts(artificer, 6)).toEqual({ known: 5, items: 3 });
    expect(planCounts(artificer, 10)).toEqual({ known: 6, items: 4 });
    expect(planCounts(artificer, 20)).toEqual({ known: 8, items: 6 });
  });

  it('the plan group appears from level 2 with its count', () => {
    expect(optionGroupsFor(artificer, 1, null, opts).some((g) => g.group === PLAN_GROUP)).toBe(
      false,
    );
    const g = optionGroupsFor(artificer, 2, null, opts).find((x) => x.group === PLAN_GROUP)!;
    expect(g.count).toBe(4);
  });

  it('the level up keeps the list open to replace a plan, and counts the growth', () => {
    const at = (lvl: number) =>
      levelGains(
        artificer,
        lvl,
        { id: 'artificer', level: lvl - 1, subclassId: null, hp: [] },
        undefined,
        opts,
      ).optionGroups.find((g) => g.group === PLAN_GROUP);
    expect(at(3)?.count).toBe(4);
    expect(at(6)?.count! - at(6)!.before).toBe(1);
  });

  it('counts fixed plans and picked items together; replaced plans', () => {
    const group = plans;
    expect(plansTaken(['magic-item-plan/bag-of-holding', 'common:lucky-foot', 'x'], group)).toBe(2);
    expect(plansReplaced(['a', 'magic-item-plan/x', 'common:y'], ['a', 'magic-item-plan/x'])).toBe(
      1,
    );
    expect(plansReplaced(['magic-item-plan/x'], ['magic-item-plan/x', 'common:y'])).toBe(0);
  });
});

describe('plans: picking an item', () => {
  const common = plans.find((p) => p.itemPick?.rarity === 'common')!.itemPick!;
  const wondrous = plans.find((p) => p.itemPick?.rarity === 'uncommon')!.itemPick!;

  it('only common non-potion non-scroll items', () => {
    const list = pickableItems(itemList, common, []);
    expect(list.length).toBeGreaterThan(20);
    expect(list.every((i) => i.magic?.rarity === 'common')).toBe(true);
    expect(list.some((i) => i.magic?.type === 'potion')).toBe(false);
    expect(list.some((i) => i.id === 'potion-of-healing')).toBe(false);
  });

  it('a different item each time, and wondrous only for the high tiers', () => {
    const first = pickableItems(itemList, common, [])[0];
    expect(
      pickableItems(itemList, common, [`common:${first.id}`]).some((i) => i.id === first.id),
    ).toBe(false);
    const w = pickableItems(itemList, wondrous, []);
    expect(w.every((i) => i.magic?.type === 'wondrous item' && isPickable(i, wondrous))).toBe(true);
  });

  it('slots unlock by level and resolve picked ids', () => {
    expect(pickSlots(plans, 2).map((s) => s.itemPick!.rarity)).toEqual(['common']);
    expect(pickSlots(plans, 14).length).toBe(3);
    const list = knownPlans(
      ['magic-item-plan/bag-of-holding', 'common:lucky-foot', 'nope'],
      optMap,
      itemMap,
    );
    expect(list.map((p) => p.itemId)).toEqual(['bag-of-holding', 'lucky-foot']);
  });
});

describe('replicated items', () => {
  const bag = ref('bag-of-holding');
  const rope = ref('rope-of-climbing');
  const jug = ref('alchemy-jug');

  it('creates items into the inventory with the mark and the plan', () => {
    const r = createReplicated(artificerAt(2), bag, 2, itemMap);
    const e = r.character.inventory[0];
    expect(e.source).toBe('replicate');
    expect(e.planId).toBe(bag.planId);
    expect(e.itemId).toBe('bag-of-holding');
    expect(createdItems(r.character).length).toBe(1);
  });

  it('refuses a second item from the same plan', () => {
    const one = createReplicated(artificerAt(2), bag, 2, itemMap).character;
    const again = createReplicated(one, bag, 2, itemMap);
    expect(again.reason).toBe('duplicate');
    expect(again.character).toBe(one);
  });

  it('over the maximum the oldest vanishes', () => {
    let ch = artificerAt(2);
    ch = createReplicated(ch, bag, 2, itemMap, new Date(1)).character;
    ch = createReplicated(ch, rope, 2, itemMap, new Date(2)).character;
    const r = createReplicated(ch, jug, 2, itemMap, new Date(3));
    expect(r.vanished.map((v) => v.planId)).toEqual([bag.planId]);
    expect(r.character.inventory.map((e) => e.itemId)).toEqual(['rope-of-climbing', 'alchemy-jug']);
    expect(createdItems(r.character).map((c) => c.planId)).toEqual([rope.planId, jug.planId]);
  });

  it('an item deleted by hand stops counting; other items stay', () => {
    let ch = createReplicated(artificerAt(2), bag, 2, itemMap).character;
    ch = {
      ...ch,
      inventory: [
        { id: 'x', itemId: null, name: 'Rope', qty: 1, equipped: false },
        ...ch.inventory,
      ],
    };
    const made = createdItems(ch)[0];
    ch = { ...ch, inventory: ch.inventory.filter((e) => e.id !== made.inventoryId) };
    expect(createdItems(ch)).toEqual([]);
  });

  it('removes one and keeps the rest', () => {
    let ch = createReplicated(artificerAt(2), bag, 2, itemMap).character;
    ch = createReplicated(ch, rope, 2, itemMap).character;
    const first = createdItems(ch)[0];
    const r = removeReplicated(ch, first.inventoryId, itemMap);
    expect(r.inventory.length).toBe(1);
    expect(createdItems(r).length).toBe(1);
  });

  it('transmutes once per long rest, into a plan not in use', () => {
    let ch = createReplicated(artificerAt(6), bag, 3, itemMap).character;
    ch = createReplicated(ch, rope, 3, itemMap).character;
    const first = createdItems(ch)[0];
    expect(transformReplicated(ch, first.inventoryId, rope, itemMap)).toBeNull();
    const t = transformReplicated(ch, first.inventoryId, jug, itemMap)!;
    expect(t.inventory[0].itemId).toBe('alchemy-jug');
    expect(createdItems(t).map((c) => c.planId)).toEqual([jug.planId, rope.planId]);
    expect(t.state.resources[TRANSMUTE_KEY]).toBe(1);
    expect(canTransmute(t)).toBe(false);
    expect(transformReplicated(t, createdItems(t)[1].inventoryId, bag, itemMap)).toBeNull();
  });

  it('changes items after a long rest: remove some, create others', () => {
    let ch = createReplicated(artificerAt(2), bag, 2, itemMap).character;
    ch = createReplicated(ch, rope, 2, itemMap).character;
    const bagId = createdItems(ch)[0].inventoryId;
    const r = changeReplicated(ch, [bagId], [jug], 2, itemMap);
    expect(createdItems(r.character).map((c) => c.planId)).toEqual([rope.planId, jug.planId]);
    expect(r.character.inventory.length).toBe(2);
  });
});

describe('replicated: long rest and old characters', () => {
  it('asks only Artificers who know plans, and the answer clears it', () => {
    const state = newCharacter('x', 'd').state;
    expect(promptAfterLongRest(state, 2).replicatePrompt).toBe(true);
    expect(promptAfterLongRest(state, 0).replicatePrompt).toBeUndefined();
    expect(promptAfterLongRest(state, 1).replicatePrompt).toBeUndefined();
    const asked = promptAfterLongRest(state, 5);
    expect(dismissReplicatePrompt(asked).replicatePrompt).toBeUndefined();
  });

  it('old characters load without the new fields; garbage is dropped', () => {
    const old = JSON.parse(JSON.stringify(newCharacter('Old', 'd')));
    delete old.state.replicated;
    const c = normalizeCharacter(old)!;
    expect(c.state.replicated).toBeUndefined();
    expect(c.state.replicatePrompt).toBeUndefined();
    expect(normalizeReplicated('nope')).toEqual([]);
    expect(
      normalizeReplicated([
        { planId: 'a', itemId: 'b', inventoryId: 'c', createdAt: '2026-01-01' },
        { planId: 'a', itemId: 'b', inventoryId: 'c' },
        { planId: 1 },
        null,
      ]),
    ).toEqual([{ planId: 'a', itemId: 'b', inventoryId: 'c', createdAt: '2026-01-01' }]);
  });

  it('keeps the created items when saved and loaded again', () => {
    const ch = createReplicated(artificerAt(2), ref('bag-of-holding'), 2, itemMap).character;
    const back = normalizeCharacter(JSON.parse(JSON.stringify(ch)))!;
    expect(createdItems(back).length).toBe(1);
    expect(back.inventory[0].source).toBe('replicate');
  });
});

describe('plans: change the list at any time', () => {
  const a = `${PLAN_GROUP}/alchemy-jug`;
  const b = `${PLAN_GROUP}/bag-of-holding`;

  it('toggles a plan keeping the order', () => {
    expect(togglePlanChoice([a], b, true)).toEqual([a, b]);
    expect(togglePlanChoice([a, b], a, false)).toEqual([b]);
    expect(togglePlanChoice([a], a, true)).toEqual([a]);
  });

  it('replaces only the plans inside choices.options', () => {
    const next = withPlanChoices(['other/x', a, 'rare:foo'], [b, 'uncommon:bar', b, 'junk']);
    expect(next).toEqual(['other/x', b, 'uncommon:bar']);
  });

  it('counts the plans over the known maximum', () => {
    expect(planOverflow([a, b, 'other/x'], 2)).toBe(0);
    expect(planOverflow([a, b, 'rare:foo'], 2)).toBe(1);
  });

  it('flags plans above the Artificer level', () => {
    const high = plans.find((p) => (p.prerequisites?.level ?? 1) >= 6 && !p.itemPick)!;
    expect(planLevelIssues([high.id, a], plans, 2)).toEqual([high.id]);
    expect(planLevelIssues([high.id], plans, high.prerequisites!.level!)).toEqual([]);
  });

  it('finds created items whose plan was removed and keeps them in the character', () => {
    expect(orphanedPlanIds([a, b], [b])).toEqual([a]);
    const ch = createReplicated(artificerAt(6), ref('alchemy-jug'), 3, itemMap).character;
    const planIds = createdItems(ch).map((r) => r.planId);
    expect(orphanedPlanIds(planIds, withPlanChoices([], [b]))).toEqual([a]);
    expect(createdItems(ch)).toHaveLength(1);
    const inv = createdItems(ch)[0].inventoryId;
    expect(transformReplicated(ch, inv, ref('bag-of-holding'), itemMap)).not.toBeNull();
    expect(createdItems(removeReplicated(ch, inv, itemMap))).toHaveLength(0);
  });
});
