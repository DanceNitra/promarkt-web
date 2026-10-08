// The logo builds itself like a construction site (owner 8. 10.: "napis sa rozlozi a zlozi kusok po kusku"):
// the ground swooshes are drawn first, the letters and the globe fly in from a scattered state one after another,
// and the nail-T is driven in last. The state is a pure function of progress p (0 scattered, 1 assembled), so the
// same code runs as an intro timeline and scrubbed by the scroll at the end of the page, forwards and backwards.

export type Piece = { el: SVGGElement; kind: string; k: number; cx: number; cy: number; x0: number; dx: number; dy: number; r: number };
export type Logo = { svg: SVGSVGElement; pieces: Piece[] };

function rand(i: number) {
  // deterministic per piece, so the scatter looks the same on every visit
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export async function loadLogo(host: HTMLElement, src: string, label: string): Promise<Logo | null> {
  try {
    host.innerHTML = await (await fetch(src)).text();
  } catch {
    return null;
  }
  const svg = host.querySelector('svg');
  if (!svg) return null;
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.style.overflow = 'visible';
  const pieces = Array.from(svg.querySelectorAll<SVGGElement>('g.pc')).map((el, i) => ({
    el,
    kind: (el.getAttribute('class') || '').replace('pc pc--', ''),
    k: Number(el.dataset.k),
    cx: Number(el.dataset.cx),
    cy: Number(el.dataset.cy),
    x0: Number(el.dataset.x0),
    dx: (rand(i) - 0.5) * 520,
    dy: (rand(i + 50) - 0.65) * 380,
    r: (rand(i + 100) - 0.5) * 120,
  }));
  return { svg, pieces };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const outCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const outBack = (x: number) => { const c = 1.6; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
// a nail driven in: falls, overshoots into the slab a little, settles
const driven = (x: number) => (x < 0.7 ? Math.pow(x / 0.7, 2) * 1.06 : 1.06 - 0.06 * outCubic((x - 0.7) / 0.3));

export function buildAt(logo: Logo, p: number) {
  const letters = logo.pieces.filter((q) => q.kind === 'letter' || q.kind === 'globe');
  for (const q of logo.pieces) {
    let a = 0, b = 1;
    if (q.kind === 'swoosh') { a = q.k === 0 ? 0 : 0.06; b = a + 0.3; }
    else if (q.kind === 'nail') { a = 0.8; b = 1; }
    else { const i = letters.indexOf(q); a = 0.12 + (i / letters.length) * 0.5; b = a + 0.2; }
    const t = clamp01((p - a) / (b - a));
    let tf = '';
    let op = 1;
    if (q.kind === 'swoosh') {
      const e = outCubic(t);
      tf = `translate(${q.x0} ${q.cy}) scale(${Math.max(0.001, e).toFixed(4)} 1) translate(${-q.x0} ${-q.cy})`;
      op = t > 0 ? 1 : 0;
    } else if (q.kind === 'nail') {
      const e = driven(t);
      tf = `translate(0 ${(-260 * (1 - e)).toFixed(2)})`;
      op = clamp01(t * 4);
    } else if (q.kind === 'globe') {
      const e = outBack(t);
      const s = 0.3 + 0.7 * e;
      tf = `translate(${q.cx} ${q.cy}) rotate(${(-200 * (1 - outCubic(t))).toFixed(2)}) scale(${s.toFixed(4)}) translate(${-q.cx} ${-q.cy})`;
      op = clamp01(t * 3);
    } else {
      const e = outBack(t);
      const m = 1 - e;
      tf = `translate(${(q.dx * m).toFixed(2)} ${(q.dy * m).toFixed(2)}) rotate(${(q.r * m).toFixed(2)} ${q.cx} ${q.cy})`;
      op = clamp01(t * 2.5);
    }
    q.el.setAttribute('transform', tf);
    q.el.style.opacity = op.toFixed(3);
  }
}

export function nailOf(logo: Logo) {
  return logo.pieces.find((q) => q.kind === 'nail') || null;
}
