// Cart, checkout, open-now pill and category scroll-spy for the public shop page.
(() => {
  const D = window.SHOP, S = D.s, cart = {}, lang = D.lang;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => { const s = Number.isInteger(+n) ? String(+n) : (+n).toFixed(2); return lang === 'en' ? D.cur + s : lang === 'fr' ? s.replace('.', ',') + ' ' + D.cur : s + ' ' + D.cur; };
  const sub = () => Object.entries(cart).reduce((t, [id, q]) => t + D.items[id].p * q, 0);
  const count = () => Object.values(cart).reduce((a, b) => a + b, 0);
  let mode = 'pickup', placed = null;

  // ---- open now ----
  (function openNow() {
    const pill = $('openpill'); if (!pill || !D.open) return;
    const now = new Date(), idx = (now.getDay() + 6) % 7, h = D.hours[idx];
    const mins = (s) => { const [a, b] = s.split(':').map(Number); return a * 60 + b; };
    const cur = now.getHours() * 60 + now.getMinutes();
    let isOpen = false, until = '';
    if (!h.closed) { const o = mins(h.open), c = mins(h.close); isOpen = c > o ? cur >= o && cur < c : cur >= o || cur < c; until = h.close; }
    pill.classList.toggle('off', !isOpen);
    $('opentxt').textContent = isOpen ? `${S['sh.openNow']} · ${S['sh.until']} ${until}` : S['sh.closed'];
  })();

  // ---- scroll spy for category chips ----
  const chips = [...document.querySelectorAll('#cats .chip')];
  if (chips.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) chips.forEach((c) => c.classList.toggle('on', c.dataset.c === e.target.id)); }), { rootMargin: '-130px 0px -70% 0px' });
    chips.forEach((c) => { const t = document.getElementById(c.dataset.c); if (t) io.observe(t); });
  }

  // ---- cart ----
  function paintSlots() {
    document.querySelectorAll('[data-slot]').forEach((s) => {
      const id = s.dataset.slot, q = cart[id] || 0;
      s.innerHTML = q ? `<span class="step"><button type="button" data-d="-1" data-id="${id}" aria-label="−">−</button><b>${q}</b><button type="button" data-d="1" data-id="${id}" aria-label="+">+</button></span>` : `<button class="add" data-id="${id}" aria-label="${esc(S['sh.add'])}">+</button>`;
    });
    const n = count(), bar = $('bar');
    bar.classList.toggle('show', n > 0);
    $('bc').textContent = `🛒 ${n}`; $('bt').textContent = fmt(sub());
    const h = $('hct'); if (h) h.textContent = n ? `🛒 ${fmt(sub())} · ${n}` : '🛒';
  }
  function change(id, d) { cart[id] = (cart[id] || 0) + d; if (cart[id] <= 0) delete cart[id]; paintSlots(); if ($('sheet').classList.contains('open') && !placed) draw(); }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]'); if (!b || !D.items[b.dataset.id]) return;
    change(b.dataset.id, +(b.dataset.d || 1));
  });
  const sheet = $('sheet'), bk = $('bk'), sin = $('sin');
  let lastFocus;
  function openSheet() { lastFocus = document.activeElement; placed = null; draw(); sheet.classList.add('open'); bk.classList.add('open'); document.body.style.overflow = 'hidden'; const f = sheet.querySelector('button,input'); if (f) f.focus(); }
  function closeSheet() { sheet.classList.remove('open'); bk.classList.remove('open'); document.body.style.overflow = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  bk.onclick = closeSheet;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheet.classList.contains('open')) closeSheet(); });
  $('bar').onclick = openSheet; if ($('hcart')) $('hcart').onclick = openSheet;

  function draw() {
    if (!count()) {
      sin.innerHTML = `<h2>${esc(S['sh.yourOrder'])}<button type="button" class="x" id="cl" aria-label="${esc(S['sh.close'])}">✕</button></h2><p class="muted">${esc(S['sh.empty'])}</p>`;
      $('cl').onclick = closeSheet; return;
    }
    const keep = ['f-name', 'f-phone', 'f-addr', 'f-note'].map((id) => $(id) ? $(id).value : '');
    const del = D.delivery && mode === 'delivery';
    sin.innerHTML = `<h2>${esc(S['sh.yourOrder'])}<button type="button" class="x" id="cl" aria-label="${esc(S['sh.close'])}">✕</button></h2>
      ${Object.entries(cart).map(([id, q]) => `<div class="ln"><span class="n">${esc(D.items[id].n)}</span><span class="step"><button type="button" data-d="-1" data-id="${id}" aria-label="−">−</button><b>${q}</b><button type="button" data-d="1" data-id="${id}" aria-label="+">+</button></span><b class="price" style="min-width:64px;text-align:end">${fmt(D.items[id].p * q)}</b></div>`).join('')}
      ${D.delivery ? `<div class="seg mode" role="group"><button type="button" data-m="pickup" class="${mode === 'pickup' ? 'on' : ''}" aria-pressed="${mode === 'pickup'}">🛍️ ${esc(S['sh.pickup'])}</button><button type="button" data-m="delivery" class="${mode === 'delivery' ? 'on' : ''}" aria-pressed="${mode === 'delivery'}">🛵 ${esc(S['sh.delivery'])}</button></div>` : '<div style="height:12px"></div>'}
      <label class="f">${esc(S['sh.name'])}<input id="f-name" autocomplete="name"></label>
      <label class="f">${esc(S['sh.phone'])}<input id="f-phone" type="tel" dir="ltr" style="text-align:start" autocomplete="tel"></label>
      ${del ? `<label class="f">${esc(S['sh.address'])}<input id="f-addr" autocomplete="street-address"></label>` : ''}
      <label class="f">${esc(S['sh.note'])}<textarea id="f-note" placeholder="${esc(S['sh.notePh'])}"></textarea></label>
      <div class="sum"><div><span>${esc(S['sh.subtotal'])}</span><span>${fmt(sub())}</span></div>${del ? `<div><span>${esc(S['sh.fee'])}</span><span>${fmt(D.fee)}</span></div>` : ''}<div class="tot"><span>${esc(S['sh.total'])}</span><span>${fmt(sub() + (del ? D.fee : 0))}</span></div></div>
      <div class="cash">💵 ${esc(S['sh.cash'])}</div><p class="err" id="err" role="alert"></p>
      <button type="button" class="btn lg block" id="go" style="min-height:60px">${esc(S['sh.place'])} · ${fmt(sub() + (del ? D.fee : 0))}</button>`;
    ['f-name', 'f-phone', 'f-addr', 'f-note'].forEach((id, i) => { if ($(id)) $(id).value = keep[i] || ''; });
    $('cl').onclick = closeSheet;
    sin.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => { mode = b.dataset.m; draw(); });
    $('go').onclick = submit;
  }

  async function submit() {
    const del = D.delivery && mode === 'delivery';
    const body = { customer: $('f-name').value.trim(), phone: $('f-phone').value.trim(), address: del ? $('f-addr').value.trim() : '', note: $('f-note').value.trim(),
      kind: del ? 'delivery' : 'pickup', lines: Object.entries(cart).map(([id, qty]) => ({ id: +id, qty })) };
    const err = (m, el) => { $('err').textContent = '⚠️ ' + m; if (el) { el.classList.add('bad'); el.focus(); } };
    if (!body.customer) return err(S['s.errInfo'], $('f-name'));
    if (!body.phone) return err(S['s.errInfo'], $('f-phone'));
    if (del && !body.address) return err(S['s.errAddr'], $('f-addr'));
    if (del && D.min && sub() < D.min) return err(`${S['s.errMin']} ${fmt(D.min)}`);
    $('go').disabled = true;
    try {
      const r = await fetch(`/api/public/${D.slug}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) { $('go').disabled = false; return err(j.error || 'Error'); }
      placed = { number: j.number, name: body.customer, kind: body.kind, lines: Object.entries(cart).map(([id, q]) => ({ n: D.items[id].n, q })), total: sub() + (del ? D.fee : 0) };
      for (const k in cart) delete cart[k];
      paintSlots(); thanks();
    } catch { $('go').disabled = false; err('Network error'); }
  }
  function thanks() {
    const p = placed;
    sin.innerHTML = `<div class="ty"><div class="ck">✓</div><h2 style="justify-content:center">${esc(S['sh.thanks'].replace('{name}', p.name))}</h2><p class="muted">${esc(S['sh.thanksSub'])}</p>
      <div class="oc"><b>${esc(S['sh.orderNo'])} #${p.number}</b><span>${p.kind === 'delivery' ? '🛵 ' + esc(S['sh.delivery']) : '🛍️ ' + esc(S['sh.pickup'])}</span>
      ${p.lines.map((l) => `<span>${l.q} × ${esc(l.n)}</span>`).join('')}<b class="price">${fmt(p.total)}</b><span class="muted">💵 ${esc(S['sh.cash'])}</span></div>
      <button type="button" class="btn out lg block" id="back" style="color:var(--t)">${esc(S['sh.backMenu'])}</button></div>`;
    $('back').onclick = closeSheet;
  }
  paintSlots();
})();
