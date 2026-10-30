// #70: the visitor points at the plot on the cadastral map and the form gets its parcel number and cadastral area.
// The map and Leaflet load only when the button is pressed. Parcel data: ÚGKK SR cadastral WMS (GetFeatureInfo, CORS open).
const WMS = 'https://kataster.skgeodesy.sk/eskn/services/NR/kn_wms_norm/MapServer/WmsServer';
const LAYERS = '1,2,3,4,5,6,7,8';
const btn = document.getElementById('mapBtn') as HTMLButtonElement | null;
const box = document.getElementById('mapBox');
const place = document.getElementById('askPlace') as HTMLInputElement | null;
const out = document.getElementById('mapOut');

type Parcel = { no: string; area: string; m2: string; kind: string };
function parse(xml: string): Parcel | null {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  for (const f of Array.from(doc.getElementsByTagName('FIELDS'))) {
    const a: Record<string, string> = {};
    for (const at of Array.from(f.attributes)) a[at.name.toLowerCase()] = at.value;
    const k = (p: string) => Object.keys(a).find((x) => x.startsWith(p));
    const no = k('čísloparcely'), area = k('názovkatastrálneho');
    if (no && area) return { no: a[no], area: a[area], m2: a[k('výmera') ?? ''] ?? '', kind: a[k('názovdruhu') ?? ''] ?? '' };
  }
  return null;
}

let opened = false;
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
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap', className: 'osm-muted' }).addTo(map);
  L.tileLayer.wms(WMS, { layers: LAYERS, format: 'image/png', transparent: true, minZoom: 15, maxZoom: 19, attribution: 'Kataster © ÚGKK SR' }).addTo(map);
  const pin = L.circleMarker([0, 0], { radius: 9, color: '#cd191e', weight: 3, fillColor: '#cd191e', fillOpacity: 0.35 });
  map.on('click', async (e: L.LeafletMouseEvent) => {
    if (map.getZoom() < 15) { map.setView(e.latlng, 17); return; }
    pin.setLatLng(e.latlng).addTo(map);
    if (out) out.textContent = 'Hľadám parcelu…';
    const p = L.CRS.EPSG3857.project(e.latlng);
    const q = new URLSearchParams({ SERVICE: 'WMS', REQUEST: 'GetFeatureInfo', VERSION: '1.3.0', LAYERS, QUERY_LAYERS: LAYERS, STYLES: '', CRS: 'EPSG:3857',
      BBOX: [p.x - 1, p.y - 1, p.x + 1, p.y + 1].join(','), WIDTH: '3', HEIGHT: '3', I: '1', J: '1', INFO_FORMAT: 'text/xml' });
    try {
      const r = parse(await (await fetch(`${WMS}?${q}`)).text());
      if (!r) { if (out) out.textContent = 'Tu sme parcelu nenašli. Skúste kliknúť do stredu pozemku.'; return; }
      if (place) { place.dataset.pos = `${e.latlng.lat.toFixed(6)},${e.latlng.lng.toFixed(6)}`; place.value = `parcela ${r.no}, k. ú. ${r.area}`; place.dispatchEvent(new Event('input', { bubbles: true })); }
      // #74: the choice shows on the button itself, so the map can close and the form stays short
      if (btn) { btn.classList.add('is-set'); btn.querySelector('b')!.textContent = `Parcela ${r.no}, k. ú. ${r.area}`; btn.querySelector('small')!.textContent = `${r.m2 ? `${Number(r.m2).toLocaleString('sk-SK')} m² · ` : ''}${r.kind ? r.kind.toLowerCase() : ''} · zmeniť na mape`; }
      if (out) out.textContent = `Parcela ${r.no}, k. ú. ${r.area}${r.m2 ? `, ${Number(r.m2).toLocaleString('sk-SK')} m²` : ''}${r.kind ? `, ${r.kind.toLowerCase()}` : ''}. Doplnené do správy.`;
      setTimeout(() => { if (!box.hidden) btn?.click(); btn?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 1400);
    } catch { if (out) out.textContent = 'Kataster neodpovedá. Napíšte obec a parcelu ručne.'; }
  });
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
  document.getElementById('mapMe')?.addEventListener('click', () => map.locate({ setView: true, maxZoom: 18 }));
});

// #71: links from the hero and the service pages arrive with ?map=1 and find the map already open
if (new URLSearchParams(location.search).get('map') === '1') btn?.click();
