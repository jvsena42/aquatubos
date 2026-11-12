import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

interface StageFile {
  id: string;
  order: number;
  title: { pt: string };
  pipes: { id: string; initialDN: number }[];
  features: { hglProfile: boolean; hardyCross: boolean; pumpChart: boolean };
  reference: { diameters: Record<string, number> };
}

const stages: StageFile[] = [1, 2, 3, 4, 5].map((n) =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../src/scenarios/stages/stage${n}.json`, import.meta.url)),
      'utf8',
    ),
  ),
);

async function closeBriefing(page: Page) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
}

async function setDiameter(page: Page, pipeId: string, dn: number) {
  const pipe = page.locator(`[data-element="pipe"][data-id="${pipeId}"]`);
  await pipe.focus();
  await page.keyboard.press('Enter');
  const picker = page.getByRole('group', { name: `Diâmetro nominal do trecho ${pipeId}` }).first();
  await picker.getByRole('button', { name: new RegExp(`^DN ${dn},`) }).click();
}

test('plays the five stages with the reference diameters', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Etapas' })).toBeVisible();
  // Only stage 1 is unlocked at first.
  await expect(page.getByRole('button', { name: /^Etapa 2: .*Bloqueada/ })).toBeDisabled();

  for (const stage of stages) {
    if (stage.order === 1) {
      await page.getByRole('button', { name: new RegExp(`^Etapa 1: ${stage.title.pt}`) }).click();
    }
    await expect(page.getByRole('heading', { level: 1 })).toContainText(stage.title.pt);
    await closeBriefing(page);

    // The initial design fails.
    await expect(page.getByText('Reprovado').first()).toBeVisible();
    await expect(page.locator('[data-element="pipe"]')).toHaveCount(stage.pipes.length);

    for (const pipe of stage.pipes) {
      const dn = stage.reference.diameters[pipe.id];
      if (dn !== undefined && dn !== pipe.initialDN) await setDiameter(page, pipe.id, dn);
    }
    await page.getByRole('button', { name: 'Calcular / Verificar' }).click();
    await expect(page.getByText('Aprovado').first()).toBeVisible();

    // Every tab of the stage renders.
    await page.getByRole('tab', { name: 'Tabela' }).click();
    await expect(page.getByRole('table').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /CSV/ })).toBeVisible();
    if (stage.features.hglProfile) {
      await page.getByRole('tab', { name: 'Perfil' }).click();
      await expect(page.getByRole('tabpanel').locator('svg').first()).toBeVisible();
    }
    if (stage.features.hardyCross) {
      await page.getByRole('tab', { name: 'Hardy Cross' }).click();
      await expect(page.getByRole('tabpanel').getByRole('table').first()).toBeVisible();
    }
    if (stage.features.pumpChart) {
      await page.getByRole('tab', { name: 'Bomba' }).click();
      await expect(page.getByRole('tabpanel').locator('svg').first()).toBeVisible();
    }
    await page.getByRole('tab', { name: '3D' }).click();
    await expect(
      page.getByRole('tabpanel').locator('canvas, [role="status"]').first(),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Rede' }).click();

    if (stage.order < stages.length) {
      await page.getByRole('button', { name: 'Próxima etapa' }).click();
    }
  }

  // Progress survives a reload.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Etapas' })).toBeVisible();
  await expect(page.getByText('Concluída')).toHaveCount(stages.length);
  expect(errors).toEqual([]);
});

test('switches language and theme', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Etapas' })).toBeVisible();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Stages' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('button', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
