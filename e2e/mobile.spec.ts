import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// Runs in the phone projects of playwright.config.ts (Pixel 7 and iPhone 14 viewports, touch).

interface StageFile {
  title: { pt: string };
  pipes: { id: string; initialDN: number }[];
  reference: { diameters: Record<string, number> };
}

const stage1: StageFile = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../src/scenarios/stages/stage1.json', import.meta.url)),
    'utf8',
  ),
);

/** The page must never scroll sideways. */
async function expectNoHorizontalOverflow(page: Page, where: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `horizontal overflow on ${where}`).toBeLessThanOrEqual(0);
}

/**
 * Taps the middle of a pipe with a real touch. A straight horizontal or vertical pipe has an
 * empty bounding box, which Playwright treats as not visible, so the tap goes by coordinates.
 */
async function tapPipe(page: Page, pipeId: string) {
  const pipe = page.locator(`[data-element="pipe"][data-id="${pipeId}"]`);
  const centre = () =>
    pipe.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    });
  // The map refits when its container changes size (sheet opening or closing, fonts loading),
  // so wait until the pipe stops moving before aiming at it.
  let previous = await centre();
  await expect(async () => {
    await page.waitForTimeout(120);
    const current = await centre();
    const moved = Math.hypot(current.x - previous.x, current.y - previous.y);
    previous = current;
    expect(moved).toBeLessThan(0.5);
  }).toPass();
  await page.touchscreen.tap(previous.x, previous.y);
}

async function openStage1(page: Page) {
  await page.goto('./');
  await expectNoHorizontalOverflow(page, 'title screen');
  await page.getByRole('button', { name: 'Jogar', exact: true }).tap();
  await expect(page.getByRole('heading', { name: 'Etapas' })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'stage map');
  await page.getByRole('button', { name: /^Etapa 1: / }).tap();
  const briefing = page.getByRole('dialog');
  await expect(briefing).toBeVisible();
  await expectNoHorizontalOverflow(page, 'briefing');
  await briefing.getByRole('button', { name: 'Continuar' }).tap();
  await expect(briefing).toBeHidden();
}

test('plays stage 1 by touch with the bottom sheet', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await openStage1(page);
  const sheet = page.locator('section.sheet');
  await expect(sheet).toHaveAttribute('data-detent', 'peek');
  await expectNoHorizontalOverflow(page, 'stage');

  // The stage is an app frame on phones: the page itself does not scroll.
  const pageScroll = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  expect(pageScroll).toBeLessThanOrEqual(0);

  // The map gets most of the screen while the sheet is closed.
  const canvas = await page.locator('.town__canvas').boundingBox();
  const viewport = page.viewportSize()!;
  expect(canvas!.width).toBeGreaterThan(viewport.width * 0.85);
  expect(canvas!.height).toBeGreaterThan(viewport.height * 0.4);

  const verify = page.locator('.sheet__verify');
  for (const pipe of stage1.pipes) {
    const dn = stage1.reference.diameters[pipe.id]!;
    if (dn === pipe.initialDN) continue;
    // Tapping a pipe selects it and raises the sheet to half with the calculation.
    await tapPipe(page, pipe.id);
    await expect(sheet).toHaveAttribute('data-detent', 'half');
    await expect(sheet.getByRole('heading', { name: `Trecho ${pipe.id}` })).toBeVisible();
    // The sheet shows the DN as text; the picker is the bar under the map, in thumb reach.
    await expect(
      sheet.getByRole('button', { name: `Alterar o diâmetro do trecho ${pipe.id}` }),
    ).toBeVisible();
    const bar = page.locator('#dn-bar');
    await expect(bar).toBeInViewport();
    await bar.getByRole('button', { name: new RegExp(`^DN ${dn},`) }).tap();
    // The verify button stays on screen and shows that results are outdated.
    await expect(verify).toBeInViewport();
    await expect(verify).toHaveAttribute('data-stale', 'true');
    await page.getByRole('button', { name: 'Recolher painel' }).tap();
    await expect(sheet).toHaveAttribute('data-detent', 'peek');
    // Wait for the sheet to finish sliding down before touching the map again.
    await expect
      .poll(async () => (await sheet.boundingBox())!.y)
      .toBeGreaterThan(viewport.height - 120);
  }

  await verify.tap();
  // Success leaves the sheet closed so the town animation is visible, with a notice.
  await expect(page.locator('.sheet__passed')).toBeVisible();
  await expect(sheet).toHaveAttribute('data-detent', 'peek');

  // The handle opens the sheet step by step; the checks section shows the result.
  await page.locator('.sheet__handle').tap();
  await expect(sheet).toHaveAttribute('data-detent', 'half');
  await sheet.getByRole('button', { name: 'Verificações', exact: true }).tap();
  await expect(sheet.getByText('Aprovado').first()).toBeVisible();
  await page.locator('.sheet__handle').tap();
  await expect(sheet).toHaveAttribute('data-detent', 'full');
  await expectNoHorizontalOverflow(page, 'stage with the sheet open');
  await page.locator('.sheet__handle').tap();
  await expect(sheet).toHaveAttribute('data-detent', 'peek');

  expect(errors).toEqual([]);
});

test('has no horizontal overflow on any tab or dialog', async ({ page }) => {
  await openStage1(page);

  for (const tab of ['Tabela', '3D', 'Rede']) {
    await page.getByRole('tab', { name: tab }).tap();
    await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
    await expectNoHorizontalOverflow(page, `tab ${tab}`);
  }
  await page.getByRole('button', { name: 'Esquema', exact: true }).tap();
  await expect(page.locator('.netview__canvas')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'schematic');

  // The briefing is one tap away in the header.
  await page.getByRole('button', { name: 'Enunciado' }).tap();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'briefing');
  await page.getByRole('dialog').getByRole('button', { name: 'Continuar' }).tap();

  // Everything else lives in the single header menu, stage actions included.
  await page.getByRole('button', { name: 'Menu' }).tap();
  const menu = page.getByRole('menu', { name: 'Menu' });
  await expect(menu.getByRole('menuitemradio', { name: 'Darcy-Weisbach' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Restaurar diâmetros' })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'menu');
  await menu.getByRole('menuitem', { name: 'Glossário' }).tap();
  await expect(page.getByRole('dialog', { name: 'Glossário' })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'glossary');
});
