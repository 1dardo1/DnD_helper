// Capturas de la app en varios tamaños. Uso (con la app sirviéndose, ver SKILL.md):
//   NODE_PATH=$(npm root -g) node .claude/skills/probar-ui/shot.js <url> <carpeta-salida> [opciones]
// Opciones: --dark  --scroll=0,600,1200  --sizes=390x844,820x1180,1280x800  --full
// Imprime los errores de consola/página (ignora ERR_CONNECTION_REFUSED de la sincronización).
const { chromium } = require('playwright');
const path = require('path');

const [url, outDir, ...rest] = process.argv.slice(2);
if (!url || !outDir) {
  console.error('uso: shot.js <url> <carpeta> [--dark] [--scroll=0,600] [--sizes=390x844] [--full]');
  process.exit(2);
}
const opt = (k, d) => (rest.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split('=')[1];
const dark = rest.includes('--dark');
const full = rest.includes('--full');
const sizes = opt('sizes', '390x844,1280x800').split(',').map((s) => s.split('x').map(Number));
const scrolls = opt('scroll', '0').split(',').map(Number);

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of sizes) {
    const page = await browser.newPage({
      viewport: { width: w, height: h },
      colorScheme: dark ? 'dark' : 'light',
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/ERR_CONNECTION_REFUSED/.test(m.text())) errors.push(m.text());
    });
    await page.goto(url);
    await page.waitForTimeout(2500);
    for (const y of scrolls) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(250);
      const file = path.join(outDir, `${w}x${h}${dark ? '-dark' : ''}-y${y}.png`);
      await page.screenshot({ path: file, fullPage: full && y === 0 });
      console.log(file);
    }
    if (errors.length) console.log(`errores ${w}x${h}:`, errors.slice(0, 10));
    await page.close();
  }
  await browser.close();
})();
