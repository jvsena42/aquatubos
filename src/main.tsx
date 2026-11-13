import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initPwaInstall } from './pwa/install';
import { registerServiceWorker } from './pwa/register';
import { App } from './ui/App';

// Before rendering: Chromium may fire `beforeinstallprompt` early and only once.
initPwaInstall();

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
