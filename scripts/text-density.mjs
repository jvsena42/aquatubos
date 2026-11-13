/**
 * Counts the words visible on the main screens, to keep the default UI short.
 *
 * Needs the production build being served (npm run build && npm run preview), then:
 *   npm run text-density
 *
 * "Visible" means rendered text inside the viewport (innerText of elements that intersect it),
 * with the help popovers and dialogs closed. Stage 2 is opened with its reference design,
 * calculated, and nothing selected.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173/aquatubos/';
const stages = [1, 2, 3, 4, 5].map((n) =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../src/scenarios/stages/stage${n}.json`, import.meta.url)),
      'utf8',
    ),
  ),
);

const profiles = {
  'desktop 1366×860': { viewport: { width: 1366, height: 860 } },
  'phone 390×844': {
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  },
};

/** Words of the text nodes whose element is rendered inside the viewport. */
const countWords = () => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let words = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const element = node.parentElement;
    if (!element || element.closest('[aria-hidden="true"], .visually-hidden, svg title')) continue;
    const style = getComputedStyle(element);
    if (style.visibility === 'hidden' || style.display === 'none') continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const box = range.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    if (box.bottom <= 0 || box.top >= innerHeight || box.right <= 0 || box.left >= innerWidth) {
      continue;
    }
    words += (node.textContent ?? '').trim().split(/\s+/).filter(Boolean).length;
  }
  return words;
};

const browser = await chromium.launch();
const rows = [];
for (const [name, profile] of Object.entries(profiles)) {
  const context = await browser.newContext({
    ...profile,
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(BASE_URL);
  await page.getByRole('button', { name: 'Jogar', exact: true }).waitFor();
  const home = await page.evaluate(countWords);

  // Stage 1 completed so stage 2 is unlocked; stage 2 opens with its reference design.
  await page.evaluate(
    async (data) => {
      await new Promise((resolve, reject) => {
        const open = indexedDB.open('aquatubos');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('progress', 'readwrite');
          for (const row of data) tx.objectStore('progress').put(row);
          tx.oncomplete = () => resolve();
        };
      });
    },
    stages.slice(0, 2).map((stage) => ({
      stageId: stage.id,
      completed: true,
      stars: 3,
      bestCost: stage.reference.cost,
      diameters: stage.reference.diameters,
      updatedAt: 1,
    })),
  );
  await page.reload();
  await page
    .getByRole('button', { name: /^Mapa de etapas|^Continuar/ })
    .first()
    .waitFor();
  const homeProgress = await page.evaluate(countWords);
  await page
    .getByRole('button', { name: /^Mapa de etapas/ })
    .first()
    .click();
  await page.getByRole('heading', { name: 'Etapas' }).waitFor();
  const map = await page.evaluate(countWords);

  await page.getByRole('button', { name: /^Etapa 2: / }).click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const stage = await page.evaluate(countWords);
  rows.push({
    profile: name,
    home,
    'home with progress': homeProgress,
    'stage map': map,
    'stage 2': stage,
  });
  await context.close();
}
await browser.close();
console.table(rows);
