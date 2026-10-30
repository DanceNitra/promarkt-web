// PROMARKT lead endpoint. A request must pass, in order: origin allowlist, size limit, per-IP rate limit, honeypot,
// Cloudflare Turnstile ("nie som robot") and field validation. Only then is one Telegram message sent.
export interface Env {
  ALLOWED_ORIGINS: string;
  TURNSTILE_SECRET: string;
  TELEGRAM_TOKEN: string;
  TELEGRAM_CHAT: string;
  LIMIT: { limit(o: { key: string }): Promise<{ success: boolean }> };
  DRY_RUN?: string; // "1" in local tests: everything runs except the Telegram call
}

const SVC = ['vytýčenie stavby', 'geometrický plán', 'vytýčenie hranice pozemku', 'niečo iné'];
const PHONE = /^\+?[0-9 ]{9,16}$/;
const POS = /^-?\d{1,2}\.\d{3,7},-?\d{1,3}\.\d{3,7}$/;

function cors(origin: string, env: Env): Record<string, string> {
  if (!env.ALLOWED_ORIGINS.split(',').includes(origin)) return {};
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' };
}
const json = (body: unknown, status: number, h: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...h } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get('Origin') ?? '';
    const h = cors(origin, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: h['Access-Control-Allow-Origin'] ? 204 : 403, headers: h });
    if (req.method !== 'POST' || new URL(req.url).pathname !== '/lead') return json({ ok: false, error: 'not_found' }, 404, h);
    if (!h['Access-Control-Allow-Origin']) return json({ ok: false, error: 'origin' }, 403, h);
    if (Number(req.headers.get('Content-Length') ?? '0') > 4000) return json({ ok: false, error: 'too_large' }, 413, h);

    const ip = req.headers.get('CF-Connecting-IP') ?? 'local';
    if (!(await env.LIMIT.limit({ key: ip })).success) return json({ ok: false, error: 'rate' }, 429, h);

    let d: Record<string, string>;
    try { d = await req.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400, h); }
    if (d.website) return json({ ok: true }, 200, h); // honeypot filled by a bot: answer like success, send nothing

    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: String(d.token ?? ''), remoteip: ip }),
    }).then((r) => r.json() as Promise<{ success: boolean }>).catch(() => ({ success: false }));
    if (!verify.success) return json({ ok: false, error: 'captcha' }, 403, h);

    const kind = d.kind === 'call' ? 'call' : 'msg';
    const phone = String(d.phone ?? '').trim();
    const svc = SVC.includes(d.svc) ? d.svc : 'niečo iné';
    const place = String(d.place ?? '').slice(0, 200).trim();
    const msg = String(d.msg ?? '').slice(0, 600).trim();
    const pos = POS.test(String(d.pos ?? '')) ? String(d.pos) : '';
    if (!PHONE.test(phone)) return json({ ok: false, error: 'phone' }, 400, h);

    const text = [
      kind === 'call' ? 'ZAVOLAJTE MI SPÄŤ' : 'SPRÁVA ZO STRÁNKY',
      `Telefón: ${phone}`,
      `Služba: ${svc}`,
      place && `Miesto: ${place}`,
      pos && `Mapa: https://zbgis.skgeodesy.sk/mapka/sk/kataster?pos=${pos},19`,
      msg && `Správa: ${msg}`,
    ].filter(Boolean).join('\n');

    if (env.DRY_RUN === '1') return json({ ok: true, dry: text }, 200, h);
    const sent = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT, text, disable_web_page_preview: true }),
    });
    return sent.ok ? json({ ok: true }, 200, h) : json({ ok: false, error: 'deliver' }, 502, h);
  },
};
