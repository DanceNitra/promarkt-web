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
  return `Dobrý deň, potrebujem ${svc}${where ? `, ${where}` : ''}. Prosím o cenu a termín.`;
}

function update(): void {
  if (!send || !preview) return;
  const body = text();
  send.href = `sms:${NUMBER}?&body=${encodeURIComponent(body)}`;
  preview.textContent = `Správa: ${body}`;
}

form?.addEventListener('input', update);
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

// #23: the name of the chapter on screen, taken from the visible card
const chap = document.getElementById('chap');
if (chap) {
  const names: [string, string][] = [['c0', '00 Hranica pozemku'], ['c1', '01 Vytýčenie stavby'], ['c2', '02 Základy'], ['c3', '03 Geometrický plán']];
  const tick = () => {
    const on = names.find(([id]) => { const c = document.getElementById(id); return c && getComputedStyle(c).visibility !== 'hidden' && Number(getComputedStyle(c).opacity) > 0.5; });
    chap.textContent = on ? on[1] : '';
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
document.querySelectorAll<HTMLButtonElement>('#askHelp button').forEach((b) => {
  b.addEventListener('click', () => {
    const r = form?.querySelector<HTMLInputElement>(`input[name="svc"][value="${CSS.escape(b.dataset.svc || '')}"]`);
    if (r) { r.checked = true; update(); r.dispatchEvent(new Event('input', { bubbles: true })); }
  });
});
