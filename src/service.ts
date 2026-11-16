// #115: what the service pages used to do in inline scripts and onclick attributes, moved here so the Content Security
// Policy can forbid every inline script. Loaded by each service page after parcel.ts.
import { SMS } from './phone';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

// header menu (#114)
const btn = $<HTMLButtonElement>('n2Btn');
const menu = $('n2Menu');
if (btn && menu) {
  const set = (open: boolean) => { menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); btn.textContent = open ? 'Zavrieť' : 'Menu'; };
  const eager = () => menu.querySelectorAll('img').forEach((i) => { i.loading = 'eager'; });
  btn.addEventListener('pointerenter', eager);
  btn.addEventListener('focus', eager);
  btn.addEventListener('click', () => { eager(); set(menu.hidden); });
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => set(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target as Node) && e.target !== btn) set(false); });
  // every [data-map] button: close the menu, bring the cadastral map into view and open it (#100)
  document.querySelectorAll<HTMLElement>('[data-map]').forEach((b) => b.addEventListener('click', () => {
    set(false);
    const mapBtn = $<HTMLButtonElement>('mapBtn');
    mapBtn?.scrollIntoView({ block: 'center' });
    if ($('mapBox')?.hidden) mapBtn?.click();
  }));
}

// the small "obec alebo parcela" form writes its text into the SMS (#89)
const place = $<HTMLInputElement>('mPlace');
const send = $<HTMLAnchorElement>('mSend');
if (place && send) {
  const lead = send.dataset.msg ?? 'Dobrý deň, potrebujem geodeta';
  const update = () => {
    const w = place.value.trim(), q = place.dataset.pos;
    send.href = `${SMS}?&body=` + encodeURIComponent(lead + (w ? ', ' + w : '') + '. Prosím o cenu a termín.' + (q ? ' Mapa: https://zbgis.skgeodesy.sk/mapka/sk/kataster?pos=' + q + ',19' : ''));
  };
  place.addEventListener('input', (e) => { if (e.isTrusted) delete place.dataset.pos; update(); });
  update();
}

// no autoplaying loops for visitors who asked for less motion
if (matchMedia('(prefers-reduced-motion: reduce)').matches) document.querySelectorAll('video').forEach((v) => { v.removeAttribute('autoplay'); v.pause(); });
