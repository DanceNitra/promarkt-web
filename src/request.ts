import qrcode from 'qrcode-generator';
// #61: Slovak diacritics in the QR text must be UTF-8 bytes; the library default is one byte per character.
// The ESM build has no stringToBytesFuncs (that broke this whole file in #60), so encode with TextEncoder.
try { (qrcode as unknown as { stringToBytes: (s: string) => number[] }).stringToBytes = (s: string) => Array.from(new TextEncoder().encode(s)); } catch { /* keep the default */ }
// Contact request: the visitor picks a service and a place, and the SMS to the surveyor is prefilled.
// No server involved: the button opens the phone's own messages app.
const NUMBER = '+421905292511';
const form = document.getElementById('ask') as HTMLFormElement | null;
const place = document.getElementById('askPlace') as HTMLInputElement | null;
const send = document.getElementById('askSend') as HTMLAnchorElement | null;
const preview = document.getElementById('askPreview');

function text(): string {
  const svc = form?.querySelector<HTMLInputElement>('input[name="svc"]:checked')?.value ?? 'vytýčenie stavby';
  const where = place?.value.trim();
  // #75: a plot picked on the map travels as a cadastral map link, so the surveyor sees the exact spot
  const pos = place?.dataset.pos;
  return `Dobrý deň, potrebujem ${svc}${where ? `, ${where}` : ''}. Prosím o cenu a termín.${pos ? ` Mapa: https://zbgis.skgeodesy.sk/mapka/sk/kataster?pos=${pos},19` : ''}`;
}

function update(): void {
  if (!send || !preview) return;
  const body = text();
  send.href = `sms:${NUMBER}?&body=${encodeURIComponent(body)}`;
  // #87: the preview looks like the SMS it becomes, and the long map link reads as what it is
  preview.innerHTML = '';
  const who = document.createElement('span'); who.className = 'bubble__to'; who.textContent = 'SMS pre: Geodet · 0905 292 511';
  const msg = document.createElement('span'); msg.className = 'bubble'; msg.textContent = body.replace(/ Mapa: https:\/\/\S+/, '');
  if (/ Mapa: https:/.test(body)) { const m = document.createElement('span'); m.className = 'bubble__link'; m.textContent = 'odkaz na parcelu v mape katastra'; msg.append(' ', m); }
  preview.append(who, msg);
  // #94: once a place is known, the phone's bottom bar sends the finished message instead of scrolling to the form
  const bar = document.querySelector<HTMLAnchorElement>('#callbar a[href="#ask"], #callbar a.is-ready');
  if (bar) {
    const ready = Boolean(place?.value.trim());
    bar.classList.toggle('is-ready', ready);
    bar.href = ready ? send.href : '#ask';
    bar.textContent = ready ? 'Poslať SMS ✓' : 'Napísať';
  }
}

form?.addEventListener('input', (e) => { if (e.isTrusted && e.target === place && place) delete place.dataset.pos; update(); });
form?.addEventListener('submit', (e) => e.preventDefault());
update();

// #9: on a desktop there is nothing to dial, so the number can be copied
const copy = document.getElementById('copyNum') as HTMLButtonElement | null;
copy?.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText('0905 292 511'); copy.textContent = 'Skopírované'; }
  catch { copy.textContent = '0905 292 511'; }
  setTimeout(() => { copy.textContent = 'Skopírovať číslo'; }, 2200);
});

// #10: gallery tiles and questions rise in once, when they come into view
const io = 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches
  ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io?.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' })
  : null;
document.querySelectorAll('.gallery__grid li, .faq details').forEach((el, i) => {
  if (!io) return;
  (el as HTMLElement).style.setProperty('--d', `${(i % 3) * 70}ms`);
  el.classList.add('rise');
  io.observe(el);
});

// #15: the choice and the place survive a reload
try {
  const saved = JSON.parse(sessionStorage.getItem('ask') || 'null');
  if (saved && form) {
    const r = form.querySelector<HTMLInputElement>(`input[name="svc"][value="${CSS.escape(saved.svc)}"]`);
    if (r) r.checked = true;
    if (place && typeof saved.place === 'string') place.value = saved.place;
    update();
  }
} catch { /* storage can be blocked */ }
form?.addEventListener('input', () => {
  try { sessionStorage.setItem('ask', JSON.stringify({ svc: form.querySelector<HTMLInputElement>('input[name="svc"]:checked')?.value, place: place?.value ?? '' })); } catch { /* ignore */ }
});

