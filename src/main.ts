import './request';
import './parcel';
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './style.css';
import { gsap } from 'gsap';
import Lenis from 'lenis';
import film from './film_cuts.json';
import { setNavLogo, updateLogoT } from './logoT';
import { loadLogo, buildAt, nailOf, type Logo } from './logoBuild';
import { prepareCard, buildCardAt, driveCard } from './cardBuild';

// The approved film, cut to the web strip, is scrubbed by the scroll. The page is one timeline: each step gives a
// stretch of film (by cut name and fraction of that cut) a scroll length in vh. A short time over many vh is a hold.
type Cut = { name: string; start: number; end: number; focal: number };
const cuts = film.cuts as Cut[];
const DUR = film.duration;
const cut = (name: string) => cuts.find((c) => c.name === name)!;
const at = (name: string, f: number) => { const c = cut(name); return c.start + (c.end - c.start) * f; };

// [cut, from, to, vh]  ~465 vh of film in five stops (W2, role 13: zostup and klinec shorter, vykop and plan longer)
const STEPS: [string, number, number, number][] = [
  ['kolik', 0, 0.55, 30], ['kolik', 0.55, 1, 15], ['mapa', 0, 1, 45],                                                   // hero + 00
  ['prichod', 0, 1, 25], ['kontroler', 0, 1, 20], ['udery', 0, 1, 22], ['kontrola', 0, 1, 38], ['ziriav', 0, 1, 18],       // 01
  ['vykop', 0, 0.5, 25], ['vykop', 0.5, 1, 15], ['zostup', 0, 1, 30], ['klinec', 0, 1, 50], ['dom', 0, 1, 27], ['dom2', 0, 1, 5], // 02
  ['laser', 0, 1, 30], ['plan', 0, 0.55, 30], ['plan', 0.55, 1, 40],                                                    // 03
];
const CHAPTER_STEP = { k0: 2, k1: 3, k2: 8, k3: 14 };

// Zooms into the red point of a cut: [cut, from, to, scale from, scale to, origin x0, y0, x1, y1] (0..1 of the frame)
const ZOOMS: [string, number, number, number, number, number, number, number, number][] = [
  ['kolik', 0, 0.55, 1, 1.22, 0.52, 0.6, 0.52, 0.6],
  ['mapa', 0.45, 1, 1, 1.55, 0.455, 0.32, 0.455, 0.32],
  ['kontroler', 0, 1, 1, 1.3, 0.62, 0.55, 0.66, 0.5],
  ['kontrola', 0.1, 1, 1, 1.35, 0.5, 0.4, 0.5, 0.4],
  ['klinec', 0, 1, 1, 1.4, 0.647, 0.8, 0.495, 0.8],
  ['plan', 0.55, 1, 1, 2.6, 0.305, 0.472, 0.305, 0.472],
];

// Cards: [element id, cut from, fraction, cut to, fraction]
const CARDS: [string, string, number, string, number][] = [
  ['c0', 'mapa', 0.15, 'mapa', 0.95],
  ['c1', 'prichod', 0.15, 'kontroler', 1],
  ['c2', 'vykop', 0.02, 'vykop', 0.42],                 // only while the excavator is in the frame
  ['c3', 'laser', 0.1, 'plan', 0.3],
];
const HERO_END = at('kolik', 0.9);
// #69 subtitles: the stretches between cards were bare film; each says what the frame shows. [cut from, f, cut to, f, text]
const SUBS: [string, number, string, number, string][] = [
  ['udery', 0.05, 'udery', 1, 'Kolík presne nad bodom z projektu.'],
  ['vykop', 0.45, 'zostup', 1, 'Základy idú presne podľa kolíkov.'],
  ['klinec', 0.05, 'klinec', 1, 'Na betóne: klinec do rohu múru.'],
  ['dom', 0, 'dom2', 1, 'Dom rastie. Ku kolaudácii prídeme znova.'],
  ['plan', 0.3, 'plan', 0.75, 'Výsledok: geometrický plán s vašou parcelou.'],
];
const sub = document.getElementById('sub')!;
let subText = '';
const MEASURE: [number, number] = [at('kontrola', 0.05), at('ziriav', 0.4)];
// Parcel 000/2 on the plan: its corners read off the strip frame at 48.3 s (a 6x crop), in the 16:9 frame.
const PARCEL = [[0.2835, 0.5188], [0.3354, 0.4923], [0.3254, 0.4313], [0.2738, 0.4574]];   // corners 1, 2, 3, 4
const PARCEL_DRAW: [number, number] = [at('plan', 0.78), at('plan', 0.98)];

