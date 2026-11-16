// #115: the phone number is never written in the page or the bundle as plain text, so address-harvesting bots that read
// HTML or JS find nothing to dial. The build replaces every visible copy with a token (vite.config.ts, phoneGuard), and
// this module puts the real number back in the visitor's browser. The JSON-LD for Google keeps the number on purpose.
const D = [48, 57, 48, 53, 50, 57, 50, 53, 49, 49]; // character codes of the national number, so no digit run appears in the bundle
const digits = D.map((c) => String.fromCharCode(c)).join('');
export const PHONE_SHOW = `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
export const PHONE_INTL = `+421${digits.slice(1)}`;
export const TEL = `tel:${PHONE_INTL}`;
export const SMS = `sms:${PHONE_INTL}`;

// tokens written by the build; they must match vite.config.ts
const TOKENS: [RegExp, string][] = [[/⁣PI⁣/g, PHONE_INTL], [/⁣PS⁣/g, PHONE_SHOW]];
const fix = (s: string) => TOKENS.reduce((a, [re, v]) => a.replace(re, v), s);
const has = (s: string | null) => !!s && s.includes('⁣');

export function revealPhone(root: ParentNode = document) {
  const walk = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) if (has(n.nodeValue)) n.nodeValue = fix(n.nodeValue!);
  root.querySelectorAll('*').forEach((el) => {
    for (const a of Array.from(el.attributes)) if (has(a.value)) el.setAttribute(a.name, fix(a.value));
  });
  document.documentElement.style.setProperty('--phone', `'${PHONE_SHOW}'`);
}

// #115: the site may not be shown inside someone else's frame (clickjacking); GitHub Pages cannot send that header.
if (window.top !== window.self) {
  document.documentElement.style.display = 'none';
  try { window.top!.location.href = window.location.href; } catch { /* the framing page blocks it; the page stays hidden */ }
}

revealPhone();

// forms that only build an SMS never submit (they used onsubmit="return false", which the CSP forbids)
document.querySelectorAll<HTMLFormElement>('form[data-noop]').forEach((f) => f.addEventListener('submit', (e) => e.preventDefault()));