// #16: arrow keys move through the gallery while a picture is open
// #66: the same step is reached by a swipe on a phone
function lbStep(dir: 1 | -1): void {
  const dlg = document.getElementById('lightbox') as HTMLDialogElement | null;
  if (!dlg?.open) return;
  const btns = [...document.querySelectorAll<HTMLButtonElement>('#galGrid button')];
  const cur = btns.findIndex((b) => b.querySelector('img')!.src.replace('.jpg', '_l.jpg') === (document.getElementById('lbImg') as HTMLImageElement).src);
  const next = btns[(cur + dir + btns.length) % btns.length];
  dlg.close();
  next.click();
}
let sx = 0;
document.getElementById('lightbox')?.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
document.getElementById('lightbox')?.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - sx;
  if (Math.abs(dx) > 50) lbStep(dx < 0 ? 1 : -1);
}, { passive: true });
document.addEventListener('keydown', (e) => {
  const dlg = document.getElementById('lightbox') as HTMLDialogElement | null;
  if (!dlg?.open || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
  const btns = [...document.querySelectorAll<HTMLButtonElement>('#galGrid button')];
  const cur = btns.findIndex((b) => b.querySelector('img')!.src.replace('.jpg', '_l.jpg') === (document.getElementById('lbImg') as HTMLImageElement).src);
  const next = btns[(cur + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length];
  dlg.close();
  next.click();
});

// #22: a link such as ./?s=geometrický plán#ask opens the form with that service chosen
try {
  const wanted = new URLSearchParams(location.search).get('s');
  const r = wanted && form?.querySelector<HTMLInputElement>(`input[name="svc"][value="${CSS.escape(wanted)}"]`);
  if (r) { r.checked = true; update(); }
} catch { /* ignore */ }

// #23 + #35: the chapter on screen is named, and a call to action offers exactly that service.
// The last chapter seen stays active between cards, so the offer never disappears mid-film.
const chap = document.getElementById('chap');
const fcta = document.getElementById('filmCta') as HTMLAnchorElement | null;
if (chap) {
  const S = (v: string) => `./?s=${encodeURIComponent(v)}#ask`;
  const names: [string, string, string, string][] = [
    ['c0', '00 Hranica pozemku', 'Vytýčiť moju hranicu', S('vytýčenie hranice pozemku')],
    ['c1', '01 Vytýčenie stavby', 'Vytýčiť môj dom', S('vytýčenie stavby')],
    ['c2', '02 Základy', 'Vytýčiť moje základy', S('vytýčenie stavby')],
    ['c3', '03 Geometrický plán', 'Objednať geometrický plán', S('geometrický plán')],
  ];
  // #37: the chapter comes from the chapter anchors that main.ts places in the scroll, not from card visibility
  const narrative = document.getElementById('narrative');
  const anchors = ['k0', 'k1', 'k2', 'k3'].map((id) => document.getElementById(id));
  const rail = [...document.querySelectorAll<HTMLAnchorElement>('#rail a')];
  const tick = () => {
    // #48: a visible chapter card wins; between cards the last anchor passed (a small offset, not half a screen)
    const y = window.scrollY + window.innerHeight * 0.1;
    let last = -1;
    anchors.forEach((el, i) => { if (el && el.getBoundingClientRect().top + window.scrollY <= y) last = i; });
    const card = names.findIndex(([id]) => { const c = document.getElementById(id); return !!c && getComputedStyle(c).visibility !== 'hidden' && Number(getComputedStyle(c).opacity) > 0.5; });
    if (card >= 0) last = card;
    // #81: once the film has drawn parcel 000/2 on the plan, the button asks for the visitor's own parcel
    const end = !!narrative && window.scrollY > (narrative.offsetHeight - window.innerHeight) * 0.9;
    const inFilm = !!narrative && window.scrollY < narrative.offsetHeight - window.innerHeight * 1.05 && window.scrollY > window.innerHeight * 0.15;
    rail.forEach((a, i) => a.classList.toggle('is-on', i === last));
    document.getElementById('rail')?.classList.toggle('is-on', inFilm);
    if (fcta) {
      const on = inFilm && last >= 0;
      fcta.classList.toggle('is-on', on);
      if (on && end) { fcta.querySelector('b')!.textContent = 'Ukážte nám svoju parcelu'; fcta.href = './?s=geometrick%C3%BD%20pl%C3%A1n&map=1#ask'; fcta.querySelector('span')!.textContent = 'Mapa katastra'; }
      else if (on) { fcta.querySelector('b')!.textContent = names[last][2]; fcta.href = names[last][3]; fcta.querySelector('span')!.textContent = names[last][1]; }
    }
  };
  setInterval(tick, 250);
}

// #27: where the phone offers sharing, a visitor can pass the surveyor on to someone who needs one
const share = document.getElementById('shareSite') as HTMLButtonElement | null;
if (share && typeof navigator.share === 'function') {
  share.hidden = false;
  share.addEventListener('click', () => { navigator.share({ title: 'Geodet Nitra, PROMARKT NITRA SK', text: 'Geodet Rastislav Drahoš, Nitra a okolie. 0905 292 511', url: location.origin + location.pathname }).catch(() => {}); });
}

// #32: three plain-language buttons choose the service for visitors who do not know the term
document.querySelectorAll<HTMLButtonElement>('#askHelp button') /* #36: row removed, kept harmless */.forEach((b) => {
  b.addEventListener('click', () => {
    const r = form?.querySelector<HTMLInputElement>(`input[name="svc"][value="${CSS.escape(b.dataset.svc || '')}"]`);
    if (r) { r.checked = true; update(); r.dispatchEvent(new Event('input', { bubbles: true })); }
  });
});

// #50: a menu on phones, where the nav links do not fit
const menuBtn = document.getElementById('menuBtn') as HTMLButtonElement | null;
const menu = document.getElementById('menu');
const setMenu = (open: boolean) => { if (!menu || !menuBtn) return; menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); menuBtn.textContent = open ? 'Zavrieť' : 'Menu'; };
menuBtn?.addEventListener('click', () => setMenu(menu?.hidden ?? false));
menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

// #53: from any gallery photo, one button to the form with the matching service chosen
const lbWant = document.getElementById('lbWant') as HTMLAnchorElement | null;
document.querySelectorAll<HTMLButtonElement>('#galGrid button').forEach((b) => {
  b.addEventListener('click', () => {
    const i = Number(b.dataset.i || 0);
    const svc = i <= 3 ? 'vytýčenie stavby' : 'geometrický plán';
    if (lbWant) { lbWant.href = `./?s=${encodeURIComponent(svc)}#ask`; lbWant.textContent = i <= 3 ? 'Chcem vytýčiť stavbu' : 'Chcem geometrický plán'; }
  });
});

// #58: a computer cannot send an SMS, so there the SMS buttons show a QR code that opens the message on the phone
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const dlg = document.createElement('dialog');
  dlg.className = 'qrdlg';
  dlg.innerHTML = '<p class="qrdlg__h">Pošlite SMS z mobilu</p><div class="qrdlg__qr"></div><p class="qrdlg__t">Namierte fotoaparát telefónu na kód. Otvorí sa správa pre <b>0905 292 511</b> s týmto textom:</p><p class="qrdlg__m"></p><div class="qrdlg__bar"><a class="btn" href="tel:+421905292511">Radšej zavolať</a><button type="button" class="act">Zavrieť</button></div>';
  document.body.appendChild(dlg);
  dlg.querySelector('button')!.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('a[href^="sms:"]') as HTMLAnchorElement | null;
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute('href') || 'sms:+421905292511';
    const body = decodeURIComponent((href.split('body=')[1] || ''));
    // #59: phone cameras read the SMSTO: form of an SMS QR code more widely than an sms: link
    const qr = qrcode(0, 'M');
    qr.addData(`SMSTO:+421905292511:${body}`, 'Byte');
    qr.make();
    dlg.querySelector('.qrdlg__qr')!.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    dlg.querySelector('.qrdlg__m')!.textContent = body || 'Dobrý deň, prosím o cenu a termín.';
    dlg.showModal();
  });
}

