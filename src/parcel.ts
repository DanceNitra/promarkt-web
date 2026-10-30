// #70: the visitor points at the plot on the cadastral map and the form gets its parcel number and cadastral area.
// The map and Leaflet load only when the button is pressed. Parcel data: ÚGKK SR cadastral WMS (GetFeatureInfo, CORS open).
const WMS = 'https://kataster.skgeodesy.sk/eskn/services/NR/kn_wms_norm/MapServer/WmsServer';
const LAYERS = '1,2,3,4,5,6,7,8';
const btn = document.getElementById('mapBtn') as HTMLButtonElement | null;
const box = document.getElementById('mapBox');
import './map.css';
const place = (document.getElementById('askPlace') ?? document.getElementById('mPlace')) as HTMLInputElement | null;
const out = document.getElementById('mapOut');

type Parcel = { no: string; area: string; m2: string; kind: string; ring: number[][] | null };
// #85: GeoJSON instead of XML, so the parcel's own outline comes back with its number (EPSG:3857 metres)
function parse(json: string): Parcel | null {
  const d = JSON.parse(json) as { features?: { properties?: Record<string, string>; geometry?: { type: string; coordinates: number[][][] } }[] };
  for (const f of d.features ?? []) {
    const a: Record<string, string> = {};
    for (const [k, v] of Object.entries(f.properties ?? {})) a[k.toLowerCase().replace(/\s+/g, '')] = String(v);
    const k = (p: string) => Object.keys(a).find((x) => x.startsWith(p));
    const no = k('čísloparcely'), area = k('názovkatastrálneho');
    if (no && area) return { no: a[no], area: a[area], m2: a[k('výmera') ?? ''] ?? '', kind: a[k('názovdruhu') ?? ''] ?? '', ring: f.geometry?.type === 'Polygon' ? f.geometry.coordinates[0] : null };
  }
  return null;
}

