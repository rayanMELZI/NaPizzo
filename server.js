const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { open } = require('./lib/db');
const { THEMES, STARTERS, DEFAULT_SECTIONS, defaultHours } = require('./lib/templates');
const { render, unavailablePage } = require('./lib/shop-page');

const LANGS = ['en', 'fr', 'ar'];
const DAY = 86400000;
const TRIAL_DAYS = 90;
const PLANS = { starter: { price: 9, maxItems: 40 }, pro: { price: 19, maxItems: Infinity } };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon' };
const IMG_EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };

function createApp({ dbFile = path.join(__dirname, 'data', 'napizzo.db'), uploadDir = path.join(__dirname, 'data', 'uploads') } = {}) {
  const db = open(dbFile);
  fs.mkdirSync(uploadDir, { recursive: true });
  const J = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
  const hits = new Map();
  const limited = (key, max, ms = 600000) => {
    const now = Date.now(); const a = (hits.get(key) || []).filter((t) => now - t < ms);
    a.push(now); hits.set(key, a); return a.length > max;
  };

  class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
  const bad = (m, s = 400) => { throw new HttpError(s, m); };

  // ---------- helpers ----------
  const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
  const parseCookies = (h = '') => Object.fromEntries(h.split(';').map((c) => c.trim().split('=')).filter((c) => c[0]).map(([k, ...v]) => [k, v.join('=')]));
  const shopRow = (r) => r && ({ ...r, langs: J(r.langs, ['en']), config: J(r.config, {}), hours: J(r.hours, defaultHours()) });
  const access = (s) => { const n = Date.now(); return s.paid_until > n ? 'paid' : s.trial_ends > n ? 'trial' : 'expired'; };
  const pubShop = (s) => ({ ...s, access: access(s), daysLeft: Math.max(0, Math.ceil(((access(s) === 'paid' ? s.paid_until : s.trial_ends) - Date.now()) / DAY)) });

  function body(req, limit = 1e6) {
    return new Promise((res, rej) => {
      const chunks = []; let n = 0;
      req.on('data', (c) => { n += c.length; if (n > limit) { rej(new HttpError(413, 'Too large')); req.destroy(); } else chunks.push(c); });
      req.on('end', () => res(Buffer.concat(chunks)));
      req.on('error', rej);
    });
  }
  async function jbody(req) {
    const b = await body(req);
    if (!b.length) return {};
    try { return JSON.parse(b.toString()); } catch { return bad('Invalid JSON'); }
  }
  const send = (res, status, data, headers = {}) => {
    const isStr = typeof data === 'string';
    res.writeHead(status, { 'Content-Type': isStr ? 'text/html; charset=utf-8' : 'application/json', 'X-Content-Type-Options': 'nosniff', ...headers });
    res.end(isStr ? data : JSON.stringify(data));
  };

  function session(req) {
    const t = parseCookies(req.headers.cookie).sid;
    if (!t) return null;
    const r = db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?').get(t, Date.now());
    return r || null;
  }
  function login(res, userId) {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(token, userId, Date.now() + 30 * DAY);
    return { 'Set-Cookie': `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 86400}` };
  }
  const myShop = (u) => shopRow(db.prepare('SELECT * FROM shops WHERE user_id=?').get(u.id));

  function makeSlug(name) {
    let base = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
    if (base.length < 3) base = 'shop-' + crypto.randomBytes(2).toString('hex');
    let slug = base, i = 2;
    while (db.prepare('SELECT 1 FROM shops WHERE slug=?').get(slug) || ['api', 'uploads', 's', 'app'].includes(slug)) slug = `${base}-${i++}`;
    return slug;
  }

  const cleanLangs = (l) => { const a = LANGS.filter((x) => Array.isArray(l) && l.includes(x)); return a.length ? a : ['en']; };
  const str = (v, max) => String(v ?? '').trim().slice(0, max);
  const num = (v, min, max, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
  const loc = (o, langs) => { const r = {}; if (o && typeof o === 'object') for (const l of LANGS) if (o[l] !== undefined) r[l] = str(o[l], 300); return r; };

  function cleanConfig(c, old) {
    const th = { ...old.theme, ...(c.theme || {}) };
    const hex = (v, d) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : d);
    const theme = { primary: hex(th.primary, '#e63946'), accent: hex(th.accent, '#ffb703'), bg: hex(th.bg, '#fff8f1'), card: hex(th.card, '#ffffff'),
      text: hex(th.text, '#2b2118'), radius: num(th.radius, 0, 40, 16), font: ['modern', 'rounded', 'serif'].includes(th.font) ? th.font : 'modern',
      hero: ['gradient', 'sunset', 'dark'].includes(th.hero) ? th.hero : 'gradient' };
    let sections = old.sections;
    if (Array.isArray(c.sections)) {
      const ids = DEFAULT_SECTIONS.map((s) => s.id); const seen = new Set();
      sections = c.sections.filter((s) => ids.includes(s.id) && !seen.has(s.id) && seen.add(s.id)).map((s) => ({ id: s.id, on: !!s.on }));
      for (const id of ids) if (!seen.has(id)) sections.push({ id, on: true });
    }
    const url = (v) => (/^(\/uploads\/[\w.-]+|https?:\/\/[^\s"'<>]+)?$/.test(v) ? v : '');
    const texts = { ...(old.texts || {}) };
    if (c.texts && typeof c.texts === 'object') for (const l of LANGS) if (c.texts[l]) texts[l] = { tagline: str(c.texts[l].tagline, 160), about: str(c.texts[l].about, 1200) };
    return { theme, sections, texts, heroImage: c.heroImage !== undefined ? url(c.heroImage) : old.heroImage || '', logo: c.logo !== undefined ? url(c.logo) : old.logo || '' };
  }

  function seedMenu(shopId, type, langs) {
    const st = STARTERS[type] || STARTERS.other;
    const ci = db.prepare('INSERT INTO categories (shop_id,name,emoji,pos) VALUES (?,?,?,?)');
    const ii = db.prepare('INSERT INTO items (shop_id,category_id,name,descr,price,pos) VALUES (?,?,?,?,?,?)');
    st.categories.forEach((c, ci_) => {
      const cid = ci.run(shopId, JSON.stringify(c.name), c.emoji, ci_).lastInsertRowid;
      c.items.forEach(([n, d, p], k) => ii.run(shopId, cid, JSON.stringify(n), JSON.stringify(d), p, k));
    });
  }

  // ---------- routes ----------
  const routes = [];
  const R = (method, re, auth, fn) => routes.push({ method, re: new RegExp(`^${re}$`), auth, fn });

  R('POST', '/api/signup', false, async (req, res) => {
    if (limited('su' + req.socket.remoteAddress, 10)) bad('Too many attempts', 429);
    const { email, password, lang } = await jbody(req);
    const e = str(email, 120).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) bad('email');
    if (String(password || '').length < 8) bad('password');
    if (db.prepare('SELECT 1 FROM users WHERE email=?').get(e)) bad('exists', 409);
    const salt = crypto.randomBytes(16).toString('hex');
    const id = db.prepare('INSERT INTO users (email,salt,hash,lang,created_at) VALUES (?,?,?,?,?)').run(e, salt, hashPw(password, salt), LANGS.includes(lang) ? lang : 'en', Date.now()).lastInsertRowid;
    send(res, 200, { ok: true }, login(res, id));
  });
  R('POST', '/api/login', false, async (req, res) => {
    if (limited('li' + req.socket.remoteAddress, 15)) bad('Too many attempts', 429);
    const { email, password } = await jbody(req);
    const u = db.prepare('SELECT * FROM users WHERE email=?').get(str(email, 120).toLowerCase());
    const ok = u && crypto.timingSafeEqual(Buffer.from(hashPw(String(password || ''), u.salt), 'hex'), Buffer.from(u.hash, 'hex'));
    if (!ok) bad('credentials', 401);
    send(res, 200, { ok: true }, login(res, u.id));
  });
  R('POST', '/api/logout', false, (req, res) => {
    const t = parseCookies(req.headers.cookie).sid;
    if (t) db.prepare('DELETE FROM sessions WHERE token=?').run(t);
    send(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; Path=/; Max-Age=0' });
  });
  R('GET', '/api/me', false, (req, res) => {
    const u = session(req);
    if (!u) return send(res, 200, { user: null });
    const s = myShop(u);
    send(res, 200, { user: { email: u.email, lang: u.lang }, shop: s && pubShop(s), plans: PLANS, themes: THEMES, starters: Object.keys(STARTERS) });
  });
  R('PUT', '/api/me/lang', true, async (req, res, u) => {
    const { lang } = await jbody(req);
    if (LANGS.includes(lang)) db.prepare('UPDATE users SET lang=? WHERE id=?').run(lang, u.id);
    send(res, 200, { ok: true });
  });

  R('POST', '/api/shop', true, async (req, res, u) => {
    if (myShop(u)) bad('exists', 409);
    const b = await jbody(req);
    const name = str(b.name, 60); if (!name) bad('name');
    const type = STARTERS[b.type] ? b.type : 'other';
    const langs = cleanLangs(b.langs);
    const dl = langs.includes(b.default_lang) ? b.default_lang : langs[0];
    const theme = THEMES[b.theme] || THEMES.tomato;
    const st = STARTERS[type];
    const texts = {}; for (const l of LANGS) texts[l] = { tagline: st.tagline[l], about: st.about[l] };
    const config = { theme, sections: DEFAULT_SECTIONS, texts, heroImage: '', logo: '' };
    const now = Date.now();
    const id = db.prepare(`INSERT INTO shops (user_id,slug,name,type,langs,default_lang,config,phone,hours,trial_ends,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(u.id, makeSlug(name), name, type, JSON.stringify(langs), dl, JSON.stringify(config), str(b.phone, 30), JSON.stringify(defaultHours()), now + TRIAL_DAYS * DAY, now).lastInsertRowid;
    seedMenu(id, type, langs);
    send(res, 200, { shop: pubShop(myShop(u)) });
  });
  R('PUT', '/api/shop', true, async (req, res, u) => {
    const s = myShop(u); if (!s) bad('no shop', 404);
    const b = await jbody(req);
    const langs = b.langs ? cleanLangs(b.langs) : s.langs;
    const up = {
      name: b.name !== undefined ? str(b.name, 60) || s.name : s.name,
      langs: JSON.stringify(langs),
      default_lang: langs.includes(b.default_lang) ? b.default_lang : langs.includes(s.default_lang) ? s.default_lang : langs[0],
      config: JSON.stringify(b.config ? cleanConfig(b.config, s.config) : s.config),
      phone: b.phone !== undefined ? str(b.phone, 30) : s.phone,
      whatsapp: b.whatsapp !== undefined ? str(b.whatsapp, 30) : s.whatsapp,
      address: b.address !== undefined ? str(b.address, 200) : s.address,
      currency: b.currency !== undefined ? str(b.currency, 6) || '$' : s.currency,
      hours: JSON.stringify(Array.isArray(b.hours) && b.hours.length === 7 ? b.hours.map((h) => ({ open: /^\d\d:\d\d$/.test(h.open) ? h.open : '10:00', close: /^\d\d:\d\d$/.test(h.close) ? h.close : '23:00', closed: !!h.closed })) : s.hours),
      delivery: b.delivery !== undefined ? +!!b.delivery : s.delivery,
      delivery_fee: b.delivery_fee !== undefined ? num(b.delivery_fee, 0, 1e4, 0) : s.delivery_fee,
      min_order: b.min_order !== undefined ? num(b.min_order, 0, 1e5, 0) : s.min_order,
      accepting: b.accepting !== undefined ? +!!b.accepting : s.accepting,
    };
    let slug = s.slug;
    if (b.slug !== undefined && b.slug !== s.slug) {
      const v = String(b.slug).toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(v) || ['api', 'uploads', 's', 'app'].includes(v)) bad('slug');
      if (db.prepare('SELECT 1 FROM shops WHERE slug=?').get(v)) bad('slug-taken', 409);
      slug = v;
    }
    db.prepare(`UPDATE shops SET slug=@slug,name=@name,langs=@langs,default_lang=@default_lang,config=@config,phone=@phone,whatsapp=@whatsapp,address=@address,
      currency=@currency,hours=@hours,delivery=@delivery,delivery_fee=@delivery_fee,min_order=@min_order,accepting=@accepting WHERE id=@id`).run({ ...up, slug, id: s.id });
    send(res, 200, { shop: pubShop(myShop(u)) });
  });

  // menu
  const menuOf = (sid) => ({
    cats: db.prepare('SELECT * FROM categories WHERE shop_id=? ORDER BY pos,id').all(sid).map((c) => ({ ...c, name: J(c.name, {}) })),
    items: db.prepare('SELECT * FROM items WHERE shop_id=? ORDER BY pos,id').all(sid).map((i) => ({ ...i, name: J(i.name, {}), descr: J(i.descr, {}) })),
  });
  const needShop = (u) => myShop(u) || bad('no shop', 404);
  R('GET', '/api/menu', true, (req, res, u) => send(res, 200, menuOf(needShop(u).id)));
  R('POST', '/api/categories', true, async (req, res, u) => {
    const s = needShop(u); const b = await jbody(req);
    const pos = (db.prepare('SELECT MAX(pos) m FROM categories WHERE shop_id=?').get(s.id).m ?? -1) + 1;
    db.prepare('INSERT INTO categories (shop_id,name,emoji,pos) VALUES (?,?,?,?)').run(s.id, JSON.stringify(loc(b.name, s.langs)), str(b.emoji, 8) || '🍽️', pos);
    send(res, 200, menuOf(s.id));
  });
  R('PUT', '/api/categories/(\\d+)', true, async (req, res, u, id) => {
    const s = needShop(u); const b = await jbody(req);
    const c = db.prepare('SELECT * FROM categories WHERE id=? AND shop_id=?').get(id, s.id) || bad('not found', 404);
    db.prepare('UPDATE categories SET name=?,emoji=?,pos=? WHERE id=?').run(b.name ? JSON.stringify(loc(b.name, s.langs)) : c.name, b.emoji !== undefined ? str(b.emoji, 8) : c.emoji, b.pos !== undefined ? num(b.pos, 0, 1e4, c.pos) : c.pos, c.id);
    send(res, 200, menuOf(s.id));
  });
  R('DELETE', '/api/categories/(\\d+)', true, (req, res, u, id) => {
    const s = needShop(u);
    db.prepare('DELETE FROM categories WHERE id=? AND shop_id=?').run(id, s.id);
    send(res, 200, menuOf(s.id));
  });
  const itemCount = (sid) => db.prepare('SELECT COUNT(*) n FROM items WHERE shop_id=?').get(sid).n;
  const maxItems = (s) => (access(s) === 'paid' && s.plan === 'starter' ? PLANS.starter.maxItems : access(s) === 'paid' ? PLANS[s.plan]?.maxItems ?? Infinity : Infinity);
  const imgUrl = (v) => (/^(\/uploads\/[\w.-]+|https?:\/\/[^\s"'<>]+)?$/.test(v || '') ? v || '' : '');
  R('POST', '/api/items', true, async (req, res, u) => {
    const s = needShop(u); const b = await jbody(req);
    if (!db.prepare('SELECT 1 FROM categories WHERE id=? AND shop_id=?').get(b.category_id, s.id)) bad('category');
    if (itemCount(s.id) >= maxItems(s)) bad('limit', 402);
    const pos = (db.prepare('SELECT MAX(pos) m FROM items WHERE category_id=?').get(b.category_id).m ?? -1) + 1;
    db.prepare('INSERT INTO items (shop_id,category_id,name,descr,price,image,available,pos) VALUES (?,?,?,?,?,?,?,?)')
      .run(s.id, b.category_id, JSON.stringify(loc(b.name, s.langs)), JSON.stringify(loc(b.descr, s.langs)), num(b.price, 0, 1e6, 0), imgUrl(b.image), +(b.available !== false), pos);
    send(res, 200, menuOf(s.id));
  });
  R('PUT', '/api/items/(\\d+)', true, async (req, res, u, id) => {
    const s = needShop(u); const b = await jbody(req);
    const i = db.prepare('SELECT * FROM items WHERE id=? AND shop_id=?').get(id, s.id) || bad('not found', 404);
    const cat = b.category_id && db.prepare('SELECT 1 FROM categories WHERE id=? AND shop_id=?').get(b.category_id, s.id) ? b.category_id : i.category_id;
    db.prepare('UPDATE items SET category_id=?,name=?,descr=?,price=?,image=?,available=? WHERE id=?').run(cat,
      b.name ? JSON.stringify(loc(b.name, s.langs)) : i.name, b.descr ? JSON.stringify(loc(b.descr, s.langs)) : i.descr,
      b.price !== undefined ? num(b.price, 0, 1e6, i.price) : i.price, b.image !== undefined ? imgUrl(b.image) : i.image,
      b.available !== undefined ? +!!b.available : i.available, i.id);
    send(res, 200, menuOf(s.id));
  });
  R('DELETE', '/api/items/(\\d+)', true, (req, res, u, id) => {
    const s = needShop(u);
    db.prepare('DELETE FROM items WHERE id=? AND shop_id=?').run(id, s.id);
    send(res, 200, menuOf(s.id));
  });

  // orders
  R('GET', '/api/orders', true, (req, res, u) => {
    const s = needShop(u);
    const rows = db.prepare('SELECT * FROM orders WHERE shop_id=? ORDER BY id DESC LIMIT 200').all(s.id).map((o) => ({ ...o, lines: J(o.lines, []) }));
    send(res, 200, { orders: rows });
  });
  R('PUT', '/api/orders/(\\d+)', true, async (req, res, u, id) => {
    const s = needShop(u); const { status } = await jbody(req);
    if (!['new', 'preparing', 'ready', 'done', 'cancelled'].includes(status)) bad('status');
    db.prepare('UPDATE orders SET status=? WHERE id=? AND shop_id=?').run(status, id, s.id);
    send(res, 200, { ok: true });
  });

  // billing (demo payment provider: card data is validated then discarded, only last4 kept)
  R('POST', '/api/billing/subscribe', true, async (req, res, u) => {
    const s = needShop(u); const b = await jbody(req);
    if (!PLANS[b.plan]) bad('plan');
    const num_ = String(b.card?.number || '').replace(/\s/g, '');
    const luhn = [...num_].reverse().reduce((t, d, i) => { let n = +d; if (i % 2) { n *= 2; if (n > 9) n -= 9; } return t + n; }, 0) % 10 === 0;
    if (!/^\d{13,19}$/.test(num_) || !luhn) bad('card');
    if (!/^\d{2}\/\d{2}$/.test(b.card?.exp || '')) bad('card');
    if (!/^\d{3,4}$/.test(b.card?.cvc || '')) bad('card');
    const base = Math.max(Date.now(), s.paid_until);
    db.prepare('UPDATE shops SET plan=?,paid_until=?,card_last4=? WHERE id=?').run(b.plan, base + 30 * DAY, num_.slice(-4), s.id);
    send(res, 200, { shop: pubShop(myShop(u)) });
  });
  R('POST', '/api/billing/cancel', true, (req, res, u) => {
    const s = needShop(u);
    db.prepare("UPDATE shops SET card_last4='' WHERE id=?").run(s.id); // access remains until paid_until
    send(res, 200, { shop: pubShop(myShop(u)) });
  });

  R('POST', '/api/upload', true, async (req, res) => {
    const ext = IMG_EXT[(req.headers['content-type'] || '').split(';')[0]];
    if (!ext) bad('type', 415);
    const buf = await body(req, 3e6);
    if (!buf.length) bad('empty');
    const name = crypto.randomBytes(10).toString('hex') + ext;
    fs.writeFileSync(path.join(uploadDir, name), buf);
    send(res, 200, { url: '/uploads/' + name });
  });

  // public
  R('POST', '/api/public/([a-z0-9-]+)/orders', false, async (req, res, _u, slug) => {
    if (limited('or' + req.socket.remoteAddress, 12)) bad('Too many orders, try later', 429);
    const s = shopRow(db.prepare('SELECT * FROM shops WHERE slug=?').get(slug)) || bad('not found', 404);
    if (access(s) === 'expired' || !s.accepting) bad('closed', 403);
    const b = await jbody(req);
    const kind = b.kind === 'delivery' && s.delivery ? 'delivery' : 'pickup';
    const customer = str(b.customer, 80), phone = str(b.phone, 30), address = str(b.address, 200);
    if (!customer || !phone) bad('info'); if (kind === 'delivery' && !address) bad('address');
    if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 60) bad('lines');
    const lines = []; let total = 0;
    for (const l of b.lines) {
      const it = db.prepare('SELECT * FROM items WHERE id=? AND shop_id=? AND available=1').get(l.id, s.id) || bad('item');
      const qty = Math.floor(num(l.qty, 1, 99, 1));
      lines.push({ id: it.id, name: J(it.name, {}), price: it.price, qty }); total += it.price * qty;
    }
    if (kind === 'delivery') { if (s.min_order && total < s.min_order) bad('min'); total += s.delivery_fee; }
    const number = (db.prepare('SELECT MAX(number) m FROM orders WHERE shop_id=?').get(s.id).m || 0) + 1;
    db.prepare('INSERT INTO orders (shop_id,number,customer,phone,address,kind,note,lines,total,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(s.id, number, customer, phone, kind === 'delivery' ? address : '', kind, str(b.note, 300), JSON.stringify(lines), Math.round(total * 100) / 100, Date.now());
    send(res, 200, { number });
  });

  function shopPage(req, res, slug, url) {
    const s = shopRow(db.prepare('SELECT * FROM shops WHERE slug=?').get(slug));
    if (!s) return send(res, 404, '<h1>404</h1><p><a href="/">Napizzo</a></p>');
    const u = session(req);
    const owner = u && u.id === s.user_id;
    const lang = url.searchParams.get('lang') || (req.headers['accept-language'] || '').slice(0, 2);
    if (access(s) === 'expired' && !owner) return send(res, 200, unavailablePage(s, s.langs.includes(lang) ? lang : s.default_lang));
    const m = menuOf(s.id);
    send(res, 200, render(s, m.cats, m.items, lang, { preview: url.searchParams.has('preview'), unavailable: access(s) === 'expired' }), { 'Cache-Control': 'no-store' });
  }

  function serveFile(res, file, root, cache) {
    const full = path.resolve(root, '.' + path.sep + file);
    if (!full.startsWith(path.resolve(root) + path.sep)) return send(res, 404, { error: 'not found' });
    fs.readFile(full, (err, data) => {
      if (err) return send(res, 404, { error: 'not found' });
      res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': cache });
      res.end(data);
    });
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = decodeURIComponent(url.pathname);
    try {
      if (p.startsWith('/api/')) {
        if (req.method !== 'GET' && !(req.headers['content-type'] || '').match(/^(application\/json|image\/)/) && req.headers['content-length'] !== '0' && req.headers['content-length'] !== undefined) bad('content-type', 415);
        for (const r of routes) {
          const m = r.method === req.method && p.match(r.re);
          if (!m) continue;
          const u = r.auth ? session(req) || bad('auth', 401) : null;
          return await r.fn(req, res, u, ...m.slice(1));
        }
        return send(res, 404, { error: 'not found' });
      }
      const sm = p.match(/^\/s\/([a-z0-9-]+)\/?$/);
      if (sm && req.method === 'GET') return shopPage(req, res, sm[1], url);
      if (p.startsWith('/uploads/')) return serveFile(res, p.slice(9), uploadDir, 'public, max-age=86400');
      return serveFile(res, p === '/' ? 'index.html' : p.slice(1), path.join(__dirname, 'public'), 'no-cache');
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(e);
      if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'server error' });
    }
  });
  server.on('close', () => db.close());
  return server;
}

module.exports = { createApp };
if (require.main === module) {
  const port = process.env.PORT || 3000;
  const host = process.env.HOST || undefined;
  createApp().listen(port, host, () => console.log(`Napizzo running on http://${host || 'localhost'}:${port}`));
}
