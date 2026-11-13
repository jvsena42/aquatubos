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
import { chromium } from '@playwright/test';

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

const setTheme = (name) => page.getByRole('button', { name, exact: true }).click();
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

const PHONE = { width: 360, height: 780 };
const DESKTOP = { width: 1366, height: 860 };

await page.goto(BASE_URL);
const play = page.getByRole('button', { name: 'Jogar', exact: true });
await play.waitFor();

// Title screen, before any progress.
for (const [theme, name] of [
  ['Claro', 'light'],
  ['Escuro', 'dark'],
]) {
  await setTheme(theme);
  await shot(`${OUT_DIR}home-${name}.png`);
  await page.setViewportSize(PHONE);
  await shot(`${OUT_DIR}home-phone-${name}.png`);
  await page.setViewportSize(DESKTOP);
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
    await page.setViewportSize(PHONE);
    await shot(`${EXTRA_DIR}/${stage.id}-initial-phone-town.png`);
    await page.getByRole('button', { name: 'Esquema', exact: true }).click();
    await shot(`${EXTRA_DIR}/${stage.id}-initial-phone-schematic.png`);
    await page.getByRole('button', { name: 'Cidade', exact: true }).click();
    await page.setViewportSize(DESKTOP);
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
    await page.setViewportSize(PHONE);
    await shot(`${OUT_DIR}town-phone-dark.png`);
    await page.setViewportSize(DESKTOP);
    if (EXTRA_DIR) await extraShots(stage, 'dark');
    await setTheme('Claro');
  }
  if (EXTRA_DIR) {
    await page.setViewportSize(PHONE);
    await shot(`${EXTRA_DIR}/${stage.id}-solved-phone-town.png`);
    await page.getByRole('button', { name: 'Esquema', exact: true }).click();
    await shot(`${EXTRA_DIR}/${stage.id}-solved-phone-schematic.png`);
    await page.getByRole('button', { name: 'Cidade', exact: true }).click();
    await page.setViewportSize(DESKTOP);
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
await page.setViewportSize(PHONE);
await shot(`${OUT_DIR}stage-map-phone-dark.png`);
await page.setViewportSize(DESKTOP);

if (EXTRA_DIR) {
  await page.getByRole('button', { name: 'Início' }).click();
  await shot(`${EXTRA_DIR}/home-progress-dark.png`);
  await page.setViewportSize(PHONE);
  await shot(`${EXTRA_DIR}/home-progress-phone-dark.png`);
}

await browser.close();
console.log(`Screenshots written to ${OUT_DIR}`);
