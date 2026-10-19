// Browser-side stand-in for server.js used by the static preview build. Data lives in localStorage.
(function () {
  const { THEMES, STARTERS, DEFAULT_SECTIONS, defaultHours } = require('lib/templates');
  const { render } = require('lib/shop-page');
  const LANGS = ['en', 'fr', 'ar'], DAY = 86400000, KEY = 'napizzo-demo-v1';
  const PLANS = { starter: { price: 9, maxItems: 40 }, pro: { price: 19, maxItems: Infinity } };
  let db = JSON.parse(localStorage.getItem(KEY) || 'null') || { user: null, shop: null, cats: [], items: [], orders: [], seq: 1 };
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  const id = () => db.seq++;
  const err = (status, error) => Object.assign(new Error(error), { status, error });
  const access = (s) => { const n = Date.now(); return s.paid_until > n ? 'paid' : s.trial_ends > n ? 'trial' : 'expired'; };
  const pub = (s) => ({ ...s, access: access(s), daysLeft: Math.max(0, Math.ceil(((access(s) === 'paid' ? s.paid_until : s.trial_ends) - Date.now()) / DAY)) });
  const str = (v, m) => String(v ?? '').trim().slice(0, m);
  const num = (v, a, b, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
  const loc = (o) => { const r = {}; if (o) for (const l of LANGS) if (o[l] !== undefined) r[l] = str(o[l], 300); return r; };
  const menu = () => ({ cats: db.cats, items: db.items });
  const needShop = () => db.shop || (() => { throw err(404, 'no shop'); })();

  function slugOf(name) {
    let b = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
    return b.length < 3 ? 'shop-demo' : b;
  }
  function cleanConfig(c, old) {
    const th = { ...old.theme, ...(c.theme || {}) };
    const hex = (v, d) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : d);
    const theme = { primary: hex(th.primary, '#e63946'), accent: hex(th.accent, '#ffb703'), bg: hex(th.bg, '#fff8f1'), card: hex(th.card, '#ffffff'), text: hex(th.text, '#2b2118'),
      radius: num(th.radius, 0, 40, 16), font: ['modern', 'rounded', 'serif'].includes(th.font) ? th.font : 'modern', hero: ['gradient', 'sunset', 'dark'].includes(th.hero) ? th.hero : 'gradient' };
    const texts = { ...(old.texts || {}) };
    if (c.texts) for (const l of LANGS) if (c.texts[l]) texts[l] = { tagline: str(c.texts[l].tagline, 160), about: str(c.texts[l].about, 1200) };
    return { theme, sections: Array.isArray(c.sections) ? c.sections : old.sections, texts, heroImage: c.heroImage !== undefined ? c.heroImage : old.heroImage, logo: c.logo !== undefined ? c.logo : old.logo };
  }

  const routes = [];
  const R = (m, re, fn) => routes.push([m, new RegExp(`^${re}$`), fn]);
  R('GET', '/api/me', () => db.user ? { user: db.user, shop: db.shop && pub(db.shop), plans: PLANS, themes: THEMES, starters: Object.keys(STARTERS) } : { user: null });
  R('POST', '/api/signup', (b) => { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email || '')) throw err(400, 'email'); if (String(b.password || '').length < 8) throw err(400, 'password'); db.user = { email: b.email, lang: b.lang || 'en' }; return { ok: true }; });
  R('POST', '/api/login', (b) => { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email || '') || !b.password) throw err(401, 'credentials'); db.user = db.user || { email: b.email, lang: 'en' }; return { ok: true }; });
  R('POST', '/api/logout', () => { sessionStorage.demoOut = '1'; return { ok: true }; });
  R('PUT', '/api/me/lang', () => ({ ok: true }));
  R('POST', '/api/shop', (b) => {
    if (db.shop) throw err(409, 'exists');
    const name = str(b.name, 60); if (!name) throw err(400, 'name');
    const type = STARTERS[b.type] ? b.type : 'other', st = STARTERS[type];
    const langs = LANGS.filter((l) => (b.langs || []).includes(l)); if (!langs.length) langs.push('en');
    const texts = {}; for (const l of LANGS) texts[l] = { tagline: st.tagline[l], about: st.about[l] };
    const now = Date.now();
    db.shop = { id: 1, slug: slugOf(name), name, type, langs, default_lang: langs.includes(b.default_lang) ? b.default_lang : langs[0],
      config: { theme: THEMES[b.theme] || THEMES.tomato, sections: DEFAULT_SECTIONS, texts, heroImage: '', logo: '' }, phone: str(b.phone, 30), whatsapp: '', address: '', currency: '$',
      hours: defaultHours(), delivery: 1, delivery_fee: 0, min_order: 0, accepting: 1, plan: 'trial', trial_ends: now + 90 * DAY, paid_until: 0, card_last4: '', created_at: now };
    db.cats = []; db.items = [];
    st.categories.forEach((c, i) => { const cid = id(); db.cats.push({ id: cid, shop_id: 1, name: c.name, emoji: c.emoji, pos: i });
      c.items.forEach(([n, d, p], k) => db.items.push({ id: id(), shop_id: 1, category_id: cid, name: n, descr: d, price: p, image: '', available: 1, pos: k })); });
    return { shop: pub(db.shop) };
  });
  R('PUT', '/api/shop', (b) => {
    const s = needShop();
    if (b.langs) { const l = LANGS.filter((x) => b.langs.includes(x)); s.langs = l.length ? l : ['en']; }
    if (b.default_lang && s.langs.includes(b.default_lang)) s.default_lang = b.default_lang; else if (!s.langs.includes(s.default_lang)) s.default_lang = s.langs[0];
    if (b.config) s.config = cleanConfig(b.config, s.config);
    for (const k of ['name', 'phone', 'whatsapp', 'address', 'currency']) if (b[k] !== undefined) s[k] = str(b[k], 200) || (k === 'currency' ? '$' : k === 'name' ? s.name : '');
    if (b.slug !== undefined && b.slug !== s.slug) { if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(b.slug)) throw err(400, 'slug'); s.slug = b.slug; }
    if (b.delivery !== undefined) s.delivery = +!!b.delivery; if (b.accepting !== undefined) s.accepting = +!!b.accepting;
    if (b.delivery_fee !== undefined) s.delivery_fee = num(b.delivery_fee, 0, 1e4, 0); if (b.min_order !== undefined) s.min_order = num(b.min_order, 0, 1e5, 0);
    if (Array.isArray(b.hours) && b.hours.length === 7) s.hours = b.hours;
    return { shop: pub(s) };
  });
  R('GET', '/api/menu', () => (needShop(), menu()));
  R('POST', '/api/categories', (b) => { needShop(); db.cats.push({ id: id(), shop_id: 1, name: loc(b.name), emoji: str(b.emoji, 8) || '🍽️', pos: db.cats.length }); return menu(); });
  R('PUT', '/api/categories/(\\d+)', (b, i) => { const c = db.cats.find((x) => x.id == i); if (!c) throw err(404, 'not found'); if (b.name) c.name = loc(b.name); if (b.emoji !== undefined) c.emoji = str(b.emoji, 8); return menu(); });
  R('DELETE', '/api/categories/(\\d+)', (b, i) => { db.cats = db.cats.filter((x) => x.id != i); db.items = db.items.filter((x) => x.category_id != i); return menu(); });
  R('POST', '/api/items', (b) => {
    const s = needShop(); if (!db.cats.some((c) => c.id == b.category_id)) throw err(400, 'category');
    if (access(s) === 'paid' && s.plan === 'starter' && db.items.length >= PLANS.starter.maxItems) throw err(402, 'limit');
    db.items.push({ id: id(), shop_id: 1, category_id: +b.category_id, name: loc(b.name), descr: loc(b.descr), price: num(b.price, 0, 1e6, 0), image: b.image || '', available: 1, pos: db.items.length }); return menu();
  });
  R('PUT', '/api/items/(\\d+)', (b, i) => { const it = db.items.find((x) => x.id == i); if (!it) throw err(404, 'not found');
    if (b.name) it.name = loc(b.name); if (b.descr) it.descr = loc(b.descr); if (b.price !== undefined) it.price = num(b.price, 0, 1e6, it.price);
    if (b.image !== undefined) it.image = b.image; if (b.available !== undefined) it.available = +!!b.available; return menu(); });
  R('DELETE', '/api/items/(\\d+)', (b, i) => { db.items = db.items.filter((x) => x.id != i); return menu(); });
  R('GET', '/api/orders', () => ({ orders: [...db.orders].reverse() }));
  R('PUT', '/api/orders/(\\d+)', (b, i) => { const o = db.orders.find((x) => x.id == i); if (o) o.status = b.status; return { ok: true }; });
  R('POST', '/api/billing/subscribe', (b) => {
    const s = needShop(); const n = String(b.card?.number || '').replace(/\s/g, '');
    const luhn = [...n].reverse().reduce((t, d, i) => { let x = +d; if (i % 2) { x *= 2; if (x > 9) x -= 9; } return t + x; }, 0) % 10 === 0;
    if (!PLANS[b.plan] || !/^\d{13,19}$/.test(n) || !luhn || !/^\d{2}\/\d{2}$/.test(b.card.exp || '') || !/^\d{3,4}$/.test(b.card.cvc || '')) throw err(400, 'card');
    s.plan = b.plan; s.paid_until = Math.max(Date.now(), s.paid_until) + 30 * DAY; s.card_last4 = n.slice(-4); return { shop: pub(s) };
  });
  R('POST', '/api/billing/cancel', () => { needShop().card_last4 = ''; return { shop: pub(db.shop) }; });
  R('POST', '/api/public/([a-z0-9-]+)/orders', (b, slug) => {
    const s = db.shop; if (!s || s.slug !== slug) throw err(404, 'not found'); if (access(s) === 'expired' || !s.accepting) throw err(403, 'closed');
    const kind = b.kind === 'delivery' && s.delivery ? 'delivery' : 'pickup';
    if (!str(b.customer, 80) || !str(b.phone, 30)) throw err(400, 'info');
    const lines = []; let total = 0;
    for (const l of b.lines || []) { const it = db.items.find((x) => x.id == l.id && x.available); if (!it) throw err(400, 'item'); const qty = Math.floor(num(l.qty, 1, 99, 1)); lines.push({ id: it.id, name: it.name, price: it.price, qty }); total += it.price * qty; }
    if (!lines.length) throw err(400, 'lines');
    if (kind === 'delivery') { if (s.min_order && total < s.min_order) throw err(400, 'min'); total += s.delivery_fee; }
    const number = db.orders.length + 1;
    db.orders.push({ id: id(), shop_id: 1, number, customer: str(b.customer, 80), phone: str(b.phone, 30), address: kind === 'delivery' ? str(b.address, 200) : '', kind, note: str(b.note, 300), lines, total: Math.round(total * 100) / 100, status: 'new', created_at: Date.now() });
    return { number };
  });

  const realFetch = window.fetch ? window.fetch.bind(window) : () => Promise.reject(new Error('no fetch'));
  window.fetch = async (url, opts = {}) => {
    const path = String(url).split('?')[0];
    if (!path.startsWith('/api/')) return realFetch(url, opts);
    const method = (opts.method || 'GET').toUpperCase();
    try {
      if (path === '/api/upload') {
        const blob = opts.body; const data = await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
        if (data.length > 1.5e6) throw err(413, 'Too large');
        return new Response(JSON.stringify({ url: data }), { status: 200 });
      }
      for (const [m, re, fn] of routes) {
        const mm = m === method && path.match(re); if (!mm) continue;
        if (path === '/api/me' && sessionStorage.demoOut) return new Response(JSON.stringify({ user: null }), { status: 200 });
        if (path === '/api/login' || path === '/api/signup') delete sessionStorage.demoOut;
        const out = fn(opts.body && typeof opts.body === 'string' ? JSON.parse(opts.body) : {}, ...mm.slice(1));
        save();
        return new Response(JSON.stringify(out), { status: 200 });
      }
      throw err(404, 'not found');
    } catch (e) {
      if (!e.status) console.error(e);
      return new Response(JSON.stringify({ error: e.error || 'server error' }), { status: e.status || 500 });
    }
  };

  window.NAPIZZO_DEMO = {
    showShop(spec) {
      const [slug, qs] = spec.split('?'); const q = new URLSearchParams(qs || '');
      const s = db.shop;
      if (!s || s.slug !== slug) { document.body.innerHTML = '<h1 style="font-family:sans-serif;padding:2rem">404</h1>'; return; }
      const lang = q.get('lang') || localStorage.lang || s.default_lang;
      const html = render(s, db.cats, db.items, lang, { preview: q.has('preview'), unavailable: access(s) === 'expired',
        langHref: (l) => `#/s/${slug}?lang=${l}${q.has('preview') ? '&preview=1' : ''}`, shopJs: 'shop.js', home: location.pathname });
      document.querySelectorAll('link[rel=stylesheet],style').forEach((n) => n.remove());
      document.open(); document.write(html); document.close();
      const m = html.match(/<html lang="(\w+)" dir="(\w+)"/); if (m) { document.documentElement.lang = m[1]; document.documentElement.dir = m[2]; }
      window.onhashchange = () => location.reload();
    },
  };
  // small ribbon on the platform pages
  const ribbon = () => {
    if (location.hash.startsWith('#/s/')) return;
    let r = document.getElementById('demo-ribbon');
    if (!r) { r = document.createElement('div'); r.id = 'demo-ribbon'; r.style.cssText = 'background:#1f2430;color:#fff;text-align:center;font:600 13px system-ui;padding:6px'; document.body.prepend(r); }
    const L = I18N[localStorage.lang] || I18N.en; r.textContent = '🧪 ' + L['demo.banner'];
  };
  window.addEventListener('DOMContentLoaded', ribbon); window.addEventListener('hashchange', () => setTimeout(ribbon, 0));
})();
