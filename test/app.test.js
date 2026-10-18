const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');
const { I18N } = require('../public/i18n');

let server, base, cookie = '';
test.before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'napizzo-'));
  server = createApp({ dbFile: path.join(dir, 't.db'), uploadDir: path.join(dir, 'up') });
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
test.after(() => server.close());

async function call(method, url, body, headers = {}) {
  const r = await fetch(base + url, { method, headers: { ...(body && typeof body === 'object' && !Buffer.isBuffer(body) ? { 'Content-Type': 'application/json' } : {}), cookie, ...headers },
    body: body && typeof body === 'object' && !Buffer.isBuffer(body) ? JSON.stringify(body) : body });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const ct = r.headers.get('content-type') || '';
  return { status: r.status, data: ct.includes('json') ? await r.json() : await r.text() };
}

test('i18n: all languages have the same keys, and every t() key used exists', () => {
  const en = Object.keys(I18N.en);
  for (const l of ['fr', 'ar']) assert.deepStrictEqual(Object.keys(I18N[l]).sort(), [...en].sort());
  const src = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  for (const m of src.matchAll(/\bt\('([\w.]+)'/g)) if (!m[1].endsWith('.')) assert.ok(I18N.en[m[1]], 'missing key ' + m[1]);
  for (const g of ['d.', 'type.', 'theme.', 'plan.', 'st.', 'act.', 'font.', 'hero.', 'feat.', 'err.', 'nav.']) assert.ok(en.some((k) => k.startsWith(g)));
});

test('full flow: signup, shop, public page, order, billing', async () => {
  assert.strictEqual((await call('POST', '/api/signup', { email: 'a@b.co', password: '123' })).status, 400);
  assert.strictEqual((await call('POST', '/api/signup', { email: 'a@b.co', password: '123456' })).status, 200);
  assert.strictEqual((await call('POST', '/api/signup', { email: 'a@b.co', password: '123456' })).status, 409);
  let me = (await call('GET', '/api/me')).data;
  assert.strictEqual(me.user.email, 'a@b.co'); assert.ok(!me.shop);

  const c = await call('POST', '/api/shop', { name: 'Chez Mario <b>', type: 'pizzeria', langs: ['en', 'ar', 'fr'], theme: 'midnight' });
  assert.strictEqual(c.status, 200);
  const shop = c.data.shop;
  assert.strictEqual(shop.access, 'trial'); assert.ok(shop.daysLeft >= 89);
  assert.ok(shop.slug.startsWith('chez-mario'));

  const page = (await call('GET', `/s/${shop.slug}?lang=ar`)).data;
  assert.match(page, /dir="rtl"/); assert.match(page, /مارغريتا/); assert.ok(!page.includes('Mario <b>')); assert.match(page, /Chez Mario &lt;b&gt;/);

  const menu = (await call('GET', '/api/menu')).data;
  assert.ok(menu.items.length >= 8);
  const margherita = menu.items[0];
  const anon = cookie; cookie = '';
  const ord = await call('POST', `/api/public/${shop.slug}/orders`, { customer: 'Sam', phone: '123', kind: 'pickup', lines: [{ id: margherita.id, qty: 2 }, { id: 99999, qty: 1 }] });
  assert.strictEqual(ord.status, 400);
  const ok = await call('POST', `/api/public/${shop.slug}/orders`, { customer: 'Sam', phone: '123', kind: 'pickup', lines: [{ id: margherita.id, qty: 2 }] });
  assert.strictEqual(ok.data.number, 1);
  cookie = anon;
  const orders = (await call('GET', '/api/orders')).data.orders;
  assert.strictEqual(orders[0].total, 16);
  await call('PUT', `/api/orders/${orders[0].id}`, { status: 'ready' });

  // customization
  const up = await call('PUT', '/api/shop', { config: { theme: { primary: '#123456', radius: 99, font: 'serif' }, sections: [{ id: 'menu', on: true }, { id: 'hero', on: false }], heroImage: 'javascript:alert(1)' }, langs: ['fr'] });
  assert.strictEqual(up.data.shop.config.theme.radius, 40);
  assert.strictEqual(up.data.shop.config.heroImage, '');
  assert.strictEqual(up.data.shop.config.sections.length, 5);
  assert.deepStrictEqual(up.data.shop.langs, ['fr']);
  assert.ok(!(await call('GET', `/s/${shop.slug}`)).data.includes('class="hero"'));

  // billing
  assert.strictEqual((await call('POST', '/api/billing/subscribe', { plan: 'pro', card: { number: '4242 4242 4242 4241', exp: '12/30', cvc: '123' } })).status, 400);
  const pay = await call('POST', '/api/billing/subscribe', { plan: 'pro', card: { number: '4242 4242 4242 4242', exp: '12/30', cvc: '123' } });
  assert.strictEqual(pay.data.shop.access, 'paid'); assert.strictEqual(pay.data.shop.card_last4, '4242');

  // other users cannot touch this data; anonymous is rejected
  cookie = '';
  assert.strictEqual((await call('GET', '/api/menu')).status, 401);
  assert.strictEqual((await call('GET', '/../server.js')).status, 404);
  assert.strictEqual((await call('GET', '/')).status, 200);
});

test('upload accepts images only', async () => {
  await call('POST', '/api/login', { email: 'a@b.co', password: '123456' });
  assert.strictEqual((await call('POST', '/api/upload', Buffer.from('x'), { 'Content-Type': 'text/html' })).status, 415);
  const r = await call('POST', '/api/upload', Buffer.from('89504e47', 'hex'), { 'Content-Type': 'image/png' });
  assert.match(r.data.url, /^\/uploads\/\w+\.png$/);
  assert.strictEqual((await call('GET', r.data.url)).status, 200);
});
