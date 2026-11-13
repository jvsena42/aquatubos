import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// Runs in the `phone-layout` project. Checks the fitted maps of every stage at two phone sizes:
// nothing under the overlay controls, every pipe and node id visible, no overlapping labels.

interface StageFile {
  id: string;
  order: number;
  pipes: { id: string }[];
  nodes: { id: string }[];
  reference: { diameters: Record<string, number>; cost: number };
}

const stages: StageFile[] = [1, 2, 3, 4, 5].map((n) =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../src/scenarios/stages/stage${n}.json`, import.meta.url)),
      'utf8',
    ),
  ),
);

/** Completes every stage in IndexedDB so each one opens with its reference design. */
async function seedProgress(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: 'Jogar', exact: true }).waitFor();
  await page.evaluate(
    async (rows) => {
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('aquatubos');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('progress', 'readwrite');
          for (const row of rows) tx.objectStore('progress').put(row);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      });
    },
    stages.map((stage) => ({
      stageId: stage.id,
      completed: true,
      stars: 3,
      bestCost: stage.reference.cost,
      diameters: stage.reference.diameters,
      updatedAt: 1,
    })),
  );
  await page.reload();
  await page.getByRole('button', { name: /^Mapa de etapas/ }).tap();
  await expect(page.getByRole('heading', { name: 'Etapas' })).toBeVisible();
}

interface MapReport {
  underControls: string[];
  overlappingLabels: string[];
  outsideCanvas: string[];
  pipeLabels: string[];
  nodeLabels: string[];
}

/** Reads the boxes of the map that is on screen. */
async function inspectMap(page: Page, canvasSelector: string): Promise<MapReport> {
  return page.evaluate((selector) => {
    const canvas = document.querySelector(selector)!;
    const frame = canvas.getBoundingClientRect();
    const box = (element: Element) => element.getBoundingClientRect();
    const intersects = (a: DOMRect, b: DOMRect) =>
      a.left < b.right - 0.5 &&
      b.left < a.right - 0.5 &&
      a.top < b.bottom - 0.5 &&
      b.top < a.bottom - 0.5;
    const name = (element: Element) =>
      `${element.getAttribute('data-label-kind') ?? element.getAttribute('data-element')}:${
        element.getAttribute('data-label-for') ?? element.getAttribute('data-id')
      }`;

    const controls = Array.from(canvas.querySelectorAll('[data-overlay-control]'));
    const labels = Array.from(canvas.querySelectorAll('[data-label]'));
    // Pipes are lines whose bounding box can cross a corner without the pipe being there, so
    // they are covered by their labels; markers of nodes, reservoirs and pumps are checked.
    const markers = Array.from(
      canvas.querySelectorAll(
        '[data-element="node"], [data-element="reservoir"], [data-element="pump"]',
      ),
    );

    const underControls: string[] = [];
    for (const item of [...labels, ...markers]) {
      if (controls.some((control) => intersects(box(item), box(control)))) {
        underControls.push(name(item));
      }
    }
    const overlappingLabels: string[] = [];
    labels.forEach((a, index) => {
      for (const b of labels.slice(index + 1)) {
        if (intersects(box(a), box(b))) overlappingLabels.push(`${name(a)} × ${name(b)}`);
      }
    });
    const outsideCanvas = labels
      .filter((label) => {
        const b = box(label);
        return (
          b.left < frame.left - 0.5 ||
          b.right > frame.right + 0.5 ||
          b.top < frame.top - 0.5 ||
          b.bottom > frame.bottom + 0.5
        );
      })
      .map(name);
    const ids = (kind: string) =>
      labels
        .filter((label) => label.getAttribute('data-label-kind') === kind)
        .map((label) => label.getAttribute('data-label-for') ?? '');
    return {
      underControls,
      overlappingLabels,
      outsideCanvas,
      pipeLabels: ids('pipe'),
      nodeLabels: ids('node'),
    };
  }, canvasSelector);
}

for (const viewport of [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
]) {
  test.describe(`${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test('fitted maps keep labels and markers clear of the controls', async ({ page }) => {
      await seedProgress(page);
      for (const stage of stages) {
        await page.getByRole('button', { name: new RegExp(`^Etapa ${stage.order}: `) }).tap();
        await page.getByRole('dialog').getByRole('button', { name: 'Continuar' }).tap();
        await expect(page.getByRole('dialog')).toBeHidden();

        for (const [view, canvas] of [
          ['Cidade', '.town__canvas'],
          ['Esquema', '.netview__canvas'],
        ] as const) {
          await page.getByRole('button', { name: view, exact: true }).tap();
          await page.getByRole('button', { name: 'Enquadrar a rede' }).tap();
          await expect(page.locator(`${canvas} [data-label]`).first()).toBeVisible();
          const where = `${stage.id} ${view}`;
          const report = await inspectMap(page, canvas);
          expect(report.underControls, `under the controls, ${where}`).toEqual([]);
          expect(report.overlappingLabels, `overlapping labels, ${where}`).toEqual([]);
          expect(report.outsideCanvas, `labels outside the canvas, ${where}`).toEqual([]);
          expect([...report.pipeLabels].sort(), `pipe ids, ${where}`).toEqual(
            stage.pipes.map((pipe) => pipe.id).sort(),
          );
          expect([...report.nodeLabels].sort(), `node ids, ${where}`).toEqual(
            stage.nodes.map((node) => node.id).sort(),
          );
        }
        await page.getByRole('button', { name: 'Cidade', exact: true }).tap();
        await page.getByRole('button', { name: 'Voltar para a lista de etapas' }).tap();
        await expect(page.getByRole('heading', { name: 'Etapas' })).toBeVisible();
      }
    });
  });
}
