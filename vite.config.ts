import { defineConfig } from 'vite';

// Relative base so the built site works from any subpath on GitHub Pages.
export default defineConfig({
  base: './',
  build: { target: 'esnext', cssMinify: true, modulePreload: { polyfill: false } },
});
