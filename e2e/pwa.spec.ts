import { expect, test } from '@playwright/test';

// Runs in the `pwa` project, the only one that lets the service worker register.
//
// Headless Chromium does not fire `beforeinstallprompt` (it needs a browser UI to install
// into), so installability is checked through its preconditions: a valid manifest with the
// required icons, and an active service worker that controls the page. The in-app install item
// is then exercised with a synthetic `beforeinstallprompt` event.

test('meets the install criteria: manifest, icons and service worker', async ({
  page,
  request,
}) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifestUrl = new URL(href!, page.url());
  const response = await request.get(manifestUrl.toString());
  expect(response.ok()).toBe(true);
  const manifest = (await response.json()) as {
    name: string;
    short_name: string;
    start_url: string;
    scope: string;
    display: string;
    icons: { src: string; sizes: string; type: string; purpose?: string }[];
  };
  expect(manifest.name).toBe('Aquatubos');
  expect(manifest.short_name).toBeTruthy();
  expect(manifest.display).toBe('standalone');
  expect(new URL(manifest.start_url, manifestUrl).pathname).toBe('/aquatubos/');
  expect(new URL(manifest.scope, manifestUrl).pathname).toBe('/aquatubos/');

  const sizes = manifest.icons.map((icon) => icon.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  expect(manifest.icons.some((icon) => icon.purpose?.includes('maskable'))).toBe(true);
  for (const icon of manifest.icons) {
    const iconResponse = await request.get(new URL(icon.src, manifestUrl).toString());
    expect(iconResponse.ok(), icon.src).toBe(true);
    expect(iconResponse.headers()['content-type']).toContain('image/png');
  }

  // The service worker activates on the first visit and controls the page from the next load.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  const controlled = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return {
      active: registration.active?.state,
      scope: registration.scope,
      controller: navigator.serviceWorker.controller !== null,
    };
  });
  expect(controlled.controller).toBe(true);
  expect(['activating', 'activated']).toContain(controlled.active);
  expect(new URL(controlled.scope).pathname).toBe('/aquatubos/');
});

test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect(page.getByRole('button', { name: 'Jogar', exact: true })).toBeVisible();
  // Give the precache time to finish, then cut the network.
  await page.waitForFunction(async () => (await caches.keys()).length > 0);
  await page.waitForTimeout(1500);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Jogar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Jogar', exact: true }).click();
  await page.getByRole('button', { name: /^Etapa 1: / }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('offers "Instalar app" in the menu when the browser allows installing', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('menuitem', { name: 'Como jogar' })).toBeVisible();
  const realPromptFired = (await page.getByRole('menuitem', { name: 'Instalar app' }).count()) > 0;
  await page.keyboard.press('Escape');

  if (!realPromptFired) {
    // Stand in for the browser: same event, with a prompt() the page can call.
    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: string }>;
      };
      event.prompt = () => {
        (window as unknown as { promptShown: boolean }).promptShown = true;
        return Promise.resolve();
      };
      event.userChoice = Promise.resolve({ outcome: 'dismissed' });
      window.dispatchEvent(event);
    });
  }
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Instalar app' }).click();
  if (!realPromptFired) {
    expect(
      await page.evaluate(() => (window as unknown as { promptShown?: boolean }).promptShown),
    ).toBe(true);
    // A prompt can be used once: the item goes away after it.
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('menuitem', { name: 'Instalar app' })).toHaveCount(0);
  }
});