const $ = (id: string) => document.getElementById(id)!;
const video = $('film') as HTMLVideoElement;
const still = $('still') as HTMLImageElement;
const frame = $('frame');
const narrative = $('narrative');
const nav = $('nav');
const bar = $('bar');
const hero = $('hero');
const measure = $('measure');
const parcelLine = document.getElementById('parcelLine') as unknown as SVGPolylineElement;
const rule = $('rule');
const params = new URLSearchParams(location.search);
const fixedT = params.get('t');
const portrait = window.matchMedia('(max-aspect-ratio: 3/4)').matches;
const narrow = window.matchMedia('(max-width: 860px)').matches;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
let staticMode = reduced || params.get('static') === '1' || Boolean(conn?.saveData) || /(^|-)(2g|3g)$/.test(conn?.effectiveType || '');

const cards = CARDS.map(([id], i) => prepareCard($(id), i + 1, narrow));
cards.forEach((c) => buildCardAt(c, 0));

const fly = document.getElementById('flyT') as unknown as SVGSVGElement;
const flyLetter = document.getElementById('flyLetter') as unknown as SVGPathElement;
const flyNail = document.getElementById('flyNail') as unknown as SVGPathElement;
const LABEL = 'PROMARKT NITRA SK s.r.o.';
const introParam = params.get('intro');
let endLogo: Logo | null = null;
let endP = -1;

// Failsafe: whatever happens with the logo or the script, the intro layer never stays over the page.
setTimeout(() => { document.getElementById('intro')?.remove(); document.documentElement.classList.remove('is-intro'); }, 4500);
loadLogo(document.querySelector('.nav__logo') as HTMLElement, './logo_dark.svg', LABEL).then((l) => {
  if (!l) { $('intro').remove(); return; }
  buildAt(l, 1);
  const n = nailOf(l);
  if (n) setNavLogo(l.svg, n.el);
  runIntro(l.svg);
});
// The light logo of the ending loads only when the visitor gets near it.
new IntersectionObserver((entries, obs) => {
  if (!entries.some((e) => e.isIntersecting)) return;
  obs.disconnect();
  loadLogo($('endLogo'), './logo_light.svg', LABEL).then((l) => { endLogo = l; if (l) buildAt(l, reduced ? 1 : 0); });
}, { rootMargin: '600px 0px' }).observe($('endLogo'));

function seenBefore() {
  try { const s = localStorage.getItem('pm_intro'); localStorage.setItem('pm_intro', '1'); return s === '1'; } catch { return false; }
}

// Intro: the logo is built piece by piece over the first frame, then flies into the nav. At most 2.2 s on the first
// visit, about 1.2 s after that. Plays at the top of the page only; any scroll, touch or key finishes it at once.
async function runIntro(navSvg: SVGSVGElement) {
  const intro = $('intro');
  const skip = (fixedT !== null && introParam === null) || reduced || (introParam === null && window.scrollY > 40);
  if (skip) { intro.remove(); return; }
  const logo = await loadLogo($('introLogo'), './logo_dark.svg', LABEL);
  if (!logo) { intro.remove(); return; }
  if (introParam !== null) { buildAt(logo, parseFloat(introParam)); return; }   // preview hook
  const quick = seenBefore();
  navSvg.style.opacity = '0';
  document.documentElement.classList.add('is-intro');
  const st = { p: 0 };
  const done = () => { intro.remove(); navSvg.style.opacity = '1'; document.documentElement.classList.remove('is-intro'); };
  const tl = gsap.timeline({ onComplete: done });
  tl.to(st, { p: 1, duration: quick ? 0.7 : 1.5, ease: 'none', onUpdate: () => buildAt(logo, st.p) });
  tl.add(() => {
    const a = logo.svg.getBoundingClientRect(), b = navSvg.getBoundingClientRect();
    gsap.to(logo.svg, { x: b.left - a.left, y: b.top - a.top, scale: b.width / a.width, transformOrigin: '0 0', duration: 0.55, ease: 'power3.inOut' });
    gsap.to(intro, { backgroundColor: 'rgba(23,24,26,0)', duration: 0.55, ease: 'power2.inOut' });
  }, '+=0.1');
  tl.to({}, { duration: 0.6 });
  const skipNow = () => { tl.progress(1); };
  window.addEventListener('wheel', skipNow, { once: true, passive: true });
  window.addEventListener('touchstart', skipNow, { once: true, passive: true });
  window.addEventListener('keydown', skipNow, { once: true });
}

