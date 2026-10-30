import { defineConfig } from 'vite';

// Relative base so the built site works from any subpath on GitHub Pages.
// #89: the service pages are built too, so they can load the cadastral map picker.
export default defineConfig({
  base: './',
  build: {
    target: 'esnext', cssMinify: true, modulePreload: { polyfill: false },
    rollupOptions: { input: { main: 'index.html', vytycenie: 'vytycenie-stavby.html', gp: 'geometricky-plan.html', hranica: 'hranica-pozemku.html' } },
  },
});