let opened = false;
let ready: () => void = () => {};
const mapReady = new Promise<void>((ok) => { ready = ok; });
btn?.addEventListener('click', async () => {
  if (!box) return;
  const show = box.hidden;
  box.hidden = !show;
  btn.setAttribute('aria-expanded', String(show));
  if (!show || opened) return;
  opened = true;
  const L = (await import('leaflet')).default;
  // @ts-expect-error vite resolves CSS imports
  await import('leaflet/dist/leaflet.css');
  const map = L.map('map', { center: [48.3069, 18.0864], zoom: 16, scrollWheelZoom: false });
  // #84: aerial photo by default (people know their plot by its roof and trees), yellow cadastral lines over it; a street map on request
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap', className: 'osm-muted' });
  const orto = L.tileLayer.wms('https://zbgisws.skgeodesy.sk/zbgis_ortofoto_wms/service.svc/get', { layers: '1', format: 'image/jpeg', maxZoom: 19, attribution: 'Ortofoto © GKÚ, NLC' });
  const knNorm = L.tileLayer.wms(WMS, { layers: LAYERS, format: 'image/png', transparent: true, minZoom: 15, maxZoom: 19, attribution: 'Kataster © ÚGKK SR' });
  const knOrto = L.tileLayer.wms(WMS.replace('kn_wms_norm', 'kn_wms_orto'), { layers: LAYERS, format: 'image/png', transparent: true, minZoom: 15, maxZoom: 19, attribution: 'Kataster © ÚGKK SR' });
  const setBase = (air: boolean) => {
    [osm, orto, knNorm, knOrto].forEach((l) => map.removeLayer(l));
    (air ? [orto, knOrto] : [osm, knNorm]).forEach((l) => l.addTo(map));
    document.querySelectorAll<HTMLButtonElement>('.mapbox__base button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.base === 'air') === air)));
  };
  setBase(true);
  document.querySelectorAll<HTMLButtonElement>('.mapbox__base button').forEach((b) => b.addEventListener('click', () => setBase(b.dataset.base === 'air')));
  const outline = L.polygon([], { color: '#cd191e', weight: 4, fillColor: '#cd191e', fillOpacity: 0.22 });
  const pin = L.circleMarker([0, 0], { radius: 9, color: '#cd191e', weight: 3, fillColor: '#cd191e', fillOpacity: 0.35 });
  // #92: the same pick runs for a click and for 'Stojím na pozemku' (the phone's own position)
  const pick = async (e: { latlng: L.LatLng }) => {
    pin.setLatLng(e.latlng).addTo(map);
    if (out) out.textContent = 'Hľadám parcelu…';
    const p = L.CRS.EPSG3857.project(e.latlng);
    const q = new URLSearchParams({ SERVICE: 'WMS', REQUEST: 'GetFeatureInfo', VERSION: '1.3.0', LAYERS, QUERY_LAYERS: LAYERS, STYLES: '', CRS: 'EPSG:3857',
      BBOX: [p.x - 1, p.y - 1, p.x + 1, p.y + 1].join(','), WIDTH: '3', HEIGHT: '3', I: '1', J: '1', INFO_FORMAT: 'application/geo+json' });
    try {
      const r = parse(await (await fetch(`${WMS}?${q}`)).text());
      outline.remove();
      if (r?.ring) {
        outline.setLatLngs(r.ring.map(([x, y]) => L.CRS.EPSG3857.unproject(L.point(x, y)))).addTo(map);
        map.fitBounds(outline.getBounds(), { padding: [30, 30], maxZoom: 19 });
        pin.remove();
      }
      if (!r) { if (out) out.textContent = 'Tu sme parcelu nenašli. Skúste kliknúť do stredu pozemku.'; return; }
      if (place) { place.dataset.pos = `${e.latlng.lat.toFixed(6)},${e.latlng.lng.toFixed(6)}`; place.value = `parcela ${r.no}, k. ú. ${r.area}`; place.dispatchEvent(new Event('input', { bubbles: true })); }
      // #74: the choice shows on the button itself, so the map can close and the form stays short
      try { sessionStorage.setItem('pm_parcel', JSON.stringify({ ...r, ring: null, pos: place?.dataset.pos ?? '' })); } catch { /* private mode */ }
      if (btn) { btn.classList.add('is-set'); btn.querySelector('b')!.textContent = `Parcela ${r.no}, k. ú. ${r.area}`; btn.querySelector('small')!.textContent = `${r.m2 ? `${Number(r.m2).toLocaleString('sk-SK')} m² · ` : ''}${r.kind ? r.kind.toLowerCase() : ''} · zmeniť na mape`; }
      if (out) out.textContent = `Parcela ${r.no}, k. ú. ${r.area}${r.m2 ? `, ${Number(r.m2).toLocaleString('sk-SK')} m²` : ''}${r.kind ? `, ${r.kind.toLowerCase()}` : ''}. Kliknite inam, ak to nie je on.`;
      if (ok) ok.hidden = false; // #86: the visitor confirms the outline; a wrong plot is one more click away, not a closed map
    } catch { if (out) out.textContent = 'Kataster neodpovedá. Napíšte obec a parcelu ručne.'; }
  };
  map.on('click', (e: L.LeafletMouseEvent) => { if (map.getZoom() < 15) { map.setView(e.latlng, 17); return; } pick(e); });
  // #72: jump to a village or street (OpenStreetMap Nominatim, one request per search, Slovakia only)
  const q = document.getElementById('mapQ') as HTMLInputElement | null;
  const find = async () => {
    const v = q?.value.trim(); if (!v) return;
    if (out) out.textContent = 'Hľadám miesto…';
    try {
      // "obec, ulica" as people write it, then "ulica, obec" as OSM indexes it, then the village alone; 1.1 s apart (Nominatim policy)
      const parts = v.split(',').map((x) => x.trim()).filter(Boolean);
      const tries = [...new Set([v, parts.slice().reverse().join(', '), parts[0]])];
      let r: { lat: string; lon: string; addresstype: string }[] = [];
      for (const [i, t] of tries.entries()) {
        if (i) await new Promise((ok) => setTimeout(ok, 1100));
        r = await (await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=sk&accept-language=sk&limit=1&q=${encodeURIComponent(t)}`)).json();
        if (r[0]) break;
      }
      if (!r[0]) { if (out) out.textContent = 'Miesto sme nenašli. Skúste obec bez ulice.'; return; }
      map.setView([+r[0].lat, +r[0].lon], r[0].addresstype === 'city' || r[0].addresstype === 'town' || r[0].addresstype === 'village' ? 16 : 18);
      if (out) out.textContent = 'Teraz kliknite na svoj pozemok.';
    } catch { if (out) out.textContent = 'Vyhľadávanie neodpovedá. Posuňte mapu ručne.'; }
  };
  document.getElementById('mapGo')?.addEventListener('click', find);
  q?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); find(); } });
  const ok = document.getElementById('mapOk') as HTMLButtonElement | null;
  ok?.addEventListener('click', () => { ok.hidden = true; btn?.click(); btn?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });
  ready();
  map.on('locationfound', (e: L.LocationEvent) => { map.setView(e.latlng, 18); pick(e); });
  map.on('locationerror', () => { if (out) out.textContent = 'Polohu sa nepodarilo zistiť. Nájdite pozemok vyhľadaním alebo na mape.'; });
  document.getElementById('mapMe')?.addEventListener('click', () => { if (out) out.textContent = 'Zisťujem polohu telefónu…'; map.locate({ enableHighAccuracy: true, timeout: 15000 }); });
});

// #71: links from the hero and the service pages arrive with ?map=1 and find the map already open
if (new URLSearchParams(location.search).get('map') === '1') btn?.click();

// #93: on a phone, standing on the plot is the fastest start: open the map and locate in one tap
const here = document.getElementById('mapHere');
if (here && matchMedia('(pointer: coarse)').matches && 'geolocation' in navigator) {
  here.hidden = false;
  here.addEventListener('click', async () => {
    if (box?.hidden) btn?.click();
    await mapReady;
    document.getElementById('mapMe')?.click();
    box?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
}

// #95: a parcel picked on one page is still picked on the next (home page and service pages share it for the visit)
function showSet(r: Parcel) {
  if (!btn) return;
  btn.classList.add('is-set');
  btn.querySelector('b')!.textContent = `Parcela ${r.no}, k. ú. ${r.area}`;
  btn.querySelector('small')!.textContent = `${r.m2 ? `${Number(r.m2).toLocaleString('sk-SK')} m² · ` : ''}${r.kind ? r.kind.toLowerCase() : ''} · zmeniť na mape`;
}
try {
  const saved = JSON.parse(sessionStorage.getItem('pm_parcel') || 'null') as (Parcel & { pos: string }) | null;
  const txt = saved ? `parcela ${saved.no}, k. ú. ${saved.area}` : '';
  if (saved && place && (!place.value.trim() || place.value === txt)) {
    place.value = txt;
    if (saved.pos) place.dataset.pos = saved.pos;
    place.dispatchEvent(new Event('input', { bubbles: true }));
    showSet(saved);
  }
} catch { /* private mode */ }