// Red laser cross under the nail, measured on the strip (red pixels below mid-height) at these fractions.
const CROSS: [number, number][] = [[0, 0.68], [0.05, 0.67], [0.15, 0.638], [0.3, 0.584], [0.45, 0.541], [0.6, 0.51], [0.75, 0.496], [1, 0.495]];
const crossAt = (f: number) => {
  const k = Math.min(1, Math.max(0, f));
  let i = 0;
  while (i < CROSS.length - 2 && k > CROSS[i + 1][0]) i++;
  const [f0, x0] = CROSS[i], [f1, x1] = CROSS[i + 1];
  return { x: x0 + (x1 - x0) * ((k - f0) / (f1 - f0)), y: 0.797 };
};

// Static mode: 8 still frames instead of the video (reduced motion, data saver, slow network, or no video in 3 s).
const STILLS = (film as unknown as { stills: number[] }).stills;
function stillFor(t: number) {
  let i = 0;
  while (i < STILLS.length - 1 && t > (STILLS[i] + STILLS[i + 1]) / 2) i++;
  return `./stills/${portrait ? 'p' : 'l'}${i + 1}.jpg`;
}
function enterStatic() {
  staticMode = true;
  document.documentElement.classList.add('is-static');
  video.removeAttribute('src');
  video.load();
}
if (staticMode) enterStatic();
else {
  const filmUrl = portrait ? './film_portrait.mp4' : './film_1280.mp4';
  video.src = filmUrl;
  video.load();
  // Smooth scrubbing: a seek into a part of the file that is not downloaded yet waits for the network, and that wait
  // is the stutter people saw on the live site (17 to 26 pictures a second there, about 100 from a local file).
  // So the whole film is fetched once in the background and the player switches to the local copy.
  fetch(filmUrl).then((r) => r.ok ? r.blob() : Promise.reject(r.status)).then((b) => {
    const at = video.currentTime;
    video.src = URL.createObjectURL(b);
    video.addEventListener('loadedmetadata', () => { video.currentTime = at; }, { once: true });
    document.documentElement.classList.add('is-local');
  }).catch(() => { /* the streamed file keeps working */ });
  setTimeout(() => { if (video.readyState < 2 && fixedT === null) enterStatic(); }, 3000);
}
video.addEventListener('loadeddata', () => { frame.style.backgroundImage = 'none'; });

// Scroll geometry: the narrative is the sum of the steps plus one screen for the pinned stage.
const VH = STEPS.reduce((s, x) => s + x[3], 0);
narrative.style.height = `${VH + 100}vh`;
let stepY: number[] = [];
function measureSteps() {
  const unit = window.innerHeight / 100;
  let y = narrative.offsetTop;
  stepY = STEPS.map((s) => { const y0 = y; y += s[3] * unit; return y0; });
  stepY.push(y);
  for (const [id, i] of Object.entries(CHAPTER_STEP)) $(id).style.top = `${stepY[i] - narrative.offsetTop + 1}px`;
}
function timeAt(y: number) {
  if (y <= stepY[0]) return 0;
  for (let i = 0; i < STEPS.length; i++) {
    if (y < stepY[i + 1]) {
      const [c, f0, f1] = STEPS[i];
      const f = (y - stepY[i]) / (stepY[i + 1] - stepY[i]);
      return at(c, f0 + (f1 - f0) * f);
    }
  }
  return DUR;
}
function scrollFor(t: number) {
  for (let i = 0; i < STEPS.length; i++) {
    const [c, f0, f1] = STEPS[i];
    const a = at(c, f0), b = at(c, f1);
    if (t >= a && t <= b) return stepY[i] + (stepY[i + 1] - stepY[i]) * ((t - a) / Math.max(1e-6, b - a));
  }
  return stepY[stepY.length - 1];
}

