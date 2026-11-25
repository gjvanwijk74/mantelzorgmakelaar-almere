// Serves the static Astro build and handles the two forms.
// Mail goes out through the Cloudflare send_email binding to verified
// destination addresses (MAIL_TO, MAIL_CC) set in wrangler.jsonc.

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

async function handleForm(request, env, kind) {
  let data;
  try {
    const ct = request.headers.get('content-type') || '';
    data = ct.includes('application/json')
      ? await request.json()
      : Object.fromEntries(await request.formData());
  } catch {
    return json({ ok: false, error: 'invalid' }, 400);
  }

  // Honeypot: bots fill hidden fields, people do not.
  if (data.website) return json({ ok: true });

  const clip = (v, n) => String(v ?? '').trim().slice(0, n);
  let subject, rows;

  if (kind === 'kennismaking') {
    const naam = clip(data.naam, 120);
    const contact = clip(data.contact, 160);
    if (!naam || !contact) return json({ ok: false, error: 'missing' }, 422);
    subject = `Nieuwe aanvraag kennismaking: ${naam}`;
    rows = [
      ['Naam', naam],
      ['Telefoon of e-mail', contact],
      ['Kennismaken via', clip(data.kanaal, 40) || 'niet gekozen'],
      ['Hulpvraag', clip(data.situatie, 3000) || '(niet ingevuld)'],
    ];
  } else {
    const email = clip(data.email, 160);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: 'email' }, 422);
    subject = `Aanmelding gids: ${email}`;
    rows = [['E-mailadres', email]];
  }

  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n') + '\n\nVerstuurd via mantelzorgmakelaar-almere.nl';
  const html =
    '<table cellpadding="6" style="font-family:Arial,sans-serif;font-size:15px">' +
    rows.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v).replace(/\n/g, '<br>')}</td></tr>`).join('') +
    '</table><p style="font-family:Arial,sans-serif;color:#666">Verstuurd via mantelzorgmakelaar-almere.nl</p>';

  const msg = {
    from: { email: env.MAIL_FROM, name: 'Mantelzorgmakelaar Almere' },
    to: env.MAIL_TO,
    subject,
    text,
    html,
  };
  if (env.MAIL_CC) msg.cc = env.MAIL_CC;
  const contactIsEmail = kind === 'kennismaking' && /@/.test(String(data.contact));
  if (contactIsEmail) msg.replyTo = String(data.contact).trim();
  if (kind === 'gids') msg.replyTo = String(data.email).trim();

  try {
    await env.EMAIL.send(msg);
    return json({ ok: true });
  } catch (err) {
    console.error('mail failed', err && err.code, err && err.message);
    return json({ ok: false, error: 'mail' }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // One canonical host: everything else 301s to it.
    if (url.hostname !== env.CANONICAL_HOST && !url.hostname.endsWith('.workers.dev')) {
      url.hostname = env.CANONICAL_HOST;
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === '/api/kennismaking/' || url.pathname === '/api/kennismaking') {
      if (request.method !== 'POST') return json({ ok: false }, 405);
      return handleForm(request, env, 'kennismaking');
    }
    if (url.pathname === '/api/gids/' || url.pathname === '/api/gids') {
      if (request.method !== 'POST') return json({ ok: false }, 405);
      return handleForm(request, env, 'gids');
    }

    return env.ASSETS.fetch(request);
  },
};
