// Napizzo platform UI (vanilla JS single-page app).
(() => {
  const LANGS = ['en', 'fr', 'ar'];
  const LANG_NAMES = { en: 'English', fr: 'Français', ar: 'العربية' };
  const $app = document.getElementById('app');
  let lang = localStorage.lang || (['fr', 'ar'].includes(navigator.language.slice(0, 2)) ? navigator.language.slice(0, 2) : 'en');
  let me = null, menu = null, orders = [], lastOrderId = 0, poll = null;

  const t = (k, v) => {
    let s = (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;
    if (v) for (const x in v) s = s.replace(`{${x}}`, v[x]);
    return s;
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const toast = (m) => { const e = $('#toast'); e.textContent = m; e.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('show'), 2200); };
  const debounce = (fn, ms) => { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; };

  async function api(method, url, data, raw) {
    const r = await fetch(url, { method, headers: raw ? { 'Content-Type': raw.type } : data ? { 'Content-Type': 'application/json' } : {}, body: raw ? raw : data ? JSON.stringify(data) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || 'error'), { status: r.status });
    return j;
  }
  const errMsg = (e) => t('err.' + e.message) !== 'err.' + e.message ? t('err.' + e.message) : t('err.generic');

  function setLang(l) {
    lang = l; localStorage.lang = l;
    document.documentElement.lang = l; document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    if (me && me.user) api('PUT', '/api/me/lang', { lang: l }).catch(() => {});
  }
  const langSwitch = () => `<div class="lang">${LANGS.map((l) => `<button data-lang="${l}" class="${l === lang ? 'on' : ''}">${LANG_NAMES[l]}</button>`).join('')}</div>`;
  function bindLang() { $$('[data-lang]').forEach((b) => b.onclick = () => { setLang(b.dataset.lang); route(); }); }

  const shopUrl = (s) => `${location.origin}/s/${s.slug}`;
  const loc = (o, shop) => (o && (o[lang] || o[shop.default_lang] || Object.values(o).find(Boolean))) || '';
  const money = (n, shop) => `${(+n).toFixed(2).replace(/\.00$/, '')} ${shop.currency}`;

  // ---------------- routing ----------------
  async function load() { me = await api('GET', '/api/me'); }
  async function route() {
    clearInterval(poll);
    const hash = location.hash.replace(/^#\/?/, '') || '';
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    if (!me) await load();
    if (!me.user) {
      if (hash === 'login' || hash === 'signup') return authView(hash);
      return landing();
    }
    if (hash === 'login' || hash === 'signup' || hash === '') return (location.hash = me.shop ? '#/home' : '#/setup');
    if (!me.shop) return wizard();
    const views = { home, design, menuView, orders: ordersView, settings, billing };
    shell(hash, (views[hash] || home));
  }
  window.addEventListener('hashchange', route);

  // ---------------- landing & auth ----------------
  function topbar() {
    return `<div class="top"><a class="logo" href="#/">🍕 Napizzo</a>${langSwitch()}
      ${me && me.user ? '' : `<a class="btn ghost small" href="#/login">${t('login')}</a>`}</div>`;
  }
  function landing() {
    const plans = me ? null : null;
    $app.innerHTML = `${topbar()}<div class="wrap">
      <section class="hero"><h1>${t('land.title')}</h1><p>${t('land.sub')}</p>
        <a class="btn big" href="#/signup">🚀 ${t('land.cta')}</a><p style="font-size:.9rem;margin-top:1rem">${t('land.nocard')}</p></section>
      <div class="grid">${['page', 'menu', 'orders', 'lang', 'mobile', 'easy'].map((f) => `<div class="card feat">${{ page: '🎨', menu: '📋', orders: '🔔', lang: '🌍', mobile: '📱', easy: '👍' }[f]}<h3>${t('feat.' + f)}</h3><p>${t('feat.' + f + '.d')}</p></div>`).join('')}</div>
      <h2 class="center" style="margin-top:2.5rem">${t('pricing')}</h2>
      <div class="grid" style="max-width:700px;margin:0 auto">
        ${['starter', 'pro'].map((p) => `<div class="card plan ${p === 'pro' ? 'hot' : ''}"><h3>${t('plan.' + p)}</h3><div class="price">$${p === 'pro' ? 19 : 9}<small>/${t('month')}</small></div>
        <ul><li>${t('plan.' + p + '.1')}</li><li>${t('plan.all')}</li><li>${t('plan.' + p + '.2')}</li></ul></div>`).join('')}</div>
      <p class="center"><b>🎁 ${t('trial')}</b></p>
      <p class="center"><a class="btn big" href="#/signup">${t('land.cta')}</a></p></div><footer class="f">© Napizzo</footer>`;
    bindLang();
  }
  function authView(mode) {
    const su = mode === 'signup';
    $app.innerHTML = `${topbar()}<div class="narrow card"><h2>${t(su ? 'signup.title' : 'login.title')}</h2>
      ${su ? `<p>🎁 ${t('trial')}</p>` : ''}
      <form id="f"><label>${t('email')}<input type="email" name="email" required autocomplete="email" autofocus></label>
      <label>${t('password')}${su ? ` <small>(${t('pw.hint')})</small>` : ''}<input type="password" name="password" required minlength="6" autocomplete="${su ? 'new-password' : 'current-password'}"></label>
      <p class="err" id="err"></p><button class="btn big" style="width:100%">${t(su ? 'signup.btn' : 'login.btn')}</button></form>
      <p class="center">${su ? `${t('have.acc')} <a href="#/login">${t('login')}</a>` : `${t('no.acc')} <a href="#/signup">${t('signup')}</a>`}</p></div>`;
    bindLang();
    $('#f').onsubmit = async (e) => {
      e.preventDefault(); const d = Object.fromEntries(new FormData(e.target));
      try { await api('POST', su ? '/api/signup' : '/api/login', { ...d, lang }); me = null; await load(); if (me.user && me.user.lang) setLang(me.user.lang === lang ? lang : lang); location.hash = me.shop ? '#/home' : '#/setup'; route(); }
      catch (x) { $('#err').textContent = errMsg(x); }
    };
  }

  // ---------------- wizard ----------------
  function wizard() {
    const types = me.starters;
    const w = wizard.s || (wizard.s = { step: 1, name: '', type: 'pizzeria', langs: [lang], theme: 'tomato', phone: '' });
    const bar = `<div class="steps">${[1, 2, 3, 4].map((i) => `<i class="${i <= w.step ? 'on' : ''}"></i>`).join('')}</div>`;
    const nav = (back, next, label) => `<p class="err" id="err"></p><div class="row" style="margin-top:1rem">${back ? `<button class="btn ghost" id="back">← ${t('back')}</button>` : ''}<button class="btn big" id="next">${label || t('next')} →</button></div>`;
    let inner = '';
    if (w.step === 1) inner = `<h2>${t('wz.1')}</h2><div class="choices">${types.map((x) => `<button class="choice ${w.type === x ? 'on' : ''}" data-type="${x}"><b>${{ pizzeria: '🍕', burger: '🍔', tacos: '🌮', sandwich: '🥙', other: '🍽️' }[x]}</b>${t('type.' + x)}</button>`).join('')}</div>
      <label style="margin-top:1rem">${t('wz.name')}<input type="text" id="name" value="${esc(w.name)}" placeholder="${t('wz.name.ph')}" maxlength="60"></label>${nav(false)}`;
    if (w.step === 2) inner = `<h2>${t('wz.2')}</h2><p>${t('wz.2.d')}</p><div class="chips">${LANGS.map((l) => `<button class="chip ${w.langs.includes(l) ? 'on' : ''}" data-l="${l}">${LANG_NAMES[l]}</button>`).join('')}</div>${nav(true)}`;
    if (w.step === 3) inner = `<h2>${t('wz.3')}</h2><div class="themes" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">${Object.entries(me.themes).map(([k, th]) => `<button class="theme ${w.theme === k ? 'on' : ''}" data-th="${k}"><div class="swatch" style="background:${th.bg}"><i style="background:${th.primary}"></i><i style="background:${th.accent}"></i><i style="background:${th.card}"></i></div>${t('theme.' + k)}</button>`).join('')}</div>${nav(true)}`;
    if (w.step === 4) inner = `<h2>${t('wz.4')}</h2><p>${t('wz.4.d')}</p><label>${t('phone')}<input type="tel" id="phone" value="${esc(w.phone)}" placeholder="+1 555 000 000"></label>${nav(true, true, '🎉 ' + t('wz.finish'))}`;
    $app.innerHTML = `${topbar()}<div class="narrow card" style="max-width:640px">${bar}${inner}</div>`;
    bindLang();
    $$('[data-type]').forEach((b) => b.onclick = () => { w.type = b.dataset.type; wizard(); });
    $$('[data-th]').forEach((b) => b.onclick = () => { w.theme = b.dataset.th; wizard(); });
    $$('[data-l]').forEach((b) => b.onclick = () => { const l = b.dataset.l; w.langs = w.langs.includes(l) ? w.langs.filter((x) => x !== l) : [...w.langs, l]; if (!w.langs.length) w.langs = [l]; wizard(); });
    if ($('#back')) $('#back').onclick = () => { w.step--; wizard(); };
    $('#next').onclick = async () => {
      if (w.step === 1) { w.name = $('#name').value.trim(); if (!w.name) { $('#err').textContent = t('err.name'); return; } }
      if (w.step === 4) {
        w.phone = $('#phone').value.trim();
        $('#next').disabled = true;
        try { await api('POST', '/api/shop', { ...w, default_lang: w.langs.includes(lang) ? lang : w.langs[0] }); wizard.s = null; me = null; location.hash = '#/home'; route(); }
        catch (x) { $('#err').textContent = errMsg(x); $('#next').disabled = false; }
        return;
      }
      w.step++; wizard();
    };
  }

  // ---------------- dashboard shell ----------------
  function shell(active, view) {
    const items = [['home', '🏠'], ['design', '🎨'], ['menu', '📋'], ['orders', '🔔'], ['settings', '⚙️'], ['billing', '💳']];
    $app.innerHTML = `${topbar()}<div class="shell"><nav class="nav">${items.map(([k, i]) => `<a href="#/${k}" class="${k === active ? 'on' : ''}"><span>${i}</span>${t('nav.' + k)}${k === 'orders' ? '<em class="dot" id="newdot" hidden></em>' : ''}</a>`).join('')}
      <a href="#" id="logout"><span>🚪</span>${t('logout')}</a></nav><main id="main"></main></div>`;
    bindLang();
    $('#logout').onclick = async (e) => { e.preventDefault(); await api('POST', '/api/logout'); me = null; location.hash = '#/'; route(); };
    view($('#main'));
    startPoll(active === 'orders');
  }
  function accessBanner() {
    const s = me.shop;
    if (s.access === 'trial') return `<div class="banner"><div>🎁 <b>${t('trial.left', { n: s.daysLeft })}</b></div><a class="btn small" href="#/billing">${t('subscribe')}</a></div>`;
    if (s.access === 'expired') return `<div class="banner warn"><div>⚠️ <b>${t('expired')}</b></div><a class="btn small" href="#/billing">${t('subscribe')}</a></div>`;
    return '';
  }
  async function startPoll(onOrders) {
    const check = async () => {
      try {
        const { orders: o } = await api('GET', '/api/orders');
        const newest = o.length ? o[0].id : 0;
        const fresh = o.filter((x) => x.status === 'new').length;
        if (lastOrderId && newest > lastOrderId) { beep(); toast('🔔 ' + t('orders.new')); }
        lastOrderId = Math.max(lastOrderId, newest);
        const dot = $('#newdot'); if (dot) { dot.hidden = !fresh; dot.textContent = fresh; }
        if (onOrders && JSON.stringify(o) !== JSON.stringify(orders)) { orders = o; drawOrders(); }
        orders = o;
      } catch {}
    };
    await check(); poll = setInterval(check, 8000);
  }
  function beep() { try { const c = new AudioContext(), o = c.createOscillator(); o.connect(c.destination); o.frequency.value = 880; o.start(); o.stop(c.currentTime + 0.25); } catch {} }

  // ---------------- home ----------------
  function home(el) {
    const s = me.shop, url = shopUrl(s);
    const checks = [[s.address || s.phone, t('chk.contact'), '#/settings'], [true, t('chk.design'), '#/design'], [true, t('chk.menu'), '#/menu'], [s.access === 'paid', t('chk.sub'), '#/billing']];
    el.innerHTML = `${accessBanner()}<div class="card"><h2>🎉 ${t('home.live')}</h2><div class="linkbox"><code>${esc(url)}</code>
      <a class="btn" target="_blank" href="${esc(url)}">👀 ${t('home.open')}</a><button class="btn ghost" id="copy">📋 ${t('home.copy')}</button>
      <a class="btn ghost" target="_blank" href="https://wa.me/?text=${encodeURIComponent(s.name + ' ' + url)}">💬 ${t('home.share')}</a></div></div>
      <div class="grid"><a class="card feat" href="#/design" style="text-decoration:none;color:inherit">🎨<h3>${t('nav.design')}</h3><p>${t('home.design.d')}</p></a>
      <a class="card feat" href="#/menu" style="text-decoration:none;color:inherit">📋<h3>${t('nav.menu')}</h3><p>${t('home.menu.d')}</p></a>
      <a class="card feat" href="#/orders" style="text-decoration:none;color:inherit">🔔<h3>${t('nav.orders')}</h3><p>${t('home.orders.d')}</p></a></div>
      <div class="card"><h3>${t('home.todo')}</h3>${checks.map(([ok, l, h]) => `<p><a href="${h}" style="text-decoration:none;color:inherit">${ok ? '✅' : '⬜'} ${l}</a></p>`).join('')}</div>`;
    $('#copy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(url); toast(t('copied')); };
  }

  // ---------------- design ----------------
  function design(el) {
    const s = me.shop, cfg = s.config, th = cfg.theme;
    const secNames = { hero: t('sec.hero'), menu: t('sec.menu'), about: t('sec.about'), hours: t('sec.hours'), contact: t('sec.contact') };
    el.innerHTML = `${accessBanner()}<div class="editor"><div>
      <div class="card"><h3>🎨 ${t('d.theme')}</h3><div class="themes">${Object.entries(me.themes).map(([k, p]) => `<button class="theme" data-th="${k}"><div class="swatch" style="background:${p.bg}"><i style="background:${p.primary}"></i><i style="background:${p.accent}"></i><i style="background:${p.card}"></i></div>${t('theme.' + k)}</button>`).join('')}</div></div>
      <div class="card"><h3>🖌️ ${t('d.colors')}</h3><div class="row">
        ${[['primary', 'd.primary'], ['accent', 'd.accent'], ['bg', 'd.bg'], ['text', 'd.text']].map(([k, l]) => `<label>${t(l)}<input type="color" data-c="${k}" value="${th[k]}" style="width:100%;height:46px;border:0;background:none"></label>`).join('')}</div>
        <label>${t('d.font')}<select data-f="font">${['modern', 'rounded', 'serif'].map((f) => `<option value="${f}" ${th.font === f ? 'selected' : ''}>${t('font.' + f)}</option>`).join('')}</select></label>
        <label>${t('d.hero')}<select data-f="hero">${['gradient', 'sunset', 'dark'].map((f) => `<option value="${f}" ${th.hero === f ? 'selected' : ''}>${t('hero.' + f)}</option>`).join('')}</select></label>
        <label>${t('d.round')}<input type="range" min="0" max="40" value="${th.radius}" data-f="radius" style="width:100%"></label></div>
      <div class="card"><h3>🖼️ ${t('d.images')}</h3>
        <label>${t('d.logo')}<input type="file" accept="image/*" data-up="logo"></label><label>${t('d.cover')}<input type="file" accept="image/*" data-up="heroImage"></label>
        ${cfg.heroImage ? `<button class="btn ghost small" data-rm="heroImage">${t('d.rm.cover')}</button>` : ''} ${cfg.logo ? `<button class="btn ghost small" data-rm="logo">${t('d.rm.logo')}</button>` : ''}</div>
      <div class="card"><h3>✏️ ${t('d.texts')}</h3>${s.langs.map((l) => `<p><b>${LANG_NAMES[l]}</b></p>
        <input type="text" data-tx="${l}.tagline" value="${esc(cfg.texts?.[l]?.tagline)}" placeholder="${t('d.tagline')}" ${l === 'ar' ? 'dir="rtl"' : ''}>
        <textarea rows="3" data-tx="${l}.about" placeholder="${t('d.about')}" ${l === 'ar' ? 'dir="rtl"' : ''}>${esc(cfg.texts?.[l]?.about)}</textarea>`).join('')}</div>
      <div class="card"><h3>🧩 ${t('d.sections')}</h3>${cfg.sections.map((x, i) => `<div class="sec"><input type="checkbox" class="tg" data-s="${i}" ${x.on ? 'checked' : ''} style="width:1.3rem;height:1.3rem"><b>${secNames[x.id]}</b>
        <button class="btn ghost small" data-mv="${i}:-1" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn ghost small" data-mv="${i}:1" ${i === cfg.sections.length - 1 ? 'disabled' : ''}>↓</button></div>`).join('')}</div>
      </div><div class="preview"><iframe id="pv" src="/s/${s.slug}?preview=1&lang=${s.langs.includes(lang) ? lang : s.default_lang}" title="preview"></iframe></div></div>`;
    const save = debounce(async () => {
      try { const r = await api('PUT', '/api/shop', { config: cfg }); me.shop = r.shop; $('#pv').contentWindow.location.reload(); toast('✓ ' + t('saved')); } catch (e) { toast(errMsg(e)); }
    }, 500);
    const change = (rerender) => { save(); if (rerender) design(el); };
    $$('[data-th]', el).forEach((b) => b.onclick = () => { Object.assign(cfg.theme, me.themes[b.dataset.th]); change(true); });
    $$('[data-c]', el).forEach((i) => i.oninput = () => { cfg.theme[i.dataset.c] = i.value; change(); });
    $$('[data-f]', el).forEach((i) => i.oninput = () => { cfg.theme[i.dataset.f] = i.dataset.f === 'radius' ? +i.value : i.value; change(); });
    $$('[data-tx]', el).forEach((i) => i.oninput = () => { const [l, k] = i.dataset.tx.split('.'); (cfg.texts[l] = cfg.texts[l] || {})[k] = i.value; change(); });
    $$('.tg', el).forEach((i) => i.onchange = () => { cfg.sections[i.dataset.s].on = i.checked; change(); });
    $$('[data-mv]', el).forEach((b) => b.onclick = () => { const [i, d] = b.dataset.mv.split(':').map(Number); [cfg.sections[i], cfg.sections[i + d]] = [cfg.sections[i + d], cfg.sections[i]]; change(true); });
    $$('[data-rm]', el).forEach((b) => b.onclick = () => { cfg[b.dataset.rm] = ''; change(true); });
    $$('[data-up]', el).forEach((i) => i.onchange = async () => { const u = await upload(i.files[0]); if (u) { cfg[i.dataset.up] = u; change(true); } });
  }
  async function upload(file) {
    if (!file) return null;
    try { return (await api('POST', '/api/upload', null, file.slice(0, file.size, file.type))).url; } catch (e) { toast(t('err.upload')); return null; }
  }

  // ---------------- menu ----------------
  async function menuView(el) {
    const s = me.shop; menu = await api('GET', '/api/menu');
    const draw = () => {
      el.innerHTML = `${accessBanner()}<div class="row" style="align-items:center"><h2 style="flex:3;margin:0">📋 ${t('nav.menu')}</h2><button class="btn" id="addcat">＋ ${t('m.addcat')}</button></div>
      ${menu.cats.map((c) => `<div class="cat"><h3>${esc(c.emoji)} ${esc(loc(c.name, s))}</h3><button class="btn ghost small" data-ec="${c.id}">✏️</button><button class="btn small" data-ai="${c.id}">＋ ${t('m.additem')}</button></div>
        ${menu.items.filter((i) => i.category_id === c.id).map((i) => `<div class="it ${i.available ? '' : 'off'}"><div class="th" style="${i.image ? `background-image:url('${esc(i.image)}')` : ''}">${i.image ? '' : esc(c.emoji)}</div>
          <div class="nm"><b>${esc(loc(i.name, s))}</b><small>${esc(loc(i.descr, s))}</small></div><b>${money(i.price, s)}</b>
          <button class="btn ghost small" data-av="${i.id}" title="${t('m.avail')}">${i.available ? '👁️' : '🚫'}</button><button class="btn ghost small" data-ei="${i.id}">✏️</button></div>`).join('') || `<p style="color:var(--mute)">${t('m.empty')}</p>`}`).join('')}`;
      $('#addcat').onclick = () => catForm();
      $$('[data-ec]', el).forEach((b) => b.onclick = () => catForm(menu.cats.find((c) => c.id == b.dataset.ec)));
      $$('[data-ai]', el).forEach((b) => b.onclick = () => itemForm(null, +b.dataset.ai));
      $$('[data-ei]', el).forEach((b) => b.onclick = () => itemForm(menu.items.find((i) => i.id == b.dataset.ei)));
      $$('[data-av]', el).forEach((b) => b.onclick = async () => { const i = menu.items.find((x) => x.id == b.dataset.av); menu = await api('PUT', '/api/items/' + i.id, { available: !i.available }); draw(); });
    };
    const modal = (html) => { const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = `<div class="card">${html}</div>`; document.body.append(m); m.onclick = (e) => { if (e.target === m) m.remove(); }; return m; };
    const names = (obj, key) => s.langs.map((l) => `<label>${LANG_NAMES[l]}<input type="text" data-n="${key}.${l}" value="${esc(obj?.[l])}" ${l === 'ar' ? 'dir="rtl"' : ''}></label>`).join('');
    const collect = (m, key) => Object.fromEntries(s.langs.map((l) => [l, $(`[data-n="${key}.${l}"]`, m).value]));
    function catForm(c) {
      const m = modal(`<h3>${c ? t('m.editcat') : t('m.addcat')}</h3>${names(c?.name, 'name')}<label>${t('m.emoji')}<input type="text" id="emo" value="${esc(c?.emoji || '🍽️')}" maxlength="4"></label>
        <p class="err" id="err"></p><div class="row"><button class="btn" id="ok">${t('save')}</button>${c ? `<button class="btn danger" id="del">🗑️ ${t('delete')}</button>` : ''}<button class="btn ghost" id="no">${t('cancel')}</button></div>`);
      $('#no', m).onclick = () => m.remove();
      $('#ok', m).onclick = async () => { const d = { name: collect(m, 'name'), emoji: $('#emo', m).value }; menu = c ? await api('PUT', '/api/categories/' + c.id, d) : await api('POST', '/api/categories', d); m.remove(); draw(); };
      if (c) $('#del', m).onclick = async () => { if (confirm(t('m.confirm.cat'))) { menu = await api('DELETE', '/api/categories/' + c.id); m.remove(); draw(); } };
    }
    function itemForm(i, catId) {
      let image = i?.image || '';
      const m = modal(`<h3>${i ? t('m.edititem') : t('m.additem')}</h3>${names(i?.name, 'name')}
        <p><b>${t('m.desc')}</b></p>${names(i?.descr, 'descr')}
        <label>${t('m.price')} (${esc(s.currency)})<input type="number" id="pr" min="0" step="0.01" value="${i ? i.price : ''}" inputmode="decimal"></label>
        <label>${t('m.photo')}<input type="file" id="ph" accept="image/*"></label><p id="phs" style="color:var(--mute)">${image ? '✓' : ''}</p>
        <p class="err" id="err"></p><div class="row"><button class="btn" id="ok">${t('save')}</button>${i ? `<button class="btn danger" id="del">🗑️ ${t('delete')}</button>` : ''}<button class="btn ghost" id="no">${t('cancel')}</button></div>`);
      $('#no', m).onclick = () => m.remove();
      $('#ph', m).onchange = async (e) => { const u = await upload(e.target.files[0]); if (u) { image = u; $('#phs', m).textContent = '✓'; } };
      $('#ok', m).onclick = async () => {
        const name = collect(m, 'name'); if (!Object.values(name).some((v) => v.trim())) { $('#err', m).textContent = t('err.name'); return; }
        const d = { name, descr: collect(m, 'descr'), price: $('#pr', m).value || 0, image, category_id: i ? i.category_id : catId };
        try { menu = i ? await api('PUT', '/api/items/' + i.id, d) : await api('POST', '/api/items', d); m.remove(); draw(); } catch (e) { $('#err', m).textContent = errMsg(e); }
      };
      if (i) $('#del', m).onclick = async () => { if (confirm(t('m.confirm.item'))) { menu = await api('DELETE', '/api/items/' + i.id); m.remove(); draw(); } };
    }
    draw();
  }

  // ---------------- orders ----------------
  function ordersView(el) { el.innerHTML = `${accessBanner()}<h2>🔔 ${t('nav.orders')}</h2><div id="ol"></div>`; drawOrders(); }
  function drawOrders() {
    const el = $('#ol'); if (!el) return;
    const s = me.shop;
    const flow = { new: ['preparing', 'cancelled'], preparing: ['ready'], ready: ['done'], done: [], cancelled: [] };
    el.innerHTML = orders.length ? orders.map((o) => `<div class="card ord ${o.status}"><div class="row" style="align-items:center"><h3 style="margin:0">#${o.number} · ${esc(o.customer)}</h3>
      <span class="tag">${t('st.' + o.status)}</span></div>
      <p style="margin:.3rem 0">${o.kind === 'delivery' ? '🛵 ' + t('delivery') + ' — ' + esc(o.address) : '🛍️ ' + t('pickup')} · <a href="tel:${esc(o.phone)}">📞 ${esc(o.phone)}</a> · <small>${new Date(o.created_at).toLocaleString(lang)}</small></p>
      <ul>${o.lines.map((l) => `<li>${l.qty} × ${esc(loc(l.name, s))}</li>`).join('')}</ul>${o.note ? `<p>📝 ${esc(o.note)}</p>` : ''}
      <p><b>${money(o.total, s)}</b> · ${t('cash')}</p>
      <div class="row">${flow[o.status].map((n) => `<button class="btn ${n === 'cancelled' ? 'danger' : ''} small" data-o="${o.id}:${n}">${t('act.' + n)}</button>`).join('')}</div></div>`).join('') : `<div class="card center">😴 ${t('orders.none')}</div>`;
    $$('[data-o]', el).forEach((b) => b.onclick = async () => { const [id, st] = b.dataset.o.split(':'); await api('PUT', '/api/orders/' + id, { status: st }); orders.find((o) => o.id == id).status = st; drawOrders(); });
  }

  // ---------------- settings ----------------
  function settings(el) {
    const s = me.shop, d = { ...s, langs: [...s.langs], hours: s.hours.map((h) => ({ ...h })) };
    const days = [0, 1, 2, 3, 4, 5, 6];
    el.innerHTML = `${accessBanner()}<h2>⚙️ ${t('nav.settings')}</h2>
      <div class="card"><label>${t('set.name')}<input type="text" id="name" value="${esc(d.name)}" maxlength="60"></label>
        <label>${t('set.slug')} <small>/s/…</small><input type="text" id="slug" value="${esc(d.slug)}" pattern="[a-z0-9-]{3,30}"></label>
        <label>${t('set.langs')}</label><div class="chips">${LANGS.map((l) => `<button class="chip ${d.langs.includes(l) ? 'on' : ''}" data-l="${l}">${LANG_NAMES[l]}</button>`).join('')}</div>
        <label>${t('set.deflang')}<select id="dl">${d.langs.map((l) => `<option value="${l}" ${l === d.default_lang ? 'selected' : ''}>${LANG_NAMES[l]}</option>`).join('')}</select></label></div>
      <div class="card"><label>${t('phone')}<input type="tel" id="phone" value="${esc(d.phone)}"></label><label>WhatsApp <small>(+1555…)</small><input type="tel" id="wa" value="${esc(d.whatsapp)}"></label>
        <label>${t('address')}<input type="text" id="addr" value="${esc(d.address)}"></label><label>${t('set.currency')}<input type="text" id="cur" value="${esc(d.currency)}" maxlength="6"></label></div>
      <div class="card"><label class="tog"><input type="checkbox" id="acc" ${d.accepting ? 'checked' : ''}> ${t('set.accepting')}</label>
        <label class="tog"><input type="checkbox" id="del" ${d.delivery ? 'checked' : ''}> ${t('set.delivery')}</label>
        <div class="row"><label>${t('set.fee')}<input type="number" id="fee" min="0" step="0.5" value="${d.delivery_fee}"></label><label>${t('set.min')}<input type="number" id="min" min="0" step="0.5" value="${d.min_order}"></label></div></div>
      <div class="card"><h3>🕒 ${t('sec.hours')}</h3><div class="hours">${days.map((i) => `<b>${t('d.' + i)}</b><input type="time" data-h="${i}.open" value="${d.hours[i].open}"><input type="time" data-h="${i}.close" value="${d.hours[i].close}"><label class="tog" style="margin:0"><input type="checkbox" data-h="${i}.closed" ${d.hours[i].closed ? 'checked' : ''}>${t('set.closedDay')}</label>`).join('')}</div></div>
      <p class="err" id="err"></p><button class="btn big" id="save">💾 ${t('save')}</button>`;
    $$('[data-l]', el).forEach((b) => b.onclick = () => { const l = b.dataset.l; d.langs = d.langs.includes(l) ? d.langs.filter((x) => x !== l) : [...d.langs, l]; if (!d.langs.length) d.langs = [l]; if (!d.langs.includes(d.default_lang)) d.default_lang = d.langs[0]; collectBasic(); me.shop = { ...me.shop, ...d }; settings(el); });
    function collectBasic() { d.name = $('#name').value; d.slug = $('#slug').value; d.default_lang = $('#dl').value; d.phone = $('#phone').value; d.whatsapp = $('#wa').value; d.address = $('#addr').value; d.currency = $('#cur').value; d.accepting = $('#acc').checked; d.delivery = $('#del').checked; d.delivery_fee = +$('#fee').value; d.min_order = +$('#min').value; $$('[data-h]', el).forEach((i) => { const [k, f] = i.dataset.h.split('.'); d.hours[k][f] = f === 'closed' ? i.checked : i.value; }); }
    $('#save').onclick = async () => {
      collectBasic();
      try { const r = await api('PUT', '/api/shop', { name: d.name, slug: d.slug, langs: d.langs, default_lang: d.default_lang, phone: d.phone, whatsapp: d.whatsapp, address: d.address, currency: d.currency, accepting: d.accepting, delivery: d.delivery, delivery_fee: d.delivery_fee, min_order: d.min_order, hours: d.hours }); me.shop = r.shop; toast('✓ ' + t('saved')); settings(el); }
      catch (e) { $('#err').textContent = errMsg(e); }
    };
  }

  // ---------------- billing ----------------
  function billing(el) {
    const s = me.shop, paid = s.access === 'paid';
    el.innerHTML = `${accessBanner()}<h2>💳 ${t('nav.billing')}</h2>
      ${paid ? `<div class="card">✅ <b>${t('b.active', { plan: t('plan.' + s.plan), n: s.daysLeft })}</b>${s.card_last4 ? `<p>💳 •••• ${esc(s.card_last4)}</p><button class="btn danger small" id="cancel">${t('b.cancel')}</button>` : `<p>${t('b.cancelled')}</p>`}</div>` : ''}
      <div class="grid">${['starter', 'pro'].map((p) => `<div class="card plan ${p === 'pro' ? 'hot' : ''}"><h3>${t('plan.' + p)}</h3><div class="price">$${me.plans[p].price}<small>/${t('month')}</small></div>
        <ul><li>${t('plan.' + p + '.1')}</li><li>${t('plan.all')}</li><li>${t('plan.' + p + '.2')}</li></ul><button class="btn ${p === 'pro' ? '' : 'ghost'}" data-p="${p}">${s.plan === p && paid ? t('b.renew') : t('subscribe')}</button></div>`).join('')}</div>
      <p style="color:var(--mute)">🧪 ${t('b.demo')}</p>`;
    if ($('#cancel')) $('#cancel').onclick = async () => { me.shop = (await api('POST', '/api/billing/cancel')).shop; billing(el); };
    $$('[data-p]', el).forEach((b) => b.onclick = () => {
      const m = document.createElement('div'); m.className = 'modal';
      m.innerHTML = `<div class="card"><h3>${t('plan.' + b.dataset.p)} — $${me.plans[b.dataset.p].price}/${t('month')}</h3>
        <label>${t('b.card')}<input type="text" id="cn" inputmode="numeric" placeholder="4242 4242 4242 4242" autocomplete="cc-number"></label>
        <div class="row"><label>${t('b.exp')}<input type="text" id="ce" placeholder="MM/YY" maxlength="5" autocomplete="cc-exp"></label><label>CVC<input type="text" id="cc" inputmode="numeric" maxlength="4" autocomplete="cc-csc"></label></div>
        <p class="err" id="err"></p><div class="row"><button class="btn" id="pay">🔒 ${t('b.pay')}</button><button class="btn ghost" id="no">${t('cancel')}</button></div></div>`;
      document.body.append(m);
      $('#no', m).onclick = () => m.remove();
      $('#pay', m).onclick = async () => {
        try { me.shop = (await api('POST', '/api/billing/subscribe', { plan: b.dataset.p, card: { number: $('#cn', m).value, exp: $('#ce', m).value, cvc: $('#cc', m).value } })).shop; m.remove(); toast('🎉 ' + t('b.thanks')); billing(el); }
        catch (e) { $('#err', m).textContent = e.message === 'card' ? t('err.card') : errMsg(e); }
      };
    });
  }

  setLang(lang);
  route();
})();