const ease = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// Portrait strip: map an origin in the 16:9 frame into the portrait crop of that cut.
function originFor(c: Cut, x: number) {
  if (!portrait) return x;
  const w = 608 / 1920;
  const left = Math.min(1 - w, Math.max(0, c.focal - w / 2));
  return clamp01((x - left) / w);
}

function zoomAt(t: number) {
  for (const [c, f0, f1, s0, s1, x0, y0, x1, y1] of ZOOMS) {
    const a = at(c, f0), b = at(c, f1);
    if (t >= cut(c).start && t < cut(c).end) {
      const k = ease(clamp01((t - a) / (b - a)));
      return { s: s0 + (s1 - s0) * k, x: originFor(cut(c), x0 + (x1 - x0) * k), y: y0 + (y1 - y0) * k };
    }
  }
  return { s: 1, x: 0.5, y: 0.5 };
}

// Where a point of the 16:9 frame lands on screen, with object-fit: cover and the zoom.
function toScreen(px: number, py: number, z: { s: number; x: number; y: number }, c: Cut) {
  const vw = video.clientWidth || window.innerWidth, vh = video.clientHeight || window.innerHeight;
  const sw = portrait ? 432 : 1280, sh = portrait ? 768 : 720;
  const k = Math.max(vw / sw, vh / sh), rw = sw * k, rh = sh * k;
  const fx = portrait ? originFor(c, px) : px;
  const x = (vw - rw) / 2 + fx * rw, y = (vh - rh) / 2 + py * rh;
  const ox = z.x * vw, oy = z.y * vh;
  return [ox + (x - ox) * z.s, oy + (y - oy) * z.s];
}

let target = fixedT !== null ? parseFloat(fixedT) : 0;
let shown = target;
let lastStill = '';
function render() {
  shown += (target - shown) * (fixedT !== null ? 1 : 0.2);
  const t = Math.min(DUR - 0.04, Math.max(0, shown));
  if (staticMode) {
    const s = stillFor(t);
    if (s !== lastStill) { lastStill = s; still.src = s; }
  } else {
    // While the film is still downloading, a time that is not buffered shows the nearest still instead of a frozen frame
    let have = document.documentElement.classList.contains('is-local');
    for (let i = 0; !have && i < video.buffered.length; i++) have = t >= video.buffered.start(i) && t <= video.buffered.end(i);
    document.documentElement.classList.toggle('is-gap', !have);
    if (!have) { const s = stillFor(t); if (s !== lastStill) { lastStill = s; still.src = s; } }
    if (video.readyState >= 1 && !video.seeking && Math.abs(video.currentTime - t) > 1 / 120) video.currentTime = t;
  }

  const z = staticMode ? { s: 1, x: 0.5, y: 0.5 } : zoomAt(t);
  video.style.transformOrigin = `${(z.x * 100).toFixed(2)}% ${(z.y * 100).toFixed(2)}%`;
  video.style.transform = `scale(${z.s.toFixed(4)})`;

  hero.style.opacity = String(1 - clamp01((t - HERO_END + 0.4) / 0.4));
  hero.parentElement!.style.setProperty('--scrim', hero.style.opacity); // #42: the scrim leaves with the hero
  hero.style.visibility = t > HERO_END ? 'hidden' : 'visible';
  CARDS.forEach(([, c0, f0, c1, f1], i) => driveCard(cards[i], t > at(c0, f0) && t < at(c1, f1), reduced));
  measure.classList.toggle('is-on', t > MEASURE[0] && t < MEASURE[1]);
  const sNow = staticMode ? undefined : SUBS.find(([c0, f0, c1, f1]) => t > at(c0, f0) && t < at(c1, f1));
  const sText = sNow ? sNow[4] : '';
  if (sText !== subText) { subText = sText; if (sText) sub.textContent = sText; sub.classList.toggle('is-on', Boolean(sText)); }

  // Ending: the outline of parcel 000/2 is drawn over the plan, then carries on as the top rule of Kontakt.
  const pd = staticMode ? 0 : clamp01((t - PARCEL_DRAW[0]) / (PARCEL_DRAW[1] - PARCEL_DRAW[0]));
  if (pd > 0) {
    const pc = cut('plan');
    const pts = [...PARCEL, PARCEL[0]].map(([x, y]) => toScreen(x, y, z, pc));
    parcelLine.setAttribute('points', pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' '));
    const len = pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
    parcelLine.style.strokeDasharray = `${len}`;
    parcelLine.style.strokeDashoffset = `${(len * (1 - pd)).toFixed(1)}`;
  }
  parcelLine.style.visibility = pd > 0 ? 'visible' : 'hidden';
  const rr = rule.getBoundingClientRect();
  rule.style.transform = `scaleX(${clamp01((window.innerHeight - rr.top) / (window.innerHeight * 0.5)).toFixed(3)})`;

  if (endLogo && !reduced) {
    const r = endLogo.svg.getBoundingClientRect();
    const p = Math.round(clamp01((window.innerHeight - r.top) / (window.innerHeight * 0.6)) * 500) / 500;
    if (p !== endP) { endP = p; buildAt(endLogo, p); }
  }
  const kc = cut('klinec');
  const kf = (t - kc.start) / (kc.end - kc.start);
  const cr = crossAt(kf);
  if (!staticMode) updateLogoT(kf, { x: originFor(kc, cr.x), y: cr.y }, video, z, fly, flyLetter, flyNail);
  bar.style.transform = `scaleX(${(t / DUR).toFixed(4)})`;
  bar.parentElement!.style.opacity = t >= DUR - 0.06 ? '0' : '1';
}

