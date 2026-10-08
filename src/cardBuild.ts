// Cards assemble with the logo's construction logic, quieter and shorter (W2, role 24; owner 8. 10.: "tiez ich asi
// rozanimujeme tou skladackou"): the frame is drawn like a survey line, the paper settles, the tag appears, the
// headline words fly in, the body follows and the red stake square is driven in last. The scroll only triggers it;
// a short tween runs it to the end, so a card is never left half built when the scroll stops.
import { gsap } from 'gsap';

type Word = { el: HTMLElement; dx: number; dy: number; r: number };
export type Card = {
  el: HTMLElement; lines: HTMLElement[]; tag: HTMLElement; words: Word[]; body: HTMLElement; stake: HTMLElement;
  p: number; on: boolean; tween: gsap.core.Tween | null;
};

function rand(i: number) { const x = Math.sin(i * 91.17 + 3.7) * 43758.5453; return x - Math.floor(x); }
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const outCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const outBack = (x: number) => { const c = 1.2; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const driven = (x: number) => (x < 0.7 ? Math.pow(x / 0.7, 2) * 1.08 : 1.08 - 0.08 * outCubic((x - 0.7) / 0.3));
const win = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));

export function prepareCard(el: HTMLElement, seed: number, quiet: boolean): Card {
  const h2 = el.querySelector('h2')!;
  const words = h2.textContent!.trim().split(/\s+/).map((w, i) => {
    const s = document.createElement('span');
    s.className = 'w';
    s.textContent = w;
    return { el: s, dx: quiet ? 0 : (rand(seed * 10 + i) - 0.5) * 48, dy: quiet ? 6 : (rand(seed * 10 + i + 5) - 0.5) * 36, r: quiet ? 0 : (rand(seed * 10 + i + 9) - 0.5) * 16 };
  });
  h2.textContent = '';
  words.forEach((w, i) => { h2.append(w.el); if (i < words.length - 1) h2.append(' '); });
  const lines = ['t', 'r', 'b', 'l'].map((side) => {
    const s = document.createElement('span');
    s.className = `ln ln--${side}`;
    el.append(s);
    return s;
  });
  el.classList.add('card--build');
  return {
    el, lines, words,
    tag: el.querySelector('.card__tag') as HTMLElement,
    body: el.querySelector('h2 + p') as HTMLElement,
    stake: el.querySelector('.card__tag i') as HTMLElement,
    p: 0, on: false, tween: null,
  };
}

export function buildCardAt(c: Card, p: number) {
  c.p = p;
  c.el.style.visibility = p > 0.001 ? 'visible' : 'hidden';
  // frame: top and bottom drawn left to right, sides top to bottom (0 - 0.3)
  c.lines.forEach((ln, i) => {
    const k = outCubic(win(p, i * 0.05, 0.18 + i * 0.05));
    ln.style.transform = i % 2 === 0 ? `scaleX(${k.toFixed(3)})` : `scaleY(${k.toFixed(3)})`;
  });
  c.el.style.setProperty('--paper', win(p, 0.15, 0.35).toFixed(3));
  const tg = win(p, 0.25, 0.45);
  c.tag.style.opacity = tg.toFixed(3);
  c.tag.style.transform = `translateY(${((1 - outCubic(tg)) * 8).toFixed(1)}px)`;
  c.words.forEach((w, i) => {
    const a = 0.3 + (i / Math.max(1, c.words.length)) * 0.3;
    const k = win(p, a, a + 0.22);
    const e = outBack(k), m = 1 - e;
    w.el.style.opacity = clamp01(k * 2.5).toFixed(3);
    w.el.style.transform = `translate(${(w.dx * m).toFixed(1)}px, ${(w.dy * m).toFixed(1)}px) rotate(${(w.r * m).toFixed(1)}deg)`;
  });
  const bd = win(p, 0.6, 0.82);
  c.body.style.opacity = bd.toFixed(3);
  c.body.style.transform = `translateY(${((1 - outCubic(bd)) * 10).toFixed(1)}px)`;
  const st = win(p, 0.82, 1);
  c.stake.style.opacity = clamp01(st * 4).toFixed(3);
  c.stake.style.transform = `translateY(${(-26 * (1 - driven(st))).toFixed(1)}px)`;
}

// Called every frame with whether the card's film window is active; starts a short tween on each change.
export function driveCard(c: Card, on: boolean, reduced: boolean) {
  if (on === c.on) return;
  c.on = on;
  c.tween?.kill();
  const st = { p: c.p };
  if (reduced) {
    c.tween = gsap.to(st, { p: on ? 1 : 0, duration: 0.25, ease: 'none', onUpdate: () => { buildCardAt(c, on ? 1 : 0); c.el.style.opacity = String(st.p); } });
    return;
  }
  c.el.style.opacity = '1';
  c.tween = gsap.to(st, { p: on ? 1 : 0, duration: on ? 0.9 * (1 - c.p) + 0.05 : 0.45 * c.p + 0.05, ease: 'none', onUpdate: () => buildCardAt(c, st.p) });
}
