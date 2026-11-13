/**
 * Takes the screenshots used in the README (docs/screenshots).
 *
 * Needs the production build being served:
 *   npm run build && npm run preview        (in another terminal)
 *   npm run screenshots
 *
 * Options (environment variables):
 *   BASE_URL   default http://localhost:4173/aquatubos/
 *   EXTRA_DIR  when set, also saves every tab of every stage there (for visual review)
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173/aquatubos/';
const EXTRA_DIR = process.env.EXTRA_DIR;
const OUT_DIR = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
const README_STAGE = 2;

const stages = [1, 2, 3, 4, 5].map((n) =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../src/scenarios/stages/stage${n}.json`, import.meta.url)),
      'utf8',
    ),
  ),
);

mkdirSync(OUT_DIR, { recursive: true });
if (EXTRA_DIR) mkdirSync(EXTRA_DIR, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 1366, height: 860 },
  deviceScaleFactor: 1,
  serviceWorkers: 'block',
  reducedMotion: 'reduce',
});
const page = await context.newPage();

// Language and theme live in the header menu.
const setTheme = async (name) => {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitemradio', { name, exact: true }).click();
};
const shot = (path) => page.screenshot({ path, animations: 'disabled' });

async function selectPipe(pipeId) {
  await page.locator(`[data-element="pipe"][data-id="${pipeId}"]`).focus();
  await page.keyboard.press('Enter');
}

async function solve(stage) {
  for (const pipe of stage.pipes) {
    const dn = stage.reference.diameters[pipe.id];
    if (dn === pipe.initialDN) continue;
    await selectPipe(pipe.id);
    await page
      .getByRole('group', { name: `Diâmetro nominal do trecho ${pipe.id}` })
      .first()
      .getByRole('button', { name: new RegExp(`^DN ${dn},`) })
      .click();
  }
  await page.getByRole('button', { name: 'Calcular / Verificar' }).click();
  await page.getByText('Aprovado').first().waitFor();
}

async function extraShots(stage, label) {
  if (!EXTRA_DIR) return;
  const tabs = ['Rede', 'Tabela', 'Perfil', 'Hardy Cross', 'Bomba', '3D'];
  for (const tab of tabs) {
    const handle = page.getByRole('tab', { name: tab });
    if ((await handle.count()) === 0) continue;
    await handle.click();
    await page.waitForTimeout(tab === '3D' ? 1500 : 300);
    await shot(`${EXTRA_DIR}/${stage.id}-${label}-${tab.replace(' ', '')}.png`);
  }
  await page.getByRole('tab', { name: 'Rede' }).click();
}

const PHONE = { ...devices['Pixel 7'], serviceWorkers: 'block', reducedMotion: 'reduce' };

await page.goto(BASE_URL);
const play = page.getByRole('button', { name: 'Jogar', exact: true });
await play.waitFor();

// Title screen, before any progress: desktop and phone.
for (const [theme, name] of [
  ['Claro', 'light'],
  ['Escuro', 'dark'],
]) {
  await setTheme(theme);
  await shot(`${OUT_DIR}home-${name}.png`);
  const phone = await browser.newContext({ ...PHONE, colorScheme: name });
  const phonePage = await phone.newPage();
  await phonePage.goto(BASE_URL);
  await phonePage.getByRole('button', { name: 'Jogar', exact: true }).waitFor();
  await phonePage.screenshot({ path: `${OUT_DIR}home-phone-${name}.png`, animations: 'disabled' });
  await phone.close();
}
await setTheme('Claro');
await play.click();
await page.getByRole('button', { name: /^Etapa 1: / }).click();

for (const stage of stages) {
  await page.getByRole('dialog').waitFor();
  if (EXTRA_DIR) await shot(`${EXTRA_DIR}/${stage.id}-briefing.png`);
  await page.keyboard.press('Escape');
  if (EXTRA_DIR) {
    await page.getByRole('button', { name: 'Calcular / Verificar' }).click();
    await page.waitForTimeout(400);
    await extraShots(stage, 'initial');
  }
  await solve(stage);
  await selectPipe(stage.pipes[1].id);
  await extraShots(stage, 'solved');

  if (stage.order === README_STAGE) {
    await setTheme('Claro');
    await shot(`${OUT_DIR}town-light.png`);
    await page.getByRole('button', { name: 'Esquema', exact: true }).click();
    await shot(`${OUT_DIR}schematic-light.png`);
    await page.getByRole('button', { name: 'Cidade', exact: true }).click();
    await setTheme('Escuro');
    await shot(`${OUT_DIR}town-dark.png`);
    if (EXTRA_DIR) await extraShots(stage, 'dark');
    await setTheme('Claro');
  }
  if (stage.order < stages.length) {
    await page.getByRole('button', { name: 'Próxima etapa' }).click();
  }
}

// Stage map with every stage completed.
await page.getByRole('button', { name: 'Voltar para a lista de etapas' }).click();
await page.getByRole('heading', { name: 'Etapas' }).waitFor();
await setTheme('Claro');
await shot(`${OUT_DIR}stage-map-light.png`);
await setTheme('Escuro');
await shot(`${OUT_DIR}stage-map-dark.png`);

// Phone: same saved progress (IndexedDB) in a Pixel 7 sized context with touch.
const storageState = await context.storageState({ indexedDB: true });
const phone = await browser.newContext({ ...PHONE, colorScheme: 'light', storageState });
const phonePage = await phone.newPage();
const phoneShot = (name) =>
  phonePage.screenshot({ path: `${OUT_DIR}${name}.png`, animations: 'disabled' });
await phonePage.goto(BASE_URL);
await phonePage.getByRole('button', { name: /^Mapa de etapas/ }).tap();
await phonePage.getByRole('heading', { name: 'Etapas' }).waitFor();
await phoneShot('stage-map-phone');
await phonePage.getByRole('button', { name: new RegExp(`^Etapa ${README_STAGE}: `) }).tap();
await phonePage.getByRole('dialog').getByRole('button', { name: 'Continuar' }).tap();
await phonePage.waitForTimeout(400);
await phoneShot('town-phone');
// Tapping a pipe opens the bottom sheet half way with the calculation.
const pipe = stages[README_STAGE - 1].pipes[1].id;
const centre = await phonePage
  .locator(`[data-element="pipe"][data-id="${pipe}"]`)
  .evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
await phonePage.touchscreen.tap(centre.x, centre.y);
await phonePage.locator('section.sheet[data-detent="half"]').waitFor();
await phonePage.waitForTimeout(500);
await phoneShot('town-phone-sheet');
await phonePage.getByRole('button', { name: 'Recolher painel' }).tap();
await phonePage.waitForTimeout(500);
await phonePage.getByRole('tab', { name: 'Tabela' }).tap();
await phonePage.waitForTimeout(300);
await phoneShot('table-phone');
await phone.close();

await browser.close();
console.log(`Screenshots written to ${OUT_DIR}`);