// #76: a question that is not in the list goes out as an SMS, typed here
const qText = document.getElementById('qText') as HTMLTextAreaElement | null;
const qSend = document.getElementById('qSend') as HTMLAnchorElement | null;
const qUpdate = () => { if (qSend) qSend.href = `sms:${NUMBER}?&body=${encodeURIComponent(`Dobrý deň, mám otázku: ${qText?.value.trim() ?? ''}`)}`; };
qText?.addEventListener('input', qUpdate);
qUpdate();

// #78: the visitor says where the build is; the matching service is named and preselected in the form
const stageBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.where__track button'));
stageBtns.forEach((b) => b.addEventListener('click', () => {
  stageBtns.forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  document.getElementById('stageH')!.textContent = b.dataset.h ?? '';
  document.getElementById('stageP')!.textContent = b.dataset.p ?? '';
  (document.getElementById('stageGo') as HTMLAnchorElement).href = `./?s=${encodeURIComponent(b.dataset.svc ?? '')}#ask`;
}));
document.getElementById('stageGo')?.addEventListener('click', (e) => {
  const svc = new URL((e.currentTarget as HTMLAnchorElement).href).searchParams.get('s');
  const r = document.querySelector<HTMLInputElement>(`input[name="svc"][value="${svc}"]`);
  if (!r) return;
  e.preventDefault();
  r.checked = true; r.dispatchEvent(new Event('input', { bubbles: true }));
  document.getElementById('ask')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
});

// #81: links to this page's own form (?s=…, ?map=1, #ask) no longer reload the 14 MB film; the form is filled in place
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const a = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
  if (!a || a.hash !== '#ask') return;
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin || u.pathname !== location.pathname) return;
  e.preventDefault();
  const svc = u.searchParams.get('s');
  const r = svc ? document.querySelector<HTMLInputElement>(`input[name="svc"][value="${svc}"]`) : null;
  if (r) { r.checked = true; r.dispatchEvent(new Event('input', { bubbles: true })); }
  const mb = document.getElementById('mapBtn');
  if (u.searchParams.get('map') === '1' && mb?.getAttribute('aria-expanded') !== 'true') mb?.click();
  document.getElementById('ask')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
});
