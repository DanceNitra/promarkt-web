import { defineConfig, loadEnv, type Plugin } from 'vite';

// #115 phoneGuard: in the <body> of every page, every copy of the phone number becomes a token that src/phone.ts turns
// back into the number in the visitor's browser. Bots that harvest numbers from HTML find none. The <head> keeps it:
// Google reads the number from the JSON-LD and the description.
const S = '⁣';
function phoneGuard(): Plugin {
  return {
    name: 'phone-guard',
    transformIndexHtml(html) {
      const i = html.indexOf('</head>');
      const body = html.slice(i)
        .replace(/\+421 ?905 ?292 ?511/g, `${S}PI${S}`)
        .replace(/0905 292 511/g, `${S}PS${S}`);
      if (/905 ?292 ?511/.test(body)) throw new Error('phone-guard: an unhandled form of the phone number is in the page body');
      return html.slice(0, i) + body;
    },
  };
}

// #115 Content Security Policy as a meta tag (GitHub Pages cannot send headers). Build only: the dev server needs
// inline scripts and a websocket. No inline script is allowed; styles may be inline (GSAP and Leaflet set them).
function csp(env: Record<string, string>): Plugin {
  const lead = env.VITE_LEAD_URL ? new URL(env.VITE_LEAD_URL).origin : '';
  const policy = [
    "default-src 'self'",
    "script-src 'self' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://zbgisws.skgeodesy.sk https://kataster.skgeodesy.sk",
    `connect-src 'self' https://zbgisws.skgeodesy.sk https://kataster.skgeodesy.sk https://nominatim.openstreetmap.org${lead ? ' ' + lead : ''}`,
    "font-src 'self'",
    "media-src 'self' blob:",
    'frame-src https://challenges.cloudflare.com',
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
  return {
    name: 'csp',
    apply: 'build',
    transformIndexHtml(html) {
      const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="strict-origin-when-cross-origin">`;
      const out = html.replace(/<meta charset="utf-8"\s*\/?>/i, (m) => m + meta);
      if (out === html) throw new Error('csp: no <meta charset> to put the policy after');
      return out;
    },
  };
}

// Relative base so the built site works from any subpath on GitHub Pages.
// #89: the service pages are built too, so they can load the cadastral map picker.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [phoneGuard(), csp(loadEnv(mode, process.cwd()))],
  build: {
    target: 'esnext', cssMinify: true, modulePreload: { polyfill: false },
    rollupOptions: { input: { main: 'index.html', vytycenie: 'vytycenie-stavby.html', gp: 'geometricky-plan.html', hranica: 'hranica-pozemku.html', zameranie: 'zameranie-pre-projektanta.html' } },
  },
}));
