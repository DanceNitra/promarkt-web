// #103: a message or a call-back request sent from the page itself, for visitors on a computer or without credit.
// It goes to the lead Worker (worker/src/index.ts), which checks Cloudflare Turnstile, limits each IP address and
// forwards one Telegram message. Both buttons stay hidden until the build is given the Worker URL and the site key.
const LEAD_URL = import.meta.env.VITE_LEAD_URL as string | undefined;
const SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY as string | undefined;

type Turnstile = { render(el: HTMLElement, o: Record<string, unknown>): string; reset(id?: string): void };
const tw = () => (window as unknown as { turnstile?: Turnstile }).turnstile;

const box = document.getElementById('lead');
if (box && LEAD_URL && SITEKEY) {
  box.hidden = false;
  const dlg = document.getElementById('leadDlg') as HTMLDialogElement;
  const form = dlg.querySelector('form')!;
  const head = dlg.querySelector('.lead__h')!;
  const phone = dlg.querySelector<HTMLInputElement>('#leadPhone')!;
  const msg = dlg.querySelector<HTMLTextAreaElement>('#leadMsg')!;
  const status = dlg.querySelector('.lead__status')!;
  const send = dlg.querySelector<HTMLButtonElement>('.lead__send')!;
  let kind: 'msg' | 'call' = 'msg';
  let token = '';
  let widget: string | undefined;

  const loadTurnstile = () => new Promise<void>((ok) => {
    if (tw()) return ok();
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.onload = () => ok();
    document.head.appendChild(s);
  });

  const open = async (k: 'msg' | 'call') => {
    kind = k;
    head.textContent = k === 'call' ? 'Zavoláme vám späť' : 'Pošlite správu priamo zo stránky';
    msg.closest('label')!.hidden = k === 'call';
    msg.value = (document.getElementById('askPreview')?.querySelector('.bubble')?.textContent ?? '').trim();
    send.textContent = k === 'call' ? 'Chcem, aby ste mi zavolali' : 'Odoslať správu';
    status.textContent = '';
    send.disabled = true;
    dlg.showModal();
    await loadTurnstile();
    const el = dlg.querySelector<HTMLElement>('.lead__captcha')!;
    if (widget === undefined) {
      widget = tw()!.render(el, { sitekey: SITEKEY, language: 'sk', callback: (t: string) => { token = t; send.disabled = false; }, 'expired-callback': () => { token = ''; send.disabled = true; } });
    } else tw()!.reset(widget);
  };
  document.getElementById('leadMsgBtn')?.addEventListener('click', () => open('msg'));
  document.getElementById('leadCallBtn')?.addEventListener('click', () => open('call'));
  dlg.querySelector('.lead__close')?.addEventListener('click', () => dlg.close());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const place = document.getElementById('askPlace') as HTMLInputElement | null;
    const body = {
      kind, token, phone: phone.value, msg: kind === 'call' ? '' : msg.value,
      svc: document.querySelector<HTMLInputElement>('input[name="svc"]:checked')?.value ?? '',
      place: place?.value ?? '', pos: place?.dataset.pos ?? '',
      website: (form.querySelector('input[name="website"]') as HTMLInputElement).value,
    };
    send.disabled = true;
    status.textContent = 'Odosielam…';
    const r = await fetch(`${LEAD_URL}/lead`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then((x) => x.json() as Promise<{ ok: boolean; error?: string }>).catch(() => ({ ok: false, error: 'net' }));
    if (r.ok) {
      status.textContent = kind === 'call' ? 'Hotovo. Zavoláme vám čo najskôr.' : 'Hotovo. Správa prišla geodetovi, ozveme sa do 24 hodín.';
      form.classList.add('is-done');
      return;
    }
    const why: Record<string, string> = {
      phone: 'Skontrolujte telefónne číslo.', captcha: 'Overenie „nie som robot“ neprešlo. Skúste ho znova.',
      rate: 'Priveľa pokusov za minútu. Skúste to o chvíľu.', net: 'Spojenie zlyhalo. Zavolajte prosím 0905 292 511.',
    };
    status.textContent = why[r.error ?? ''] ?? 'Nepodarilo sa odoslať. Zavolajte prosím 0905 292 511.';
    token = '';
    if (widget !== undefined) tw()?.reset(widget);
  });
}
