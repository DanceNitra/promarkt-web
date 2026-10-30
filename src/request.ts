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
