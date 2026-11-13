import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// Runs in the iPad projects of playwright.config.ts (810×1080 portrait and 1080×810 landscape).

const stage1 = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../src/scenarios/stages/stage1.json', import.meta.url)),
    'utf8',
  ),
) as {
  pipes: { id: string; initialDN: number }[];
  reference: { diameters: Record<string, number> };
};

async function expectFittedPage(page: Page, where: string) {
  const overflow = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - window.innerWidth,
    y: document.documentElement.scrollHeight - window.innerHeight,
  }));
  expect(overflow.x, `horizontal overflow on ${where}`).toBeLessThanOrEqual(0);
  expect(overflow.y, `vertical page scroll on ${where}`).toBeLessThanOrEqual(0);
}

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

test('plays stage 1 on a tablet without page scrolling', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-device', 'tablet');
  await expectFittedPage(page, 'title screen');
  await page.getByRole('button', { name: 'Jogar', exact: true }).tap();
  await expect(page.getByRole('heading', { name: 'Etapas' })).toBeVisible();
  await expectFittedPage(page, 'stage map');
  await page.getByRole('button', { name: /^Etapa 1: / }).tap();
  await page.getByRole('dialog').getByRole('button', { name: 'Continuar' }).tap();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expectFittedPage(page, 'stage');

  // The map uses the full width in portrait and most of it in landscape.
  const viewport = page.viewportSize()!;
  const canvas = (await page.locator('.town__canvas').boundingBox())!;
  const landscape = viewport.width > viewport.height;
  expect(canvas.width).toBeGreaterThan(viewport.width * (landscape ? 0.55 : 0.85));
  expect(canvas.height).toBeGreaterThan(viewport.height * 0.4);

  for (const pipe of stage1.pipes) {
    const dn = stage1.reference.diameters[pipe.id]!;
    if (dn === pipe.initialDN) continue;
    await tapPipe(page, pipe.id);
    // On tablets the picker is in the calculation panel (bottom sheet or side panel).
    const picker = page.getByRole('group', { name: `Diâmetro nominal do trecho ${pipe.id}` });
    await expect(picker.first()).toBeVisible();
    await picker
      .first()
      .getByRole('button', { name: new RegExp(`^DN ${dn},`) })
      .tap();
    const collapse = page.getByRole('button', { name: 'Recolher painel' });
    if (await collapse.isVisible()) {
      await collapse.tap();
      await page.waitForTimeout(400);
    }
  }
  await page
    .getByRole('button', { name: /Calcular \/ Verificar|Recalcular/ })
    .first()
    .tap();
  // Portrait has the bottom sheet (closed after a pass); landscape shows the panel beside the map.
  const sheet = page.locator('section.sheet[data-detent]');
  if ((await sheet.count()) > 0) {
    await page.locator('.sheet__handle').tap();
    await sheet.getByRole('button', { name: 'Verificações', exact: true }).tap();
  }
  await expect(page.getByText('Aprovado').first()).toBeVisible();
  if ((await sheet.count()) > 0) await page.getByRole('button', { name: 'Recolher painel' }).tap();
  await expectFittedPage(page, 'stage after the result');

  for (const tab of ['Tabela', '3D', 'Rede']) {
    await page.getByRole('tab', { name: tab }).tap();
    await expectFittedPage(page, `tab ${tab}`);
  }
});
