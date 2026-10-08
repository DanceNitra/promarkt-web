// Logo moment, variant A (owner 8. 10.): while the film holds on the nail in the laser cross, the nail-T of the logo
// leaves the nav, grows and sets its tip on the red cross. Then it
// dissolves into the real nail of the film and the T is back in the logo. Everything is a pure function of film time,
// so scrolling back plays it backwards.

const VB = { x: 835, y: 103, w: 87, h: 110 };      // viewBox of the flying T (logo units)
const TIP = { x: (878.5 - VB.x) / VB.w, y: (208.8 - VB.y) / VB.h };
const LOGO_W = 943;                                  // logo viewBox width

let navSvg: SVGSVGElement | null = null;
let navT: SVGGElement | null = null;
let navOutline: SVGPathElement | null = null;

// The nav logo is the approved nail logo (B2): its T already is the nail with the washer.
export function setNavLogo(svg: SVGSVGElement, nail: SVGGElement) {
  navSvg = svg;
  navT = nail;
  const path = nail.querySelector('path');
  if (!path) return;
  const ns = 'http://www.w3.org/2000/svg';
  navOutline = document.createElementNS(ns, 'path');
  navOutline.setAttribute('d', path.getAttribute('d') || '');
  navOutline.setAttribute('fill', 'none');
  navOutline.setAttribute('stroke', '#DC802D');
  navOutline.setAttribute('stroke-width', '1');
  navOutline.setAttribute('vector-effect', 'non-scaling-stroke');
  navOutline.style.opacity = '0';
  nail.parentElement!.append(navOutline);
}

type Frame = { x: number; y: number };
type Zoom = { s: number; x: number; y: number };

// Where a point of the video frame lands on screen, given object-fit: cover and the current zoom transform.
function frameToScreen(p: Frame, video: HTMLVideoElement, z: Zoom) {
  const vw = video.clientWidth, vh = video.clientHeight;
  const sw = video.videoWidth || 1280, sh = video.videoHeight || 720;
  const k = Math.max(vw / sw, vh / sh);
  const rw = sw * k, rh = sh * k;
  const px = (vw - rw) / 2 + p.x * rw, py = (vh - rh) / 2 + p.y * rh;
  const ox = z.x * vw, oy = z.y * vh;
  return { x: ox + (px - ox) * z.s, y: oy + (py - oy) * z.s };
}

const ease = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export function updateLogoT(k: number, cross: Frame, video: HTMLVideoElement, z: Zoom,
  fly: SVGSVGElement, letter: SVGPathElement, nail: SVGPathElement) {
  // k: 0..1 through the nail cut. 0-0.05 rest, 0.05-0.4 flight, 0.4-0.75 on the nail, 0.75-1 back in the logo.
  if (!navSvg || !navT || !navOutline || k <= 0.05 || k >= 1) {
    fly.style.visibility = 'hidden';
    if (navT) navT.style.opacity = '1';
    if (navOutline) navOutline.style.opacity = '0';
    return;
  }
  const r = navSvg.getBoundingClientRect();
  const sc = r.width / LOGO_W;
  const from = { x: r.left + VB.x * sc, y: r.top + VB.y * sc, w: VB.w * sc };
  const h = Math.max(110, window.innerHeight * 0.2);
  const w = h * VB.w / VB.h;
  const tip = frameToScreen(cross, video, z);
  const to = { x: tip.x - TIP.x * w, y: tip.y - TIP.y * h, w };

  const u = ease(clamp01((k - 0.05) / 0.35));
  const box = { x: lerp(from.x, to.x, u), y: lerp(from.y, to.y, u), w: lerp(from.w, to.w, u) };
  const back = clamp01((k - 0.75) / 0.25);
  const dissolve = 1 - clamp01((k - 0.6) / 0.15);

  fly.style.visibility = k < 0.75 ? 'visible' : 'hidden';
  fly.style.transform = `translate(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px)`;
  fly.style.width = `${box.w.toFixed(1)}px`;
  fly.style.opacity = dissolve.toFixed(3);
  letter.style.opacity = '0';
  nail.style.opacity = '1';
  nail.setAttribute('fill', u < 0.5 ? '#F4F4F2' : '#DC802D');
  navT.style.opacity = back.toFixed(3);
  navOutline.style.opacity = (k < 0.75 ? 1 : 1 - back).toFixed(3);
}