// Gallery: a native dialog; "Pozrieť vo filme" scrolls to that moment of the film.
const lightbox = $('lightbox') as HTMLDialogElement;
let lbTime = 0;
let lenisRef: Lenis | null = null;
document.querySelectorAll<HTMLButtonElement>('#galGrid button').forEach((b) => {
  b.addEventListener('click', () => {
    const img = b.querySelector('img')!;
    ($('lbImg') as HTMLImageElement).src = img.src.replace('.jpg', '_l.jpg');
    ($('lbImg') as HTMLImageElement).alt = img.alt;
    $('lbCap').textContent = img.alt;
    lbTime = (film as unknown as { gallery: number[] }).gallery[Number(b.dataset.i || 0)];
    lightbox.showModal();
  });
});
$('lbClose').addEventListener('click', () => lightbox.close());
$('lbFilm').addEventListener('click', () => {
  lightbox.close();
  const y = scrollFor(lbTime);
  if (lenisRef) lenisRef.scrollTo(y); else window.scrollTo(0, y);
});

if (fixedT !== null) {
  // Preview hook: freeze the film at one time (used for screenshots).
  document.body.classList.add('shot');
  measureSteps();
  gsap.ticker.add(render);
} else {
  const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenisRef = lenis;
  lenis.on('scroll', ({ scroll }: { scroll: number }) => {
    nav.classList.toggle('is-stuck', scroll > 40);
    target = timeAt(scroll);
  });
  gsap.ticker.add((time) => { lenis.raf(time * 1000); render(); });
  gsap.ticker.lagSmoothing(0);

  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const el = id && id !== '#' ? document.querySelector(id) : null;
      if (el) { e.preventDefault(); lenis.scrollTo(el as HTMLElement, { offset: id === '#kontakt' ? -56 : 0 }); }
    });
  });
  measureSteps();
  window.addEventListener('resize', measureSteps);
  window.addEventListener('load', measureSteps);
}

// #2: the scroll cue goes away once the visitor has scrolled
window.addEventListener('scroll', () => { document.getElementById('cue')?.classList.toggle('is-gone', window.scrollY > 40); }, { passive: true });
