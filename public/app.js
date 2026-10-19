// Napizzo platform UI (vanilla JS single-page app). Components: public/style.css (.nz-*), helpers: public/nz.js.
(() => {
  const LANGS = ['en', 'fr', 'ar'];
  const $app = document.getElementById('app');
  let lang = localStorage.lang || (['fr', 'ar'].includes(navigator.language.slice(0, 2)) ? navigator.language.slice(0, 2) : 'en');
  let me = null, menu = null, orders = [], lastOrderId = 0, poll = null;

  const t = (k, v) => {
    let s = (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;
    if (v) for (const x in v) s = s.split(`{${x}}`).join(v[x]);
    return s;
  };
  const { icon, esc } = NZUI;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const toast = (m) => NZUI.toast(m);
  const debounce = (fn, ms) => { let h; const f = (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; f.cancel = () => clearTimeout(h); return f; };

  async function api(method, url, data, raw) {
    const r = await fetch(url, { method, headers: raw ? { 'Content-Type': raw.type } : data ? { 'Content-Type': 'application/json' } : {}, body: raw ? raw : data ? JSON.stringify(data) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || 'error'), { status: r.status });
    return j;
  }
  const errMsg = (e) => (t('err.' + e.message) !== 'err.' + e.message ? t('err.' + e.message) : t('err.generic'));

  function setLang(l) {
    lang = l; localStorage.lang = l;
    document.documentElement.lang = l; document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    if (me && me.user) api('PUT', '/api/me/lang', { lang: l }).catch(() => {});
  }
  const langSeg = (block) => `<div class="nz-seg${block ? ' nz-seg--block' : ''}" role="group" aria-label="${t('a.language')}">${LANGS.map((l) => `<button type="button" class="nz-seg__opt" data-lang="${l}" aria-pressed="${l === lang}">${l === 'ar' ? 'العربية' : l.toUpperCase()}</button>`).join('')}</div>`;
  function bindLang(root = document) { $$('[data-lang]', root).forEach((b) => b.onclick = () => { setLang(b.dataset.lang); route(); }); }

  // In the static demo build shop pages live behind a hash route of this same page.
  const pageUrl = (slug, q = '') => (window.NAPIZZO_DEMO ? `${location.origin}${location.pathname}#/s/${slug}${q ? '?' + q : ''}` : `${location.origin}/s/${slug}${q ? '?' + q : ''}`);
  const shopUrl = (s) => pageUrl(s.slug);
  const shortUrl = (s) => shopUrl(s).replace(/^https?:\/\//, '');
  const loc = (o, shop) => (o && (o[lang] || o[shop.default_lang] || Object.values(o).find(Boolean))) || '';
  const fmt = (n, cur) => { const s = Number.isInteger(+n) ? String(+n) : (+n).toFixed(2); return lang === 'en' ? cur + s : lang === 'fr' ? s.replace('.', ',') + ' ' + cur : s + ' ' + cur; };
  const money = (n, shop) => fmt(n, shop.currency);
  const dateStr = (ms) => new Date(ms).toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric' });
  const TYPE_EMOJI = { pizzeria: '🍕', burger: '🍔', tacos: '🌮', sandwich: '🥙', other: '🍽️' };
  const TYPE_KEY = { pizzeria: 'tPizza', burger: 'tBurger', tacos: 'tTacos', sandwich: 'tKebab', other: 'tOther' };
  const HERO_KEY = { gradient: 'hGradient', sunset: 'hSunset', dark: 'hDark' };
  const FONT_KEY = { modern: 'fModern', rounded: 'fFriendly', serif: 'fClassic' };
  const FONT_CSS = { modern: "'Readex Pro',system-ui,sans-serif", rounded: "'Baloo Bhaijaan 2','Readex Pro',system-ui,sans-serif", serif: "'Lora','Noto Naskh Arabic',Georgia,serif" };
  const ownerName = () => { const n = (me.user.email || '').split('@')[0].replace(/[._-]+/g, ' '); return n ? n[0].toUpperCase() + n.slice(1) : ''; };

  // ---------- small view helpers ----------
  const sw = (id, label, sub, on, lg) => `<button type="button" class="nz-switch${lg ? ' nz-switch--lg' : ''}" role="switch" id="${id}" aria-checked="${!!on}"><span class="nz-switch__text">${label}${sub ? `<small>${sub}</small>` : ''}</span><span class="nz-switch__track"><span class="nz-switch__knob"></span></span></button>`;
  $app.addEventListener('click', (e) => { const b = e.target.closest('.nz-switch'); if (b && !b.hasAttribute('data-manual')) { NZUI.toggle(b); b.dispatchEvent(new Event('change', { bubbles: true })); } });
  const field = (label, inner, hint) => `<div class="nz-field"><label class="nz-label">${label}</label>${inner}${hint ? `<span class="nz-hint">${hint}</span>` : ''}</div>`;
  const accessState = () => me.shop.access;
  const daysLeft = () => me.shop.daysLeft;

  // ---------------- routing ----------------
  async function load() { me = await api('GET', '/api/me'); }
  async function route() {
    clearInterval(poll);
    const hash = location.hash.replace(/^#\/?/, '') || '';
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    $app.className = 'nz';
    if (window.NAPIZZO_DEMO && hash.startsWith('s/')) return window.NAPIZZO_DEMO.showShop(hash.slice(2));
    if (!me) await load();
    window.scrollTo(0, 0);
    if (!me.user) {
      if (hash === 'login' || hash === 'signup') return authView(hash);
      return landing();
    }
    if (hash === 'login' || hash === 'signup' || hash === '') return (location.hash = me.shop ? '#/home' : '#/setup');
    if (!me.shop) return wizard();
    const views = { home, design, menu: menuView, orders: ordersView, settings, billing };
    shell(hash, views[hash] || home);
  }
  window.addEventListener('hashchange', route);

  // ---------------- dashboard shell ----------------
  const NAV = [['home', 'home'], ['design', 'design'], ['menu', 'menu'], ['orders', 'orders'], ['settings', 'settings'], ['billing', 'billing']];
  const NAVKEY = { home: 'nHome', design: 'nDesign', menu: 'nMenu', orders: 'nOrders', settings: 'nSettings', billing: 'nBilling' };
  function shell(active, view) {
    const s = me.shop, emoji = TYPE_EMOJI[s.type] || '🍽️';
    const badge = '<span class="nz-count" data-newdot hidden></span>';
    const link = (k, ic) => `<a class="nz-nav__item" href="#/${k}" ${k === active ? 'aria-current="page"' : ''}>${icon(ic)}<span>${t('a.' + NAVKEY[k])}</span>${k === 'orders' ? badge : ''}</a>`;
    const tab = (k, ic) => `<a class="nz-tab" href="#/${k}" ${k === active ? 'aria-current="page"' : ''}><span class="nz-tab__pill">${icon(ic)}</span><span class="nz-tab__label">${t('a.' + NAVKEY[k])}</span>${k === 'orders' ? badge : ''}</a>`;
    const moreActive = active === 'settings' || active === 'billing';
    $app.innerHTML = `<div class="nz-shell">
      <aside class="nz-side"><a href="#/home" aria-label="Napizzo">${NZUI.logo(40)}</a>
        <a class="nz-rest" href="${esc(shopUrl(s))}" target="_blank" rel="noopener"><span class="nz-rest__emoji">${emoji}</span><span class="nz-rest__txt"><span class="nz-rest__name">${esc(s.name)}</span><span class="nz-rest__url">${esc(shortUrl(s))}</span></span></a>
        <nav class="nz-nav" aria-label="${t('shell.main')}">${NAV.map(([k, ic]) => link(k, ic)).join('')}</nav>
        <div class="nz-side__foot"><a class="nz-btn nz-btn--secondary" href="${esc(shopUrl(s))}" target="_blank" rel="noopener">${icon('external', 20)}${t('a.viewPage')}</a>
          ${langSeg()}<button type="button" class="nz-btn nz-btn--ghost-danger" id="logout">${icon('logout', 22)}${t('a.logout')}</button></div></aside>
      <div style="flex:1;min-width:0">
        <header class="nz-top"><span class="nz-rest__emoji">${emoji}</span><span class="nz-top__name">${esc(s.name)}</span>
          <a class="nz-iconbtn" href="${esc(shopUrl(s))}" target="_blank" rel="noopener" aria-label="${t('a.viewPage')}">${icon('external')}</a></header>
        <main class="nz-main" id="main"></main></div>
      <nav class="nz-tabs" aria-label="${t('shell.main')}">${NAV.slice(0, 4).map(([k, ic]) => tab(k, ic)).join('')}
        <button type="button" class="nz-tab" id="more" ${moreActive ? 'aria-current="page"' : ''} aria-haspopup="dialog"><span class="nz-tab__pill">${icon('more')}</span><span class="nz-tab__label">${t('a.more')}</span></button></nav></div>`;
    bindLang();
    $('#logout').onclick = logout;
    $('#more').onclick = () => {
      const m = NZUI.modal({ label: t('a.more'), html: `<div class="nz-more">
        ${['settings', 'billing'].map((k) => `<a class="nz-nav__item" href="#/${k}" data-nz-close><span class="nz-more__ico">${icon(k)}</span><span>${t('a.' + NAVKEY[k])}</span>${s.access === 'trial' && k === 'billing' ? `<span class="nz-badge nz-badge--preparing">🎁 ${s.daysLeft}</span>` : ''}${icon('chevron', 20)}</a>`).join('')}
        <div style="padding:10px 12px 0;font-weight:700;color:var(--nz-ink-2);font-size:16px">${t('a.language')}</div>${langSeg(true)}
        <button type="button" class="nz-nav__item nz-more__danger" id="logout2"><span class="nz-more__ico">${icon('logout', 22)}</span>${t('a.logout')}</button></div>` });
      $('#logout2', m.el).onclick = () => { m.close(); logout(); };
      $$('[data-lang]', m.el).forEach((b) => b.onclick = () => { m.close(); setLang(b.dataset.lang); route(); });
    };
    view($('#main'));
    startPoll(active === 'orders');
  }
  async function logout(e) { if (e && e.preventDefault) e.preventDefault(); await api('POST', '/api/logout'); me = null; location.hash = '#/'; route(); }

  function accessBanner() {
    const s = me.shop;
    if (s.access === 'trial') return `<div class="nz-banner"><div class="nz-banner__txt"><b>🎁 ${t('a.trialLeft', { n: s.daysLeft })}</b><span>${t('a.trialLeftSub', { date: dateStr(s.trial_ends) })}</span></div><a class="nz-btn nz-btn--secondary nz-btn--sm" href="#/billing">${t('a.choosePlan')}</a></div>`;
    if (s.access === 'expired') return `<div class="nz-banner nz-banner--warn"><div class="nz-banner__txt"><b>⚠️ ${t('expired')}</b></div><a class="nz-btn nz-btn--primary nz-btn--sm" href="#/billing">${t('a.choosePlan')}</a></div>`;
    return '';
  }
  async function startPoll(onOrders) {
    const check = async () => {
      try {
        const { orders: o } = await api('GET', '/api/orders');
        const newest = o.length ? o[0].id : 0;
        const fresh = o.filter((x) => x.status === 'new').length;
        if (lastOrderId && newest > lastOrderId) { beep(); if (navigator.vibrate) navigator.vibrate(200); toast(t('orders.new')); }
        lastOrderId = Math.max(lastOrderId, newest);
        $$('[data-newdot]').forEach((dot) => { dot.hidden = !fresh; dot.textContent = fresh; });
        if (onOrders && JSON.stringify(o) !== JSON.stringify(orders)) { orders = o; drawOrders(); }
        orders = o;
      } catch {}
    };
    await check(); poll = setInterval(check, 8000);
  }
  function beep() { try { const c = new AudioContext(), o = c.createOscillator(); o.connect(c.destination); o.frequency.value = 880; o.start(); o.stop(c.currentTime + 0.25); } catch {} }
  async function copyLink(btn) {
    const s = me.shop;
    try { await navigator.clipboard.writeText(shopUrl(s)); } catch {}
    localStorage.nzShared = '1';
    if (btn) { const old = btn.innerHTML; btn.innerHTML = `${icon('check', 20)}${t('a.copied')} ✓`; setTimeout(() => { btn.innerHTML = old; }, 2000); }
    toast(t('copied'));
  }

  // ---------------- home ----------------
  function home(el) {
    const s = me.shop, url = shopUrl(s);
    const todo = [
      [true, 'todo1', '#/home'], [(menu ? menu.items.length : 1) > 0, 'todo2', '#/menu'], [!!s.config.logo, 'todo3', '#/design'],
      [JSON.stringify(s.hours) !== JSON.stringify(Array.from({ length: 7 }, () => ({ open: '10:00', close: '23:00', closed: false }))), 'todo4', '#/settings'], [!!localStorage.nzShared, 'todo5', '#/home'],
    ];
    const done = todo.filter((x) => x[0]).length;
    const fresh = orders.filter((o) => o.status === 'new').length;
    el.innerHTML = `<div class="nz-page">
      <div class="nz-pagehead"><div class="nz-grow"><h1 class="nz-h1">${t('a.hello', { name: esc(ownerName()) })} 👋</h1><p class="nz-sub">${t('a.helloSub')}</p></div></div>
      ${accessBanner()}
      <div class="nz-card nz-card--hero nz-live-card nz-live-card--phone" style="margin-bottom:16px"><div class="nz-stack">
        <div><span class="nz-live">${t('a.live')}</span></div><div><h2 class="nz-h2">${t('a.liveTitle')}</h2><p class="nz-sub">${t('a.liveSub')}</p></div>
        <div class="nz-urlbox">${icon('globe', 22)}<span>${esc(shortUrl(s))}</span></div>
        <div class="nz-actions"><a class="nz-btn nz-btn--primary" target="_blank" rel="noopener" href="${esc(url)}">${icon('external', 20)}${t('a.open')}</a>
          <button type="button" class="nz-btn nz-btn--secondary" id="copy">${icon('copy', 20)}${t('a.copyLink')}</button>
          <a class="nz-btn nz-btn--whatsapp" id="wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(s.name + ' ' + url)}">${icon('chat', 20)}${t('a.shareWa')}</a></div></div>
        <div class="nz-peach nz-hide-sm"><div class="nz-phone"><iframe title="${t('a.preview')}" tabindex="-1" src="${pageUrl(s.slug, 'preview=1&lang=' + (s.langs.includes(lang) ? lang : s.default_lang))}"></iframe></div></div></div>
      <h2 class="nz-h3" style="margin:28px 0 12px">${t('a.quickTitle')}</h2>
      <div class="nz-cards">
        <a class="nz-quick" href="#/design"><span class="nz-quick__ico">${icon('design', 28)}</span><span><b>${t('a.qDesign')}</b><span>${t('a.qDesignSub')}</span></span></a>
        <a class="nz-quick" href="#/menu"><span class="nz-quick__ico">${icon('menu', 28)}</span><span><b>${t('a.qMenu')}</b><span>${t('a.qMenuSub', { n: menu ? menu.items.length : '…' })}</span></span></a>
        <a class="nz-quick${fresh ? ' nz-quick--hot' : ''}" href="#/orders"><span class="nz-quick__ico">${icon('bell', 28)}</span><span><b>${t('a.qOrders')}</b><span>${fresh ? t('a.qOrdersSub', { n: fresh }) : ''}</span></span></a></div>
      <div class="nz-card" style="margin-top:24px"><h2 class="nz-h3">${t('a.todoTitle')}</h2>
        <div class="nz-prog" role="progressbar" aria-valuemin="0" aria-valuemax="${todo.length}" aria-valuenow="${done}"><i style="width:${(done / todo.length) * 100}%"></i></div><p style="margin:0 0 8px;color:var(--nz-ink-2)">${t('a.todoProg', { n: done, m: todo.length })}</p>
        ${todo.map(([ok, k, h]) => `<a class="nz-todo${ok ? ' is-done' : ''}" href="${h}"><span class="nz-todo__dot">${icon('check', 18)}</span><span class="nz-todo__txt">${t('a.' + k)}</span>${icon('chevron', 20)}</a>`).join('')}</div></div>`;
    $('#copy').onclick = (e) => copyLink(e.currentTarget);
    $('#wa').onclick = () => { localStorage.nzShared = '1'; };
    if (!menu) api('GET', '/api/menu').then((m) => { menu = m; if (location.hash.replace(/^#\/?/, '') === 'home') home(el); }).catch(() => {});
  }

  // ---------------- orders ----------------
  let ordFilter = 'all';
  const ST = { new: 'stNew', preparing: 'stPrep', ready: 'stReady', done: 'stDone', cancelled: 'stCancel' };
  const ST_ORDER = ['new', 'preparing', 'ready', 'done', 'cancelled'];
  function ordersView(el) {
    el.innerHTML = `<div class="nz-page">${accessBanner()}<div class="nz-pagehead"><h1 class="nz-h1">${t('a.ordersTitle')}</h1><span class="nz-live">${t('a.live')}</span></div><div class="nz-filters" id="flt" role="group"></div><div id="ol"></div></div>`;
    drawOrders();
  }
  function timeAgo(ms) { const m = Math.max(0, Math.floor((Date.now() - ms) / 60000)); return m < 60 ? `${m} ${t('a.minAgo')}` : new Date(ms).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }); }
  function drawOrders() {
    const el = $('#ol'); if (!el) return;
    const s = me.shop;
    const count = (k) => (k === 'all' ? orders.length : orders.filter((o) => (k === 'done' ? o.status === 'done' || o.status === 'cancelled' : o.status === k)).length);
    $('#flt').innerHTML = ['all', 'new', 'preparing', 'ready', 'done'].map((k) => `<button type="button" class="nz-chip nz-chip--pill" data-f="${k}" aria-pressed="${ordFilter === k}">${k === 'all' ? t('a.all') : t('a.' + ST[k])} <span class="nz-badge nz-badge--soldout" style="padding:1px 9px">${count(k)}</span></button>`).join('');
    $$('[data-f]').forEach((b) => b.onclick = () => { ordFilter = b.dataset.f; drawOrders(); });
    const list = orders.filter((o) => ordFilter === 'all' || (ordFilter === 'done' ? o.status === 'done' || o.status === 'cancelled' : o.status === ordFilter))
      .sort((a, b) => ST_ORDER.indexOf(a.status) - ST_ORDER.indexOf(b.status) || b.created_at - a.created_at);
    if (!list.length) {
      el.innerHTML = `<div class="nz-empty"><div class="nz-empty__art">🛎️</div><h3>${t('a.emptyTitle')}</h3><p>${t('a.emptySub')}</p><div class="nz-empty__actions">
        <a class="nz-btn nz-btn--whatsapp" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(s.name + ' ' + shopUrl(s))}">${icon('chat', 20)}${t('a.shareWa')}</a><button type="button" class="nz-btn nz-btn--secondary" id="ecopy">${icon('copy', 20)}${t('a.copyLink')}</button></div></div>`;
      $('#ecopy').onclick = (e) => copyLink(e.currentTarget); return;
    }
    const next = (o) => ({ new: ['preparing', 'aPrep', 'cheese', '👨‍🍳'], preparing: ['ready', 'aReady', 'basil', '✅'], ready: ['done', o.kind === 'delivery' ? 'aDoneDel' : 'aDonePick', 'dark', '🙌'] }[o.status]);
    el.innerHTML = `<div class="nz-orders">${list.map((o) => { const n = next(o); return `<article class="nz-order" data-st="${o.status}">
      <div class="nz-order__head"><span class="nz-badge nz-badge--${o.status}">${t('a.' + ST[o.status])}</span><span class="nz-order__id nz-ltr">#${o.number}</span><span class="nz-order__time">${timeAgo(o.created_at)}</span></div>
      <div class="nz-order__body"><div class="nz-order__who"><div style="flex:1;min-width:0"><b>${esc(o.customer)}</b><span>${esc(o.phone)}</span></div>
          <a class="nz-iconbtn" href="tel:${esc(o.phone)}" aria-label="${t('a.call')}">${icon('phone')}</a></div>
        <div>${o.kind === 'delivery' ? `🛵 <b>${t('a.delivery')}</b> · ${esc(o.address)}` : `🛍️ <b>${t('a.pickup')}</b>`}</div>
        <ul class="nz-order__lines">${o.lines.map((l) => `<li><b class="nz-ltr">${l.qty}×</b><span>${esc(loc(l.name, s))}</span></li>`).join('')}</ul>
        ${o.note ? `<div class="nz-order__note"><b>${t('a.note')}:</b> ${esc(o.note)}</div>` : ''}
        <div class="nz-order__total"><span>💵 ${t('a.cash')}</span><b class="nz-ltr">${money(o.total, s)}</b></div></div>
      ${n ? `<div class="nz-order__foot"><button type="button" class="nz-btn nz-btn--${n[2]} nz-btn--lg" data-o="${o.id}:${n[0]}">${n[3]} ${t('a.' + n[1])}</button>${o.status === 'new' ? `<button type="button" class="nz-btn nz-btn--ghost-danger nz-btn--sm" data-o="${o.id}:cancelled">${t('a.aCancel')}</button>` : ''}</div>` : ''}</article>`; }).join('')}</div>`;
    $$('[data-o]', el).forEach((b) => b.onclick = async () => {
      const [id, st] = b.dataset.o.split(':'); const o = orders.find((x) => x.id == id);
      const prev = o.status; o.status = st; drawOrders(); toast(`${t('a.' + ST[st])} · #${o.number}`);
      try { await api('PUT', '/api/orders/' + id, { status: st }); } catch { o.status = prev; drawOrders(); }
    });
  }

  // ---------------- menu ----------------
  async function menuView(el) {
    const s = me.shop; menu = await api('GET', '/api/menu');
    const draw = () => {
      const limited = s.access === 'paid' && s.plan === 'starter';
      el.innerHTML = `<div class="nz-page">${accessBanner()}<div class="nz-pagehead"><div class="nz-grow"><h1 class="nz-h1">${t('a.menuTitle')}</h1>
        ${limited ? `<div class="nz-usage"><span class="nz-sub" style="font-size:16px">${t('a.menuUsage', { n: menu.items.length, m: me.plans.starter.maxItems })} · ${t('a.menuPlan')}</span><div class="nz-prog"><i style="width:${Math.min(100, (menu.items.length / me.plans.starter.maxItems) * 100)}%"></i></div></div>` : ''}</div>
        <button type="button" class="nz-btn nz-btn--secondary" id="addcat">${icon('plus', 20)}${t('a.addCat')}</button>
        <button type="button" class="nz-btn nz-btn--primary" id="adddish" ${menu.cats.length ? '' : 'disabled'}>${icon('plus', 20)}${t('a.addDish')}</button></div>
        <div class="nz-stack">${menu.cats.map((c) => { const its = menu.items.filter((i) => i.category_id === c.id); return `<section class="nz-card nz-catcard">
          <div class="nz-cathead"><span class="nz-cathead__emoji">${esc(c.emoji)}</span><h3>${esc(loc(c.name, s))}<small>${its.length} ${t('a.dishes')}</small></h3><button type="button" class="nz-btn nz-btn--secondary nz-btn--sm" data-ec="${c.id}">${icon('edit', 18)}${t('a.edit')}</button></div>
          ${its.map((i) => `<div class="nz-item${i.available ? '' : ' is-hidden'}"><div class="nz-item__thumb" style="${i.image ? `background-image:url('${esc(i.image)}')` : ''}">${i.image ? '' : esc(c.emoji)}</div>
            <div class="nz-item__txt"><span class="nz-item__name">${esc(loc(i.name, s))}${i.available ? '' : `<span class="nz-badge nz-badge--soldout">${t('a.soldOut')}</span>`}</span><span class="nz-item__desc">${esc(loc(i.descr, s))}</span></div>
            <span class="nz-item__price">${money(i.price, s)}</span>
            <button type="button" class="nz-eye" data-av="${i.id}" aria-pressed="${!!i.available}">${icon(i.available ? 'eye' : 'eyeOff', 20)}<span class="nz-hide-sm">${t(i.available ? 'a.visible' : 'a.hidden')}</span></button>
            <button type="button" class="nz-btn nz-btn--secondary nz-btn--sm" data-ei="${i.id}">${icon('edit', 18)}<span class="nz-hide-sm">${t('a.edit')}</span></button></div>`).join('')}
          <button type="button" class="nz-addrow" data-ai="${c.id}">${icon('plus', 20)}${t('a.addDish')}</button></section>`; }).join('')}</div>
        ${limited && menu.items.length >= me.plans.starter.maxItems - 5 ? `<div class="nz-note" style="margin-top:16px">${icon('billing')}<span>${t('a.upgradeNote')}</span></div>` : ''}</div>`;
      $('#addcat').onclick = () => catForm();
      $('#adddish').onclick = () => itemForm(null, menu.cats[0].id);
      $$('[data-ec]', el).forEach((b) => b.onclick = () => catForm(menu.cats.find((c) => c.id == b.dataset.ec)));
      $$('[data-ai]', el).forEach((b) => b.onclick = () => itemForm(null, +b.dataset.ai));
      $$('[data-ei]', el).forEach((b) => b.onclick = () => itemForm(menu.items.find((i) => i.id == b.dataset.ei)));
      $$('[data-av]', el).forEach((b) => b.onclick = async () => { const i = menu.items.find((x) => x.id == b.dataset.av); menu = await api('PUT', '/api/items/' + i.id, { available: !i.available }); draw(); });
    };
    const langTabs = (drafts, cur) => `<div class="nz-tabs-l" role="tablist">${s.langs.map((l) => `<button type="button" role="tab" data-lt="${l}" aria-selected="${l === cur}">${l === 'ar' ? 'العربية' : l.toUpperCase()}<i class="${drafts.name[l] && drafts.name[l].trim() ? '' : 'miss'}"></i></button>`).join('')}</div>`;
    function catForm(c) {
      const d = { name: { ...(c ? c.name : {}) }, emoji: c ? c.emoji : '🍽️' }; let cur = s.langs.includes(lang) ? lang : s.langs[0];
      const m = NZUI.modal({ title: c ? t('a.edit') : t('a.addCat'), label: t('a.cancel'), html: '<div id="cf"></div>' });
      const paint = () => {
        $('#cf', m.el).innerHTML = `${langTabs({ name: d.name }, cur)}${field(t('a.dishName'), `<input class="nz-input" id="cn" value="${esc(d.name[cur])}" ${cur === 'ar' ? 'dir="rtl"' : ''} autofocus>`)}
          ${field('Emoji', `<input class="nz-input" id="ce" value="${esc(d.emoji)}" maxlength="4" style="max-width:120px;font-size:28px;text-align:center">`)}
          <div class="nz-modal__foot"><button type="button" class="nz-btn nz-btn--primary" id="ok">${t('a.save')}</button>${c ? `<button type="button" class="nz-btn nz-btn--ghost-danger" id="del">${icon('trash', 20)}${t('a.del')}</button>` : ''}<button type="button" class="nz-btn nz-btn--secondary" data-nz-close>${t('a.cancel')}</button></div>`;
        const keep = () => { d.name[cur] = $('#cn', m.el).value; d.emoji = $('#ce', m.el).value; };
        $$('[data-lt]', m.el).forEach((b) => b.onclick = () => { keep(); cur = b.dataset.lt; paint(); });
        $('#ok', m.el).onclick = async () => { keep(); menu = c ? await api('PUT', '/api/categories/' + c.id, d) : await api('POST', '/api/categories', d); m.close(); draw(); };
        if (c) $('#del', m.el).onclick = async () => { if (confirm(t('m.confirm.cat'))) { menu = await api('DELETE', '/api/categories/' + c.id); m.close(); draw(); } };
      };
      paint();
    }
    function itemForm(i, catId) {
      const d = { name: { ...(i ? i.name : {}) }, descr: { ...(i ? i.descr : {}) }, price: i ? i.price : '', image: i ? i.image : '', available: i ? !!i.available : true };
      let cur = s.langs.includes(lang) ? lang : s.langs[0]; const cat = menu.cats.find((c) => c.id === (i ? i.category_id : catId));
      const m = NZUI.modal({ title: i ? t('a.editTitle') : t('a.newTitle'), label: t('a.cancel'), html: '<div id="cf"></div>' });
      const paint = () => {
        $('#cf', m.el).innerHTML = `<div class="nz-photo"><div class="nz-photo__tile" style="${d.image ? `background-image:url('${esc(d.image)}')` : ''}">${d.image ? '' : esc(cat.emoji)}</div><div><label class="nz-btn nz-btn--secondary nz-btn--sm" style="cursor:pointer">${icon('upload', 18)}${t('a.changePhoto')}<input type="file" accept="image/*" class="nz-file" id="ph"></label><span class="nz-hint">${t('a.noPhoto')}</span></div></div>
          ${langTabs(d, cur)}${field(t('a.dishName'), `<input class="nz-input" id="in" value="${esc(d.name[cur])}" ${cur === 'ar' ? 'dir="rtl"' : ''}>`)}
          ${field(t('a.dishDesc'), `<textarea class="nz-input" id="id" ${cur === 'ar' ? 'dir="rtl"' : ''}>${esc(d.descr[cur])}</textarea>`)}
          ${field(t('a.price'), `<div class="nz-group nz-ltr"><input class="nz-input" id="ip" type="number" min="0" step="0.01" inputmode="decimal" value="${d.price}"><span class="nz-affix">${esc(s.currency)}</span></div>`)}
          ${sw('iav', t('a.markSold'), '', !d.available)}<p class="nz-err nz-error" id="err" role="alert" hidden></p>
          <div class="nz-modal__foot"><button type="button" class="nz-btn nz-btn--primary" id="ok">${t('a.save')}</button>${i ? `<button type="button" class="nz-btn nz-btn--ghost-danger" id="del">${icon('trash', 20)}${t('a.del')}</button>` : ''}<button type="button" class="nz-btn nz-btn--secondary" data-nz-close>${t('a.cancel')}</button></div>`;
        const keep = () => { d.name[cur] = $('#in', m.el).value; d.descr[cur] = $('#id', m.el).value; d.price = $('#ip', m.el).value; d.available = $('#iav', m.el).getAttribute('aria-checked') !== 'true'; };
        $$('[data-lt]', m.el).forEach((b) => b.onclick = () => { keep(); cur = b.dataset.lt; paint(); });
        $('#ph', m.el).onchange = async (e) => { keep(); const u = await upload(e.target.files[0]); if (u) { d.image = u; paint(); } };
        $('#ok', m.el).onclick = async () => {
          keep();
          if (!Object.values(d.name).some((v) => v && v.trim())) { const er = $('#err', m.el); er.hidden = false; er.textContent = '⚠️ ' + t('err.name'); return; }
          const body = { name: d.name, descr: d.descr, price: d.price || 0, image: d.image, available: d.available, category_id: i ? i.category_id : catId };
          try { menu = i ? await api('PUT', '/api/items/' + i.id, body) : await api('POST', '/api/items', body); m.close(); draw(); toast(t('a.saved')); }
          catch (e) { const er = $('#err', m.el); er.hidden = false; er.textContent = '⚠️ ' + errMsg(e); }
        };
        if (i) $('#del', m.el).onclick = async () => { if (confirm(t('m.confirm.item'))) { menu = await api('DELETE', '/api/items/' + i.id); m.close(); draw(); } };
      };
      paint();
    }
    draw();
  }
  async function upload(file) {
    if (!file) return null;
    try { return (await api('POST', '/api/upload', null, file.slice(0, file.size, file.type))).url; } catch (e) { toast(t('err.upload')); return null; }
  }

  // ---------------- design ----------------
  const savedChip = (state) => `<span class="nz-saved${state === 'saving' ? ' is-saving' : ''}" id="chip" role="status">${state === 'saving' ? `<span class="nz-spinner" style="width:16px;height:16px;border-width:2px"></span>${t('a.saving')}` : `${icon('check', 18)}${t('a.saved')} ✓`}</span>`;
  function design(el) {
    const s = me.shop, cfg = s.config, th = cfg.theme;
    const secKey = { hero: 'secHero', menu: 'secMenu', about: 'secAbout', hours: 'secHours', contact: 'secContact' };
    const colors = [['primary', 'cP'], ['accent', 'cA'], ['bg', 'cBg'], ['card', 'cCard'], ['text', 'cT']];
    const heroBg = { gradient: 'linear-gradient(135deg,#D62F25,#F7B32B)', sunset: 'linear-gradient(160deg,#F7B32B,#C9431A)', dark: 'radial-gradient(circle at 25% 25%,#FFC93C88,transparent 55%),#14161d' };
    let txLang = s.langs.includes(lang) ? lang : s.langs[0];
    const rest = el.scrollTop;
    el.innerHTML = `<div class="nz-page" style="max-width:1280px">${accessBanner()}<div class="nz-pagehead"><h1 class="nz-h1 nz-grow">${t('a.designTitle')}</h1><span id="chipwrap">${savedChip()}</span></div>
      <div class="nz-editor"><div class="nz-stack">
        <section class="nz-card"><h3 class="nz-ct">${t('a.dTheme')}</h3><div class="nz-themes">${Object.entries(me.themes).map(([k, p]) => `<button type="button" class="nz-theme" data-th="${k}" aria-pressed="${['primary', 'accent', 'bg', 'card', 'text'].every((c) => th[c].toLowerCase() === p[c].toLowerCase()) && th.hero === p.hero}"><div class="nz-swatch" style="background:${p.bg}"><i style="background:${p.primary}"></i><i style="background:${p.accent}"></i><i style="background:${p.card}"></i></div>${t('theme.' + k)}</button>`).join('')}</div></section>
        <section class="nz-card"><h3 class="nz-ct">${t('a.dColors')}</h3>${colors.map(([k, l]) => `<div class="nz-colorrow"><span>${t('a.' + l)}</span><code>${th[k].toUpperCase()}</code><input type="color" data-c="${k}" value="${th[k]}" aria-label="${t('a.' + l)}"></div>`).join('')}</section>
        <section class="nz-card"><h3 class="nz-ct">${t('a.dFont')}</h3><div class="nz-fonts">${['modern', 'rounded', 'serif'].map((f) => `<button type="button" class="nz-fontopt" data-font="${f}" aria-pressed="${th.font === f}" style="font-family:${FONT_CSS[f]}"><b>Aa أب</b>${t('a.' + FONT_KEY[f])}</button>`).join('')}</div></section>
        <section class="nz-card"><h3 class="nz-ct">${t('a.dRadius')}</h3><div class="nz-radius-prev" id="rp" style="border-radius:${th.radius}px"></div><input class="nz-range" type="range" min="0" max="40" value="${th.radius}" id="rad" aria-label="${t('a.dRadius')}"><div style="display:flex;justify-content:space-between;color:var(--nz-ink-2);font-size:15px"><span>${t('a.rSquare')}</span><span>${t('a.rRound')}</span></div></section>
        <section class="nz-card"><h3 class="nz-ct">${t('a.dHero')}</h3><div class="nz-heros">${['gradient', 'sunset', 'dark'].map((h) => `<button type="button" class="nz-heroopt" data-hero="${h}" aria-pressed="${th.hero === h}"><i style="background:${heroBg[h]}"></i>${t('a.' + HERO_KEY[h])}</button>`).join('')}</div></section>
        <section class="nz-card"><h3 class="nz-ct">${t('a.dImages')}</h3><div class="nz-stack">${[['logo', 'upLogo'], ['heroImage', 'upCover']].map(([k, l]) => `<label class="nz-upload"><span class="nz-upload__prev" style="${cfg[k] ? `background-image:url('${esc(cfg[k])}')` : ''}">${cfg[k] ? '' : icon('upload')}</span><span style="flex:1"><b>${t('a.' + l)}</b></span>${cfg[k] ? `<button type="button" class="nz-iconbtn" data-rm="${k}" aria-label="${t('a.del')}">${icon('trash')}</button>` : ''}<input type="file" accept="image/*" class="nz-file" data-up="${k}"></label>`).join('')}<span class="nz-hint">${t('a.upHint')}</span></div></section>
        <section class="nz-card"><h3 class="nz-ct">${t('a.dTexts')}</h3><div class="nz-tabs-l" role="tablist">${s.langs.map((l) => `<button type="button" role="tab" data-xl="${l}" aria-selected="${l === txLang}">${l === 'ar' ? 'العربية' : l.toUpperCase()}</button>`).join('')}</div>
          ${field(t('a.tagline'), `<input class="nz-input" id="tg" dir="${txLang === 'ar' ? 'rtl' : 'ltr'}" value="${esc(cfg.texts?.[txLang]?.tagline)}" maxlength="160">`)}
          ${field(t('a.about'), `<textarea class="nz-input" id="ab" dir="${txLang === 'ar' ? 'rtl' : 'ltr'}" maxlength="1200">${esc(cfg.texts?.[txLang]?.about)}</textarea>`)}</section>
        <section class="nz-card"><h3 class="nz-ct">${t('a.dSections')}</h3><p class="nz-hint" style="margin:-8px 0 8px">${t('a.dSectionsSub')}</p>${cfg.sections.map((x, i) => `<div class="nz-section"><b>${t('a.' + secKey[x.id])}</b>
          <button type="button" class="nz-iconbtn" data-mv="${i}:-1" aria-label="${t('a.moveUp')}" ${i === 0 ? 'disabled' : ''}>${icon('up', 20)}</button><button type="button" class="nz-iconbtn" data-mv="${i}:1" aria-label="${t('a.moveDown')}" ${i === cfg.sections.length - 1 ? 'disabled' : ''}>${icon('down', 20)}</button>
          <button type="button" class="nz-switch nz-switch--plain" role="switch" data-manual data-sec="${i}" aria-checked="${!!x.on}" aria-label="${t('a.' + secKey[x.id])}"><span class="nz-switch__track"><span class="nz-switch__knob"></span></span></button></div>`).join('')}</section>
      </div><aside class="nz-editor__preview" aria-label="${t('a.preview')}"><div class="nz-bigphone"><iframe id="pv" title="${t('a.preview')}" src="${pageUrl(s.slug, 'preview=1&lang=' + (s.langs.includes(lang) ? lang : s.default_lang))}"></iframe></div></aside></div></div>`;
    window.scrollTo(0, rest || 0);
    const flush = debounce(async () => {
      try { const r = await api('PUT', '/api/shop', { config: cfg }); me.shop = { ...me.shop, ...r.shop, config: cfg }; $('#chipwrap').innerHTML = savedChip(); const pv = $('#pv'); if (pv) pv.contentWindow.location.reload(); toast(t('a.saved')); }
      catch (e) { $('#chipwrap').innerHTML = savedChip(); toast(errMsg(e)); }
    }, 800);
    const touch = (rerender) => { $('#chipwrap').innerHTML = savedChip('saving'); flush(); if (rerender) { const y = window.scrollY; design(el); window.scrollTo(0, y); $('#chipwrap').innerHTML = savedChip('saving'); } };
    $$('[data-th]', el).forEach((b) => b.onclick = () => { const p = me.themes[b.dataset.th]; Object.assign(cfg.theme, p); touch(true); });
    $$('[data-c]', el).forEach((i) => i.oninput = () => { cfg.theme[i.dataset.c] = i.value; i.previousElementSibling.previousElementSibling && 0; i.parentElement.querySelector('code').textContent = i.value.toUpperCase(); touch(); });
    $$('[data-font]', el).forEach((b) => b.onclick = () => { cfg.theme.font = b.dataset.font; touch(true); });
    $$('[data-hero]', el).forEach((b) => b.onclick = () => { cfg.theme.hero = b.dataset.hero; touch(true); });
    $('#rad').oninput = (e) => { cfg.theme.radius = +e.target.value; $('#rp').style.borderRadius = e.target.value + 'px'; touch(); };
    $$('[data-xl]', el).forEach((b) => b.onclick = () => { txLang = b.dataset.xl; $$('[data-xl]', el).forEach((x) => x.setAttribute('aria-selected', x === b)); $('#tg').value = cfg.texts?.[txLang]?.tagline || ''; $('#ab').value = cfg.texts?.[txLang]?.about || ''; $('#tg').dir = $('#ab').dir = txLang === 'ar' ? 'rtl' : 'ltr'; });
    const tx = () => { cfg.texts = cfg.texts || {}; cfg.texts[txLang] = { tagline: $('#tg').value, about: $('#ab').value }; touch(); };
    $('#tg').oninput = tx; $('#ab').oninput = tx;
    $$('[data-sec]', el).forEach((b) => b.onclick = () => { NZUI.toggle(b); cfg.sections[b.dataset.sec].on = b.getAttribute('aria-checked') === 'true'; touch(); });
    $$('[data-mv]', el).forEach((b) => b.onclick = () => { const [i, d] = b.dataset.mv.split(':').map(Number); [cfg.sections[i], cfg.sections[i + d]] = [cfg.sections[i + d], cfg.sections[i]]; touch(true); });
    $$('[data-rm]', el).forEach((b) => b.onclick = (e) => { e.preventDefault(); cfg[b.dataset.rm] = ''; touch(true); });
    $$('[data-up]', el).forEach((i) => i.onchange = async () => { const u = await upload(i.files[0]); if (u) { cfg[i.dataset.up] = u; touch(true); } });
  }

  // ---------------- settings ----------------
  const CURRENCIES = ['$', '€', '£', 'DA', 'MAD', 'TND', 'DT', 'SAR', 'AED', 'EGP', '₺', 'CHF'];
  function settings(el) {
    const s = me.shop, d = { ...s, langs: [...s.langs], hours: s.hours.map((h) => ({ ...h })) };
    const curs = CURRENCIES.includes(d.currency) ? CURRENCIES : [d.currency, ...CURRENCIES];
    const dayName = (i) => t(`sh.d${i}`);
    el.innerHTML = `<div class="nz-page nz-page--narrow"><div class="nz-pagehead"><h1 class="nz-h1 nz-grow">${t('a.settingsTitle')}</h1><span id="chipwrap">${savedChip()}</span></div><div class="nz-stack">
      <div class="nz-card ${d.accepting ? 'nz-card--ok' : 'nz-card--off'}" id="acccard">${sw('acc', `<span style="font-size:20px">${t('a.accept')}</span>`, t('a.acceptSub'), d.accepting, true)}</div>
      <section class="nz-card"><h2 class="nz-h3" style="margin-bottom:16px">${t('a.sRest')}</h2>
        ${field(t('a.nameLabel'), `<input class="nz-input" id="name" maxlength="60" value="${esc(d.name)}">`)}
        <div class="nz-field"><label class="nz-label" for="slug">${t('a.sAddr')}</label><div class="nz-group nz-prefix"><span class="nz-affix">${esc(location.host)}/s/</span><input class="nz-input nz-ltr" id="slug" maxlength="30" value="${esc(d.slug)}" aria-describedby="slugerr"><span class="nz-pill-ok" id="slugok">✓ ${t('a.sAvail')}</span></div><div class="nz-error" id="slugerr" role="alert" hidden></div></div></section>
      <section class="nz-card"><h2 class="nz-h3" style="margin-bottom:16px">${t('a.sLangs')}</h2><div class="nz-stack" style="gap:10px">${LANGS.map((l) => `<button type="button" class="nz-chip" data-l="${l}" aria-pressed="${d.langs.includes(l)}"><span>${{ en: '🇬🇧 English', fr: '🇫🇷 Français', ar: '🇸🇦 العربية' }[l]}</span><span class="nz-chip__check">${icon('check', 18)}</span></button>`).join('')}</div>
        ${d.langs.length > 1 ? field(t('set.deflang'), `<select class="nz-input" id="dl">${d.langs.map((l) => `<option value="${l}" ${l === d.default_lang ? 'selected' : ''}>${{ en: 'English', fr: 'Français', ar: 'العربية' }[l]}</option>`).join('')}</select>`) : ''}</section>
      <section class="nz-card"><h2 class="nz-h3" style="margin-bottom:16px">${t('a.sContact')}</h2>
        ${field(t('a.sPhone'), `<input class="nz-input nz-ltr" id="phone" type="tel" value="${esc(d.phone)}">`)}${field(t('a.sWa'), `<input class="nz-input nz-ltr" id="wa" type="tel" value="${esc(d.whatsapp)}" placeholder="+1555…">`)}
        ${field(t('a.sAddress'), `<input class="nz-input" id="addr" value="${esc(d.address)}">`)}${field(t('a.sMoney'), `<select class="nz-input" id="cur">${curs.map((c) => `<option ${c === d.currency ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>`)}</section>
      <section class="nz-card"><h2 class="nz-h3" style="margin-bottom:16px">${t('a.sDelivery')}</h2>${sw('del', t('a.offerDel'), '', d.delivery)}
        <div class="nz-grid-2" id="delopts" style="margin-top:16px" ${d.delivery ? '' : 'hidden'}>${field(t('a.fee'), `<div class="nz-group nz-ltr"><input class="nz-input" id="fee" type="number" min="0" step="0.5" value="${d.delivery_fee}"><span class="nz-affix">${esc(d.currency)}</span></div>`)}${field(t('a.minOrder'), `<div class="nz-group nz-ltr"><input class="nz-input" id="min" type="number" min="0" step="0.5" value="${d.min_order}"><span class="nz-affix">${esc(d.currency)}</span></div>`)}</div></section>
      <section class="nz-card"><h2 class="nz-h3" style="margin-bottom:8px">${t('a.sHours')}</h2><div class="nz-hours">${d.hours.map((h, i) => `<div class="nz-hour"><b>${dayName(i)}</b>
        <button type="button" class="nz-switch nz-switch--plain" role="switch" data-manual data-day="${i}" aria-checked="${!h.closed}" aria-label="${dayName(i)}"><span class="nz-switch__track"><span class="nz-switch__knob"></span></span></button>
        <div class="nz-hour__times">${h.closed ? `<span class="nz-badge nz-badge--soldout">${t('a.closed')}</span>` : `<input class="nz-input" type="time" data-h="${i}.open" value="${h.open}" aria-label="${dayName(i)}"><span>–</span><input class="nz-input" type="time" data-h="${i}.close" value="${h.close}" aria-label="${dayName(i)}">`}</div></div>`).join('')}</div>
        <button type="button" class="nz-btn nz-btn--secondary nz-btn--sm" id="copyall" style="margin-top:14px">${icon('copy', 18)}${t('a.copyAll')}</button></section></div></div>`;
    const flush = debounce(async () => {
      const body = { name: d.name, slug: d.slug, langs: d.langs, default_lang: d.default_lang, phone: d.phone, whatsapp: d.whatsapp, address: d.address, currency: d.currency, accepting: d.accepting, delivery: d.delivery, delivery_fee: d.delivery_fee, min_order: d.min_order, hours: d.hours };
      const er = $('#slugerr'); er.hidden = true;
      try { const r = await api('PUT', '/api/shop', body); me.shop = { ...me.shop, ...r.shop }; $('#chipwrap').innerHTML = savedChip(); $('#slugok').hidden = false; toast(t('a.saved')); }
      catch (e) { $('#chipwrap').innerHTML = savedChip(); if (e.message === 'slug' || e.message === 'slug-taken') { er.hidden = false; er.textContent = '⚠️ ' + errMsg(e); $('#slugok').hidden = true; } else toast(errMsg(e)); }
    }, 800);
    const touch = () => { $('#chipwrap').innerHTML = savedChip('saving'); flush(); };
    const bind = (id, key, conv) => { $('#' + id).oninput = $('#' + id).onchange = (e) => { d[key] = conv ? conv(e.target.value) : e.target.value; touch(); }; };
    bind('name', 'name'); bind('phone', 'phone'); bind('wa', 'whatsapp'); bind('addr', 'address'); bind('cur', 'currency'); bind('fee', 'delivery_fee', Number); bind('min', 'min_order', Number);
    $('#slug').oninput = (e) => { d.slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); e.target.value = d.slug; touch(); };
    if ($('#dl')) bind('dl', 'default_lang');
    $('#acc').onchange = (e) => { d.accepting = e.target.getAttribute('aria-checked') === 'true'; $('#acccard').className = 'nz-card ' + (d.accepting ? 'nz-card--ok' : 'nz-card--off'); touch(); };
    $('#del').onchange = (e) => { d.delivery = e.target.getAttribute('aria-checked') === 'true'; $('#delopts').hidden = !d.delivery; touch(); };
    $$('[data-l]', el).forEach((b) => b.onclick = () => { const l = b.dataset.l; d.langs = d.langs.includes(l) ? d.langs.filter((x) => x !== l) : [...d.langs, l]; if (!d.langs.length) d.langs = [l]; if (!d.langs.includes(d.default_lang)) d.default_lang = d.langs[0]; me.shop = { ...me.shop, langs: d.langs }; touch(); const y = window.scrollY; settings(el); window.scrollTo(0, y); $('#chipwrap').innerHTML = savedChip('saving'); });
    $$('[data-day]', el).forEach((b) => b.onclick = () => { NZUI.toggle(b); d.hours[b.dataset.day].closed = b.getAttribute('aria-checked') !== 'true'; touch(); const y = window.scrollY; const keep = { ...d }; me.shop = { ...me.shop, hours: d.hours }; settings(el); window.scrollTo(0, y); $('#chipwrap').innerHTML = savedChip('saving'); });
    $$('[data-h]', el).forEach((i) => i.onchange = () => { const [k, f] = i.dataset.h.split('.'); d.hours[k][f] = i.value; touch(); });
    $('#copyall').onclick = () => { const src = d.hours[1]; d.hours = d.hours.map(() => ({ ...src })); me.shop = { ...me.shop, hours: d.hours }; touch(); const y = window.scrollY; settings(el); window.scrollTo(0, y); $('#chipwrap').innerHTML = savedChip('saving'); };
  }

  // ---------------- billing ----------------
  function billing(el) {
    const s = me.shop, paid = s.access === 'paid', trial = s.access === 'trial';
    const pts = { starter: ['s1', 's2', 's3', 's4'], pro: ['p1', 'p2', 'p3', 'p4'] };
    const total = 90, deg = Math.round(Math.min(1, s.daysLeft / total) * 360);
    el.innerHTML = `<div class="nz-page nz-page--narrow" style="max-width:960px"><div class="nz-pagehead"><h1 class="nz-h1 nz-grow">${t('a.billingTitle')}</h1></div>
      <div class="nz-card" style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;margin-bottom:20px"><div class="nz-ring" style="--deg:${deg}deg"><span><div>${s.daysLeft}<small>${t('a.days')}</small></div></span></div>
        <div style="flex:1;min-width:220px"><h2 class="nz-h3">${paid ? t('b.active', { plan: t('plan.' + s.plan), n: s.daysLeft }) : trial ? t('a.bStatus') : t('expired')}</h2>
          <p style="margin:6px 0 0;color:var(--nz-ink-2)">${trial ? t('a.bStatusSub', { n: s.daysLeft, date: dateStr(s.trial_ends) }) : paid ? (s.card_last4 ? `💳 •••• ${esc(s.card_last4)}` : t('b.cancelled')) : ''}</p>
          ${paid && s.card_last4 ? `<button type="button" class="nz-btn nz-btn--ghost-danger nz-btn--sm" id="cancel" style="margin-top:8px">${t('b.cancel')}</button>` : ''}</div></div>
      <div class="nz-plans">${['starter', 'pro'].map((p) => `<div class="nz-plan nz-plan--${p}">${p === 'pro' ? `<span class="nz-pop">⭐ ${t('a.popular')}</span>` : ''}${paid && s.plan === p ? `<span class="nz-current">${icon('check', 16)} ${t('a.current')}</span>` : ''}
        <div><h3 class="nz-h3">${p === 'pro' ? 'Pro' : 'Starter'}</h3><span style="opacity:.8">${t('a.' + p + 'Desc')}</span></div>
        <div class="nz-plan__price">$${me.plans[p].price}<small> ${t('a.perMonth')}</small></div>
        <ul>${pts[p].map((k) => `<li>${icon('check', 20)}<span>${t('a.' + k)}</span></li>`).join('')}</ul>
        <button type="button" class="nz-btn ${p === 'pro' ? 'nz-btn--primary' : 'nz-btn--secondary'} nz-btn--lg" data-p="${p}">${paid && s.plan === p ? t('b.renew') : t(p === 'pro' ? 'a.choosePro' : 'a.chooseStarter')}</button></div>`).join('')}</div>
      <div class="nz-note" style="margin-top:20px">${icon('lock')}<span>${t('a.demo')}</span></div></div>`;
    if ($('#cancel')) $('#cancel').onclick = async () => { me.shop = (await api('POST', '/api/billing/cancel')).shop; billing(el); };
    $$('[data-p]', el).forEach((b) => b.onclick = () => payModal(b.dataset.p, () => billing(el)));
  }
  function payModal(plan, done) {
    const price = me.plans[plan].price;
    const m = NZUI.modal({ title: t('a.payTitle'), label: t('a.cancel'), html: `<div id="pf">
      <div class="nz-card" style="padding:14px 18px;margin-bottom:18px;display:flex;justify-content:space-between;background:var(--nz-cream)"><b>${plan === 'pro' ? 'Pro' : 'Starter'}</b><b class="nz-ltr">$${price} ${t('a.perMonth')}</b></div>
      ${field(t('a.cardName'), '<input class="nz-input" id="cname" autocomplete="cc-name">')}
      ${field(t('a.cardNum'), '<input class="nz-input nz-ltr" id="cn" inputmode="numeric" placeholder="4242 4242 4242 4242" autocomplete="cc-number">')}
      <div class="nz-grid-2">${field(t('a.expiry'), '<input class="nz-input nz-ltr" id="ce" placeholder="MM/YY" maxlength="5" autocomplete="cc-exp">')}${field(t('a.cvc'), '<input class="nz-input nz-ltr" id="cc" inputmode="numeric" maxlength="4" autocomplete="cc-csc">')}</div>
      <div class="nz-note">${icon('lock', 20)}<span>${t('a.demo')}</span></div><p class="nz-error" id="err" role="alert" hidden></p>
      <div class="nz-modal__foot" style="flex-direction:column"><button type="button" class="nz-btn nz-btn--primary nz-btn--lg" id="pay">${icon('lock', 20)}${t('a.payBtn', { price })}</button><span style="text-align:center;color:var(--nz-ink-3);font-size:15px">${t('a.secure')}</span></div></div>` });
    $('#ce', m.el).oninput = (e) => { let v = e.target.value.replace(/\D/g, '').slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2); e.target.value = v; };
    $('#pay', m.el).onclick = async (e) => {
      const btn = e.currentTarget; btn.classList.add('is-loading');
      try {
        me.shop = (await api('POST', '/api/billing/subscribe', { plan, card: { number: $('#cn', m.el).value, exp: $('#ce', m.el).value, cvc: $('#cc', m.el).value } })).shop;
        $('#pf', m.el).innerHTML = `<div class="nz-success"><div class="nz-success__tile">${icon('check', 52)}</div><h2 class="nz-h2">${plan === 'pro' ? t('a.paidTitle') : '🎉'}</h2><p class="nz-sub">${plan === 'pro' ? t('a.paidSub') : t('b.thanks')}</p><button type="button" class="nz-btn nz-btn--dark nz-btn--lg" id="fin">${t('a.done')}</button></div>`;
        $('#fin', m.el).onclick = () => { m.close(); done(); };
      } catch (x) { btn.classList.remove('is-loading'); const er = $('#err', m.el); er.hidden = false; er.textContent = '⚠️ ' + (x.message === 'card' ? t('err.card') : errMsg(x)); }
    };
  }

  // ---------------- shared bits for public screens ----------------
  function publicTop(extra = '') {
    return `<header class="nz-ptop"><div class="nz-ptop__in"><a href="#/" aria-label="Napizzo">${NZUI.logo(40)}</a>${extra}<span class="nz-grow"></span>${langSeg()}</div></header>`;
  }
  const HERO_BG = (p, a, h) => h === 'dark' ? `radial-gradient(circle at 20% 20%,${a}66,transparent 55%),linear-gradient(135deg,#000,${p}44)` : h === 'sunset' ? `linear-gradient(160deg,${a},${p})` : `linear-gradient(135deg,${p},${a} 140%)`;
  // Tiny static preview of a shop page in a theme (landing mockup, wizard theme cards).
  function miniShop(th, name, emoji = '🍕', cart = false) {
    return `<div class="nz-mini" style="--p:${th.primary};--a:${th.accent};--bg:${th.bg};--card:${th.card};--t:${th.text};--r:${Math.min(th.radius, 18)}px;font-family:${FONT_CSS[th.font]}">
      <div class="nz-mini__hero" style="background:${HERO_BG(th.primary, th.accent, th.hero)}"><b>${esc(name)}</b><span>${emoji}</span></div>
      <div class="nz-mini__chips"><i style="background:var(--p)"></i><i></i><i></i></div>
      <div class="nz-mini__item"><u>${emoji}</u><div><b></b><b class="s"></b></div><em></em></div><div class="nz-mini__item"><u>🍅</u><div><b></b><b class="s"></b></div><em></em></div>
      ${cart ? '<div class="nz-mini__cart"></div>' : ''}</div>`;
  }

  // ---------------- landing ----------------
  function landing() {
    const feats = [['🎨', 'f1'], ['📋', 'f2'], ['🔔', 'f3'], ['🌍', 'f4'], ['📱', 'f5'], ['👍', 'f6']];
    const th = me && me.themes ? me.themes.tomato : { primary: '#D62F25', accent: '#2E7D4F', bg: '#FFF6EC', card: '#fff', text: '#2B1B14', radius: 16, font: 'serif', hero: 'gradient' };
    $app.innerHTML = `${publicTop(`<nav class="nz-lnav nz-hide-sm"><a href="#" data-sc="features">${t('a.features')}</a><a href="#" data-sc="pricing">${t('a.pricing')}</a></nav>`).replace('<span class="nz-grow"></span>', '<span class="nz-grow"></span><a class="nz-btn nz-btn--secondary nz-btn--sm" href="#/login">' + t('a.login') + '</a>').replace('</div></header>', '<a class="nz-btn nz-btn--dark nz-btn--sm" href="#/signup">' + t('a.startShort') + '</a></div></header>')}
      <section class="nz-hero"><div class="nz-hero__txt"><span class="nz-kicker">🍕🍔🌮 ${t('a.heroKicker')}</span>
        <h1 class="nz-display nz-hero__h">${t('a.heroTitleA')}<br><span class="nz-gradtext">${t('a.heroTitleB')}</span></h1><p class="nz-hero__p">${t('a.heroSub')}</p>
        <div class="nz-actions"><a class="nz-btn nz-btn--primary nz-btn--lg" href="#/signup">${t('a.startFree')}</a><button type="button" class="nz-btn nz-btn--secondary nz-btn--lg" id="demo">${t('a.seeDemo')}</button></div>
        <p class="nz-ok">${icon('check', 20)} ${t('a.ctaNote')}</p></div>
        <div class="nz-hero__art"><div class="nz-hero__panel"></div><div class="nz-phone nz-phone--lg">${miniShop(th, 'Bella Napoli', '🍕', true)}</div>
          <div class="nz-float nz-float--a"><span class="nz-bell">🛎️</span><span><b>${t('a.mockOrder')}</b><small>${t('a.mockOrderSub')}</small></span></div>
          <div class="nz-float nz-float--b"><span class="nz-badge nz-badge--ready">${icon('check', 16)} ${t('a.mockSaved')}</span></div>
          <div class="nz-float nz-float--c"><span class="nz-badge nz-badge--info">EN</span><span class="nz-badge nz-badge--info">FR</span><span class="nz-badge nz-badge--info">ع</span></div></div></section>
      <section class="nz-sec" id="features"><h2 class="nz-display nz-sec__h">${t('a.featTitle')}</h2><div class="nz-cards" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))">${feats.map(([e, k]) => `<div class="nz-card nz-feat"><span class="nz-feat__ico">${e}</span><h3>${t('a.' + k + 't')}</h3><p>${t('a.' + k + 'd')}</p></div>`).join('')}</div></section>
      <section class="nz-sec" id="pricing"><h2 class="nz-display nz-sec__h">${t('a.priceTitle')}</h2><p class="nz-sub" style="text-align:center;margin-bottom:28px">${t('a.priceSub')}</p>
        <div class="nz-plans" style="max-width:820px;margin:auto">${['starter', 'pro'].map((p) => `<div class="nz-plan nz-plan--${p}">${p === 'pro' ? `<span class="nz-pop">⭐ ${t('a.popular')}</span>` : ''}<div><h3 class="nz-h3">${p === 'pro' ? 'Pro' : 'Starter'}</h3><span style="opacity:.8">${t('a.' + p + 'Desc')}</span></div>
          <div class="nz-plan__price">$${p === 'pro' ? 19 : 9}<small> ${t('a.perMonth')}</small></div><ul>${(p === 'pro' ? ['p1', 'p2', 'p3', 'p4'] : ['s1', 's2', 's3', 's4']).map((k) => `<li>${icon('check', 20)}<span>${t('a.' + k)}</span></li>`).join('')}</ul>
          <a class="nz-btn ${p === 'pro' ? 'nz-btn--primary' : 'nz-btn--secondary'} nz-btn--lg" href="#/signup">${t('a.startFree')}</a></div>`).join('')}</div></section>
      <section class="nz-sec"><div class="nz-trial"><span class="nz-trial__big">3</span><div style="flex:1;min-width:240px"><h2 class="nz-display" style="font-size:36px;margin:0 0 8px">${t('a.trialTitle')}</h2><p style="margin:0;font-size:19px">${t('a.trialText')}</p></div><a class="nz-btn nz-btn--dark nz-btn--lg" href="#/signup">${t('a.startFree')}</a></div></section>
      <footer class="nz-foot"><div class="nz-ptop__in">${NZUI.logo(32)}<span class="nz-grow"></span><a href="#">${t('a.help')}</a><a href="#">${t('a.privacy')}</a><a href="#">${t('a.terms')}</a><a href="#">${t('a.contact')}</a></div><p>${t('a.rights')}</p></footer>`;
    bindLang();
    $$('[data-sc]').forEach((a) => a.onclick = (e) => { e.preventDefault(); document.getElementById(a.dataset.sc).scrollIntoView({ behavior: 'smooth' }); });
    $('#demo').onclick = () => NZUI.modal({ title: t('a.seeDemo'), label: t('a.cancel'), html: `<div class="nz-peach" style="padding:24px"><div class="nz-phone nz-phone--lg" style="width:280px;height:560px">${miniShop(th, 'Bella Napoli', '🍕', true)}</div></div><div class="nz-modal__foot"><a class="nz-btn nz-btn--primary" href="#/signup" data-nz-close>${t('a.startFree')}</a></div>` });
  }

  // ---------------- sign up / log in ----------------
  function authView(mode) {
    const su = mode === 'signup';
    $app.innerHTML = `${publicTop()}<main class="nz-auth"><div class="nz-card nz-authcard"><div style="text-align:center;margin-bottom:20px"><div style="font-size:44px">${su ? '🍕' : '👋'}</div><h1 class="nz-h2">${t(su ? 'a.signupTitle' : 'a.loginTitle')}</h1><p class="nz-sub">${t(su ? 'a.signupSub' : 'a.loginSub')}</p></div>
      ${su ? `<div class="nz-banner" style="margin-bottom:20px"><span style="font-size:28px">🎁</span><div class="nz-banner__txt"><b>${t('a.trialGift', { date: dateStr(Date.now() + 90 * 86400000) })}</b><span>${t('a.trialGiftSub')}</span></div></div>` : ''}
      <form id="f" novalidate>${field(t('a.email'), `<input class="nz-input nz-input--lg nz-ltr" type="email" name="email" id="em" autocomplete="email" placeholder="${t('a.emailPh')}" required autofocus>`)}
        <div class="nz-field"><label class="nz-label" for="pw"><span>${t('a.password')}</span>${su ? '' : `<a href="#/login" id="forgot" style="font-weight:600;font-size:16px">${t('a.forgot')}</a>`}</label>
          <div class="nz-group" style="min-height:64px"><input class="nz-input nz-input--lg nz-ltr" type="password" name="password" id="pw" autocomplete="${su ? 'new-password' : 'current-password'}" minlength="8" required><button type="button" class="nz-btn nz-btn--secondary nz-btn--sm" id="showpw" style="border:0">${t('a.show')}</button></div>
          ${su ? `<span class="nz-hint">${t('a.pwHint')}</span>` : ''}</div>
        <div class="nz-error" id="err" role="alert" hidden></div>
        <button class="nz-btn nz-btn--primary nz-btn--lg nz-btn--block" id="go" style="margin-top:12px">${t(su ? 'a.signupBtn' : 'a.loginBtn')}</button></form>
      ${su ? `<p style="text-align:center;color:var(--nz-ink-3);font-size:15px;margin:14px 0 0">🔒 ${t('a.neverShare')}</p>` : ''}
      <p style="text-align:center;margin:20px 0 0">${su ? t('a.haveAccount') : t('a.noAccount')} <a href="#/${su ? 'login' : 'signup'}" style="font-weight:700">${t(su ? 'a.login' : 'a.startShort')}</a></p></div></main>`;
    bindLang();
    const fe = $('#forgot'); if (fe) fe.onclick = (e) => { e.preventDefault(); };
    if (fe) fe.remove(); // no password-reset flow yet
    $('#showpw').onclick = (e) => { const i = $('#pw'); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; e.target.textContent = t(show ? 'a.hide' : 'a.show'); };
    $('#f').onsubmit = async (e) => {
      e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); const er = $('#err'); er.hidden = true;
      $('#go').classList.add('is-loading');
      try { await api('POST', su ? '/api/signup' : '/api/login', { ...d, lang }); me = null; await load(); location.hash = me.shop ? '#/home' : '#/setup'; route(); }
      catch (x) { $('#go').classList.remove('is-loading'); er.hidden = false; er.textContent = '⚠️ ' + (x.message === 'credentials' ? t('a.pwError') : errMsg(x)); $('#pw').classList.add('is-error'); }
    };
  }

  // ---------------- setup wizard ----------------
  function wizard() {
    const w = wizard.s || (wizard.s = { step: 1, name: '', type: 'pizzeria', langs: [lang], theme: 'tomato', phone: '', wa: true });
    if (w.done) return wizardDone(w.done);
    const types = me.starters;
    const titles = { 1: ['a.w1Title', 'a.w1Sub'], 2: ['a.w2Title', 'a.w2Sub'], 3: ['a.w3Title', 'a.w3Sub'], 4: ['a.w4Title', ''] };
    let body = '';
    if (w.step === 1) body = `<div class="nz-tiles">${types.map((x) => `<button type="button" class="nz-chip nz-chip--tile" data-type="${x}" aria-pressed="${w.type === x}"><span class="nz-chip__emoji">${TYPE_EMOJI[x]}</span>${t('a.' + TYPE_KEY[x])}<span class="nz-chip__check">${icon('check', 16)}</span></button>`).join('')}</div>
      <div style="margin-top:24px">${field(t('a.nameLabel'), `<input class="nz-input nz-input--lg" id="name" maxlength="60" value="${esc(w.name)}" placeholder="${t('a.namePh')}" autofocus>`)}<div class="nz-error" id="err" role="alert" hidden></div></div>`;
    if (w.step === 2) body = `<div class="nz-stack" style="gap:12px">${LANGS.map((l) => `<button type="button" class="nz-chip" style="min-height:80px" data-l="${l}" aria-pressed="${w.langs.includes(l)}"><span style="font-size:32px">${{ en: '🇬🇧', fr: '🇫🇷', ar: '🇸🇦' }[l]}</span><span>${t('a.langNative').length && { en: 'English', fr: 'Français', ar: 'العربية' }[l]}</span><span class="nz-chip__check">${icon('check', 18)}</span></button>`).join('')}</div><div class="nz-note" style="margin-top:16px">${icon('globe')}<span>${t('a.w2Note')}</span></div>`;
    if (w.step === 3) body = `<div class="nz-themes nz-themes--big">${Object.entries(me.themes).map(([k, p]) => `<button type="button" class="nz-theme" data-th="${k}" aria-pressed="${w.theme === k}">${miniShop(p, w.name || t('a.namePh'), TYPE_EMOJI[w.type])}<span style="display:block;margin-top:8px">${t('theme.' + k)}</span></button>`).join('')}</div>`;
    if (w.step === 4) body = `${field(t('a.phoneLabel'), `<input class="nz-input nz-input--lg nz-ltr" type="tel" id="phone" value="${esc(w.phone)}" placeholder="+1 555 000 000" autofocus>`, t('a.phoneHint'))}${sw('wa', t('a.hasWa'), '', w.wa)}`;
    $app.innerHTML = `<div class="nz-wiz"><header class="nz-ptop nz-ptop--wiz"><div class="nz-ptop__in"><a href="#/" aria-label="Napizzo">${NZUI.logo(36)}</a><span class="nz-grow" style="text-align:center;font-weight:700">${t('a.stepOf', { n: w.step })}</span>${langSeg()}</div>
        <div class="nz-steps" role="progressbar" aria-valuemin="1" aria-valuemax="4" aria-valuenow="${w.step}" aria-label="${t('a.stepOf', { n: w.step })}">${[1, 2, 3, 4].map((i) => `<i class="${i <= w.step ? 'on' : ''}"></i>`).join('')}</div></header>
      <main class="nz-wiz__main"><div class="nz-wiz__step"><h1 class="nz-h1" style="font-size:34px">${t(titles[w.step][0])}</h1>${titles[w.step][1] ? `<p class="nz-sub" style="margin-bottom:24px">${t(titles[w.step][1])}</p>` : '<div style="height:24px"></div>'}${body}</div></main>
      <footer class="nz-wiz__foot"><div class="nz-wiz__footin">${w.step > 1 ? `<button type="button" class="nz-btn nz-btn--secondary nz-btn--lg" id="back">${icon('chevron', 20).replace('nz-icon', 'nz-icon nz-flip-always')}${t('a.back')}</button>` : '<span></span>'}
        <button type="button" class="nz-btn ${w.step === 4 ? 'nz-btn--primary' : 'nz-btn--dark'} nz-btn--lg" id="next" style="flex:1;max-width:420px">${w.step === 4 ? t('a.create') + ' 🎉' : t('a.next')}</button></div></footer></div>`;
    bindLang();
    $$('[data-type]').forEach((b) => b.onclick = () => { w.name = $('#name').value; w.type = b.dataset.type; wizard(); });
    $$('[data-th]').forEach((b) => b.onclick = () => { w.theme = b.dataset.th; wizard(); });
    $$('[data-l]').forEach((b) => b.onclick = () => { const l = b.dataset.l; w.langs = w.langs.includes(l) ? w.langs.filter((x) => x !== l) : [...w.langs, l]; if (!w.langs.length) w.langs = [l]; wizard(); });
    if ($('#wa')) $('#wa').onchange = (e) => { w.wa = e.target.getAttribute('aria-checked') === 'true'; };
    if ($('#back')) $('#back').onclick = () => { if ($('#phone')) w.phone = $('#phone').value; w.step--; wizard(); };
    const nameEl = $('#name'); if (nameEl) nameEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#next').click(); });
    $('#next').onclick = async () => {
      if (w.step === 1) { w.name = $('#name').value.trim(); if (!w.name) { const er = $('#err'); er.hidden = false; er.textContent = '⚠️ ' + t('err.name'); $('#name').classList.add('is-error'); $('#name').focus(); return; } }
      if (w.step < 4) { w.step++; wizard(); return; }
      w.phone = $('#phone').value.trim(); const btn = $('#next'); btn.classList.add('is-loading'); btn.disabled = true;
      try {
        await new Promise((r) => setTimeout(r, 900));
        await api('POST', '/api/shop', { name: w.name, type: w.type, langs: w.langs, theme: w.theme, phone: w.phone, default_lang: w.langs.includes(lang) ? lang : w.langs[0] });
        if (w.wa && w.phone) await api('PUT', '/api/shop', { whatsapp: w.phone });
        me = null; await load(); w.done = true; wizard.s = { done: me.shop };
        wizardDone(me.shop);
      } catch (x) { btn.classList.remove('is-loading'); btn.disabled = false; toast(errMsg(x)); }
    };
  }
  function wizardDone(shop) {
    const confetti = ['🍕', '🎉', '🍅', '✨', '🧀', '🎊', '🌿', '🍔', '🌮'];
    $app.innerHTML = `<div class="nz-wiz"><main class="nz-wiz__main" style="text-align:center;position:relative;overflow:hidden"><div class="nz-wiz__step" style="max-width:560px">
      ${confetti.map((c, i) => `<span class="nz-confetti" style="inset-inline-start:${8 + i * 10}%;animation-delay:${i * 0.18}s" aria-hidden="true">${c}</span>`).join('')}
      <div class="nz-done-tile">🎉</div><h1 class="nz-h1">${t('a.doneTitle')}</h1><p class="nz-sub" style="margin-bottom:20px">${t('a.doneSub')}</p>
      <div class="nz-urlbox" style="justify-content:center;margin-bottom:24px">${esc(shortUrl(shop))}</div>
      <div class="nz-actions" style="justify-content:center"><button type="button" class="nz-btn nz-btn--primary nz-btn--lg" id="dash">${t('a.goDash')}</button><a class="nz-btn nz-btn--secondary nz-btn--lg" target="_blank" rel="noopener" href="${esc(shopUrl(shop))}">${icon('external', 20)}${t('a.viewPage')}</a></div></div></main></div>`;
    $('#dash').onclick = () => { wizard.s = null; location.hash = '#/home'; route(); };
  }

  setLang(lang);
  route();
})();
