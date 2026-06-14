// Entry point: boot the app once the DOM is ready.
import { App } from './ui/app.js';

function boot() {
  const root = document.getElementById('app');
  if (!root) {
    console.error('Hockey Fighter: #app root not found');
    return;
  }
  const app = new App(root);
  app.start();
  // Expose for debugging / poking around in the console.
  window.__hockeyFighter = app;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
