// "Volver" de verdad: ida y vuelta entre pantallas (asistente, subida de nivel, edición, hoja, crafteo,
// invocaciones, Mesa del DM, búsqueda) y el compendio. Uso, con `ng serve` en marcha:
//   PORT=4300 SHOTS=<carpeta> NODE_PATH=$(npm root -g) node .claude/skills/probar-ui/nav-e2e.js
// Los personajes sibyl/kriug/oren salen de characters/ (sync-dev-data); crea un encuentro de prueba.
const { chromium } = require('playwright');
const BASE = `http://localhost:${process.env.PORT || 4300}/#`;
const SP = (process.env.SHOTS || '/tmp') + '/';
const sizes = [
  [390, 844],
  [1280, 800],
];
let fails = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${cond ? '' : extra}`);
};
const hash = (p) => new URL(p.url()).hash;
const back = (p) => p.locator('a.back-link').first();
const settle = (p, ms = 700) => p.waitForTimeout(ms);
const CH = 'kriug-1793958485566';

async function scenario(browser, w, h) {
  const tag = `[${w}x${h}]`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  // English UI is the default; make it explicit
  await p.addInitScript(() => {
    try {
      localStorage.setItem('dnd-helper.settings', JSON.stringify({ language: 'en' }));
    } catch {}
  });

  // ---------- A. wizard -> info -> back link / browser back ----------
  await p.goto(`${BASE}/characters/new`);
  await settle(p, 2500);
  await p.click('nav.steps button:nth-child(3)');
  await settle(p);
  await p.locator('.pick-main').nth(1).click(); // Elf
  await p.locator('.pick-more').first().click();
  await settle(p, 300);
  await p.mouse.wheel(0, 300);
  await settle(p, 300);
  await p.locator('.open a').first().scrollIntoViewIfNeeded();
  const y0 = await p.evaluate(() => window.scrollY);
  await p.locator('.open a').first().click();
  await settle(p);
  ok(`${tag} A wizard->entry url`, hash(p).startsWith('#/compendium/species/'), hash(p));
  ok(`${tag} A back link names the wizard`, /New character/.test(await back(p).innerText()), await back(p).innerText());
  await back(p).click();
  await settle(p, 1500);
  ok(`${tag} A back link -> wizard`, hash(p) === '#/characters/new', hash(p));
  const cur = await p.locator('nav.steps .current').innerText();
  ok(`${tag} A step kept (3. Species)`, /3\./.test(cur), cur);
  const sp = await p.evaluate(() => JSON.parse(localStorage.getItem('dnd-helper.draft') || '{}').species?.id);
  ok(`${tag} A species kept`, sp === 'elf', String(sp));
  const y1 = await p.evaluate(() => window.scrollY);
  const maxY = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  ok(`${tag} A scroll restored`, y0 > 0 && Math.abs(y1 - Math.min(y0, maxY)) < 80, `${y0} -> ${y1} (max ${maxY})`);
  // browser back button variant
  await p.locator('.pick-more').first().click();
  await p.locator('.open a').first().click();
  await settle(p);
  await p.goBack();
  await settle(p, 1500);
  ok(`${tag} A browser back -> wizard step 3`, hash(p) === '#/characters/new' && /3\./.test(await p.locator('nav.steps .current').innerText()), hash(p));
  await p.screenshot({ path: `${SP}A-${w}.png` });

  // ---------- B. direct link: fallback ----------
  await p.goto(`${BASE}/compendium/species/elf`);
  await settle(p, 1500);
  ok(`${tag} B direct link label = type`, /Species|Specie/i.test(await back(p).innerText()), await back(p).innerText());
  await back(p).click();
  await settle(p);
  ok(`${tag} B direct link -> list`, hash(p) === '#/compendium/species', hash(p));

  // ---------- C. list with filters -> entry -> back ----------
  await p.goto(`${BASE}/compendium/spell?q=fire`);
  await settle(p, 1500);
  const ycount = await p.locator('a.card-link').count();
  await p.locator('a.card-link').nth(Math.min(3, ycount - 1)).click();
  await settle(p);
  ok(`${tag} C list->entry`, /^#\/compendium\/spell\/./.test(hash(p)), hash(p));
  await back(p).click();
  await settle(p);
  ok(`${tag} C back keeps filters`, hash(p) === '#/compendium/spell?q=fire', hash(p));

  // ---------- D. search -> entry -> chain -> back ----------
  await p.goto(`${BASE}/compendium/search?q=fireball`);
  await settle(p, 1500);
  await p.locator('main a[href*="#/compendium/spell/"], a[href*="#/compendium/spell/"]').first().click();
  await settle(p);
  ok(`${tag} D search->entry`, /compendium\/spell\//.test(hash(p)), hash(p));
  ok(`${tag} D back names search`, /Search/.test(await back(p).innerText()), await back(p).innerText());
  // chain: school link opens a list with filter
  await p.locator('dl.fields a').first().click();
  await settle(p);
  ok(`${tag} D entry->filtered list`, /^#\/compendium\/spell\?school=/.test(hash(p)), hash(p));
  await p.goBack();
  await settle(p);
  await back(p).click();
  await settle(p);
  ok(`${tag} D back to search keeps q`, hash(p) === '#/compendium/search?q=fireball', hash(p));

  // ---------- F. sheet tabs & links ----------
  await p.goto(`${BASE}/characters`);
  await settle(p, 1500);
  await p.goto(`${BASE}/characters/${CH}`);
  await settle(p, 2000);
  for (const t of ['rasgos', 'conjuros', 'equipo', 'notas', 'resumen']) {
    const l = p.locator(`nav.tabs a[data-tab="${t}"]`);
    if (await l.count()) {
      await l.click();
      await settle(p, 250);
    }
  }
  await p.goBack();
  await settle(p, 800);
  ok(`${tag} F tabs do not fill history (1 back leaves the sheet)`, !hash(p).startsWith(`#/characters/${CH}`), hash(p));
  await p.goto(`${BASE}/characters/sibyl-1793915635728/conjuros`);
  await settle(p, 2000);
  const sl = p.locator('a[href*="#/compendium/spell/"]').first();
  if (await sl.count()) {
    await sl.click();
    await settle(p);
    ok(`${tag} F sheet->spell`, /compendium\/spell/.test(hash(p)), hash(p));
    ok(`${tag} F back names sheet`, /Character sheet/.test(await back(p).innerText()), await back(p).innerText());
    await back(p).click();
    await settle(p, 1200);
    ok(`${tag} F back -> same tab`, hash(p) === "#/characters/sibyl-1793915635728/conjuros", hash(p));
  } else console.log('SKIP F spell link (none)');

  // ---------- G. level up: state survives a detour ----------
  const SIB = 'sibyl-1793915635728';
  await p.evaluate(() => sessionStorage.clear());
  await p.goto(`${BASE}/characters/${SIB}/level-up`);
  await settle(p, 2000);
  await p.locator('input[type=radio]').first().check();
  await settle(p, 300);
  let found = false;
  for (let i = 0; i < 6 && !found; i++) {
    if ((await p.locator('.pick-more').count()) > 0) {
      found = true;
      break;
    }
    const next = p.getByRole('button', { name: /Next/ });
    if (!(await next.count())) break;
    await next.click();
    await settle(p, 400);
  }
  if (found) {
    const stepBefore = await p.locator('.steps .current').innerText();
    await p.locator('.pick-more').first().click();
    await settle(p, 200);
    await p.locator('.open a').first().click();
    await settle(p);
    ok(`${tag} G level-up->entry`, /^#\/compendium\//.test(hash(p)), hash(p));
    ok(`${tag} G back names level up`, /Level up/.test(await back(p).innerText()), await back(p).innerText());
    await back(p).click();
    await settle(p, 1500);
    ok(`${tag} G back -> level-up`, hash(p) === `#/characters/${SIB}/level-up`, hash(p));
    const stepAfter = await p.locator('.steps .current').innerText();
    ok(`${tag} G step kept`, stepBefore === stepAfter, `${stepBefore} / ${stepAfter}`);
    ok(`${tag} G class kept`, (await p.locator('input[type=radio]:checked').count()) > 0 || stepAfter.indexOf('1.') < 0, stepAfter);
    await p.screenshot({ path: `${SP}G-${w}.png` });
  } else console.log('SKIP G (no info link in level-up steps)');
  await p.evaluate(() => sessionStorage.clear());

  // ---------- H. edit character: step kept ----------
  await p.goto(`${BASE}/characters/${SIB}/edit`);
  await settle(p, 2500);
  await p.click('nav.steps button:nth-child(3)');
  await settle(p, 500);
  await p.locator('.pick-more').first().click();
  await settle(p, 300);
  await p.locator('.open a').first().click();
  await settle(p);
  ok(`${tag} H edit->entry`, /^#\/compendium\//.test(hash(p)), hash(p));
  ok(`${tag} H back names edit`, /Edit character/.test(await back(p).innerText()), await back(p).innerText());
  await back(p).click();
  await settle(p, 1500);
  ok(`${tag} H back -> edit step 3`, hash(p) === `#/characters/${SIB}/edit` && /3\./.test(await p.locator('nav.steps .current').innerText()), hash(p));
  await p.goto(`${BASE}/characters`);
  await p.evaluate(() => sessionStorage.clear());

  // ---------- I. crafting -> item -> back ----------
  await p.goto(`${BASE}/compendium/crafting`);
  await settle(p, 2000);
  const craftLink = p.locator('a[href*="#/compendium/item/"], a[href*="#/compendium/rule/"]').first();
  if (await craftLink.count()) {
    await craftLink.click();
    await settle(p);
    ok(`${tag} I crafting->entry`, /^#\/compendium\/(item|rule)\//.test(hash(p)), hash(p));
    ok(`${tag} I back names crafting`, /Crafting|Item crafting/i.test(await back(p).innerText()), await back(p).innerText());
    await back(p).click();
    await settle(p, 800);
    ok(`${tag} I back -> crafting`, hash(p).startsWith('#/compendium/crafting'), hash(p));
  } else console.log('SKIP I crafting link');

  // ---------- J. summons tab -> creature -> back ----------
  for (const ch of ['kassasdin-1793879600138', 'oren-bianic-1793811890281', 'sibyl-1793915635728', 'ejemplo-thorin']) {
    await p.goto(`${BASE}/characters/${ch}/invocaciones`);
    await settle(p, 2000);
    const l = p.locator('a[href*="#/compendium/"]').first();
    if (await l.count()) {
      await l.click();
      await settle(p);
      ok(`${tag} J summons->entry (${ch})`, /^#\/compendium\//.test(hash(p)), hash(p));
      await back(p).click();
      await settle(p, 1000);
      ok(`${tag} J back -> summons tab`, hash(p) === `#/characters/${ch}/invocaciones`, hash(p));
      break;
    }
  }

  // ---------- K. DM: encounter editor -> monster -> back ----------
  await p.goto(`${BASE}/dm/encounters`);
  await settle(p, 1500);
  await p.getByRole('button', { name: /New encounter/ }).click();
  await p.fill('input[name=name]', 'Prueba navegacion');
  await p.fill('input[name=password]', 'secreto-largo-123');
  await p.fill('input[name=passwordAgain]', 'secreto-largo-123');
  await p.locator('button[type=submit]').click();
  await settle(p, 2500);
  ok(`${tag} K encounter created -> editor`, /^#\/dm\/encounters\/./.test(hash(p)), hash(p));
  const editorUrl = hash(p);
  await p.getByRole('button', { name: /Add monsters/ }).click();
  await settle(p, 800);
  await p.locator('.pick-main').first().click();
  await settle(p, 600);
  const mlink = p.locator('a[href*="#/compendium/monster/"]').first();
  if (await mlink.count()) {
    await mlink.click();
    await settle(p);
    ok(`${tag} K editor->monster`, /^#\/compendium\/monster\//.test(hash(p)), hash(p));
    ok(`${tag} K back names encounter`, /Encounter/.test(await back(p).innerText()), await back(p).innerText());
    await back(p).click();
    await settle(p, 1000);
    ok(`${tag} K back -> editor`, hash(p) === editorUrl, hash(p));
    const left = await p.locator('a[href*="#/compendium/monster/"]').count();
    ok(`${tag} K editor keeps monsters`, left > 0, String(left));
  } else {
    console.log('SKIP K monster link');
    await p.screenshot({ path: `${SP}K-${w}.png` });
  }
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of sizes) await scenario(browser, w, h);
  await browser.close();
  console.log(fails ? `${fails} FAILURES` : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();
