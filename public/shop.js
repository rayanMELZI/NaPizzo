// Cart + checkout on the public shop page.
(() => {
  const D = window.SHOP, S = D.s, cart = {};
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => `${(+n).toFixed(2).replace(/\.00$/, '')} ${D.cur}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sub = () => Object.entries(cart).reduce((t, [id, q]) => t + D.items[id].p * q, 0);
  const count = () => Object.values(cart).reduce((a, b) => a + b, 0);

  function refresh() {
    const b = $('cartbtn');
    b.style.display = count() ? 'flex' : 'none';
    $('cc').textContent = `🛒 ${S['s.cart']} (${count()})`;
    $('ct').textContent = fmt(sub());
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.add');
    if (a) { cart[a.dataset.id] = (cart[a.dataset.id] || 0) + 1; refresh(); a.animate && a.animate([{ transform: 'scale(1.4)' }, { transform: 'scale(1)' }], 200); }
  });
  const sheet = $('sheet'), sin = $('sin');
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.classList.remove('open'); });
  $('cartbtn').onclick = () => { draw(); sheet.classList.add('open'); };

  function draw() {
    if (!count()) { sheet.classList.remove('open'); refresh(); return; }
    const del = D.delivery;
    sin.innerHTML = `<h2>${esc(S['s.yourOrder'])}</h2>
      ${Object.entries(cart).map(([id, q]) => `<div class="q" style="justify-content:space-between;margin:8px 0"><span>${esc(D.items[id].n)}</span>
        <span class="q"><button data-d="-1" data-id="${id}">−</button><b>${q}</b><button data-d="1" data-id="${id}">+</button></span><span>${fmt(D.items[id].p * q)}</span></div>`).join('')}
      <div class="row" style="margin:12px 0">${del ? `<label><input type="radio" name="kind" value="pickup" checked style="width:auto"> ${esc(S['s.pickup'])}</label>
        <label><input type="radio" name="kind" value="delivery" style="width:auto"> ${esc(S['s.delivery'])}${D.fee ? ` (+${fmt(D.fee)})` : ''}</label>` : `<b>${esc(S['s.pickup'])}</b>`}</div>
      <input id="f-name" placeholder="${esc(S['s.name'])}" autocomplete="name">
      <input id="f-phone" type="tel" placeholder="${esc(S['s.phone'])}" autocomplete="tel">
      <input id="f-addr" placeholder="${esc(S['s.address'])}" style="display:none">
      <textarea id="f-note" rows="2" placeholder="${esc(S['s.note'])}"></textarea>
      <p id="tot" style="font-size:1.2em"></p><p style="opacity:.7;margin-top:0">💵 ${esc(S['s.payCash'])}</p>
      <p id="err" style="color:#c00"></p><button class="btn" id="go" style="width:100%">${esc(S['s.place'])}</button>`;
    const total = () => {
      const isDel = (sin.querySelector('[name=kind]:checked') || {}).value === 'delivery';
      $('f-addr').style.display = isDel ? '' : 'none';
      $('tot').innerHTML = `${esc(S['s.total'])}: <b>${fmt(sub() + (isDel ? D.fee : 0))}</b>`;
      return isDel;
    };
    total();
    sin.querySelectorAll('[name=kind]').forEach((r) => r.addEventListener('change', total));
    sin.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => {
      cart[b.dataset.id] += +b.dataset.d; if (cart[b.dataset.id] <= 0) delete cart[b.dataset.id]; refresh(); draw();
    });
    $('go').onclick = async () => {
      const isDel = total();
      const body = { customer: $('f-name').value.trim(), phone: $('f-phone').value.trim(), address: $('f-addr').value.trim(),
        note: $('f-note').value.trim(), kind: isDel ? 'delivery' : 'pickup', lines: Object.entries(cart).map(([id, qty]) => ({ id: +id, qty })) };
      const err = (m) => { $('err').textContent = m; };
      if (!body.customer || !body.phone) return err(S['s.errInfo']);
      if (isDel && !body.address) return err(S['s.errAddr']);
      if (isDel && D.min && sub() < D.min) return err(`${S['s.errMin']} ${fmt(D.min)}`);
      $('go').disabled = true;
      try {
        const r = await fetch(`/api/public/${D.slug}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const j = await r.json();
        if (!r.ok) { $('go').disabled = false; return err(j.error || 'Error'); }
        for (const k in cart) delete cart[k];
        refresh();
        sin.innerHTML = `<div class="ok"><b>✓</b><h2>${esc(S['s.thanks'])}</h2><p>${esc(S['s.orderNo'])} #${j.number}</p><button class="btn" id="cl">OK</button></div>`;
        $('cl').onclick = () => sheet.classList.remove('open');
      } catch { $('go').disabled = false; err('Network error'); }
    };
  }
})();
