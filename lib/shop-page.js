// Server-side rendering of a restaurant's public page.
const { I18N } = require('../public/i18n.js');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLOR = /^#[0-9a-fA-F]{6}$/;
const col = (v, d) => (COLOR.test(v) ? v : d);
const FONTS = {
  modern: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Arabic", sans-serif',
  rounded: '"Trebuchet MS", "Varela Round", system-ui, "Noto Sans Arabic", sans-serif',
  serif: 'Georgia, "Times New Roman", "Noto Naskh Arabic", serif',
};
const safeUrl = (u) => (/^(\/uploads\/[\w.-]+|https?:\/\/[^\s"'<>]+|data:image\/(png|jpeg|webp|gif);base64,[\w+/=]+)$/.test(u || '') ? u : '');
const pick = (obj, lang, def) => (obj && (obj[lang] || obj[def] || Object.values(obj).find(Boolean))) || '';

function heroBackground(th) {
  const p = th.primary, a = th.accent;
  if (th.hero === 'dark') return `radial-gradient(circle at 20% 20%, ${a}55, transparent 50%), linear-gradient(135deg, #000 0%, ${p}33 100%)`;
  if (th.hero === 'sunset') return `linear-gradient(160deg, ${a} 0%, ${p} 100%)`;
  return `linear-gradient(135deg, ${p} 0%, ${a} 140%)`;
}

function render(shop, cats, items, lang, { preview = false, unavailable = false, langHref, shopJs = '/shop.js', home = '/' } = {}) {
  const langs = shop.langs;
  if (!langs.includes(lang)) lang = shop.default_lang;
  const S = I18N[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const cfg = shop.config;
  const th = cfg.theme;
  const primary = col(th.primary, '#e63946'), accent = col(th.accent, '#ffb703');
  const T = (cfg.texts && cfg.texts[lang]) || {};
  const tagline = T.tagline || pick(Object.fromEntries(langs.map((l) => [l, cfg.texts?.[l]?.tagline])), lang, shop.default_lang);
  const about = T.about || pick(Object.fromEntries(langs.map((l) => [l, cfg.texts?.[l]?.about])), lang, shop.default_lang);
  const hero = safeUrl(cfg.heroImage);
  const logo = safeUrl(cfg.logo);
  const fmt = (n) => `${Number(n).toFixed(2).replace(/\.00$/, '')} ${esc(shop.currency)}`;
  const dn = (o) => pick(o, lang, shop.default_lang);

  const css = `
:root{--p:${primary};--a:${accent};--bg:${col(th.bg, '#fff8f1')};--card:${col(th.card, '#fff')};--t:${col(th.text, '#222')};--r:${Math.max(0, Math.min(40, +th.radius || 16))}px;--f:${FONTS[th.font] || FONTS.modern}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--t);font-family:var(--f);font-size:17px;line-height:1.5}
a{color:inherit}.wrap{max-width:900px;margin:0 auto;padding:0 18px}
.bar{position:sticky;top:0;z-index:5;background:var(--card);box-shadow:0 2px 12px #0001}
.bar .wrap{display:flex;align-items:center;gap:12px;padding:10px 18px}.bar b{flex:1;font-size:1.1em;display:flex;align-items:center;gap:8px}
.bar img{width:34px;height:34px;border-radius:50%;object-fit:cover}
.langs a{padding:4px 9px;border-radius:99px;text-decoration:none;font-size:.85em;border:1px solid #8883}.langs a.on{background:var(--p);color:#fff;border-color:var(--p)}
.hero{background:${hero ? `linear-gradient(#0006,#0009),url('${esc(hero)}') center/cover` : heroBackground(th)};color:#fff;padding:64px 0 56px;text-align:center}
.hero h1{margin:0 0 8px;font-size:2.4em;line-height:1.15;text-shadow:0 2px 12px #0004}.hero p{margin:0 auto 22px;max-width:560px;font-size:1.15em;opacity:.95}
.btn{display:inline-block;border:0;cursor:pointer;background:var(--p);color:#fff;padding:13px 24px;border-radius:99px;font:inherit;font-weight:700;text-decoration:none}
.hero .btn{background:#fff;color:var(--p)}.badge{display:inline-block;margin-top:14px;padding:3px 12px;border-radius:99px;background:#fff3;font-size:.85em}
section{padding:34px 0}h2{margin:0 0 16px;font-size:1.6em}
.cats{display:flex;gap:8px;overflow:auto;padding-bottom:8px;margin-bottom:10px}.cats a{white-space:nowrap;background:var(--card);padding:8px 16px;border-radius:99px;text-decoration:none;box-shadow:0 1px 6px #0001}
.items{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:14px;margin-bottom:26px}
.item{background:var(--card);border-radius:var(--r);overflow:hidden;box-shadow:0 2px 10px #0001;display:flex;flex-direction:column}
.item .ph{height:120px;background:linear-gradient(135deg,var(--a)66,var(--p)44);display:flex;align-items:center;justify-content:center;font-size:3em;background-size:cover;background-position:center}
.item .bd{padding:12px 14px;flex:1;display:flex;flex-direction:column;gap:4px}.item h3{margin:0;font-size:1.05em}.item small{opacity:.7;flex:1}
.item .ft{display:flex;align-items:center;justify-content:space-between;margin-top:8px}.price{font-weight:800;color:var(--p)}
.add{border:0;background:var(--p);color:#fff;width:38px;height:38px;border-radius:50%;font-size:1.4em;cursor:pointer}.item.off{opacity:.5}
.card{background:var(--card);border-radius:var(--r);padding:18px;box-shadow:0 2px 10px #0001}
table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px solid #8882}td:last-child{text-align:end}
#cartbtn{position:fixed;bottom:16px;inset-inline:16px;max-width:420px;margin:auto;display:none;justify-content:space-between;box-shadow:0 6px 24px #0004;z-index:8}
#sheet{position:fixed;inset:0;background:#0007;display:none;z-index:9;align-items:flex-end;justify-content:center}#sheet.open{display:flex}
#sheet .in{background:var(--card);width:100%;max-width:520px;max-height:92vh;overflow:auto;border-radius:24px 24px 0 0;padding:20px}
#sheet input,#sheet textarea{width:100%;padding:11px;margin:5px 0 10px;border:1px solid #8886;border-radius:12px;font:inherit;background:var(--bg);color:var(--t)}
.row{display:flex;gap:10px}.row>*{flex:1}.q{display:flex;align-items:center;gap:8px}.q button{width:30px;height:30px;border-radius:50%;border:1px solid #8886;background:none;color:inherit;cursor:pointer}
.ok{text-align:center;padding:20px}.ok b{font-size:2.4em;color:var(--p)}footer{padding:26px 0 90px;text-align:center;opacity:.7;font-size:.9em}
.pill{display:inline-block;padding:2px 10px;border-radius:99px;font-size:.8em;background:${'#8882'}}
.sec-closed{text-align:center;padding:120px 20px}`;

  const open = (h) => !h.closed;
  const today = new Date().getDay();
  const dayIdx = (i) => (i + 1) % 7; // hours[0] = Monday
  const sectionHtml = {
    hero: () => `<header class="hero"><div class="wrap"><h1>${esc(shop.name)}</h1>${tagline ? `<p>${esc(tagline)}</p>` : ''}
      ${shop.accepting && !unavailable ? `<a class="btn" href="#menu">${esc(S['s.order'])}</a>` : `<span class="badge">${esc(S['s.closedNow'])}</span>`}</div></header>`,
    menu: () => `<section id="menu"><div class="wrap"><h2>${esc(S['s.menu'])}</h2>
      <nav class="cats">${cats.map((c) => `<a href="#cat${c.id}">${esc(c.emoji)} ${esc(dn(c.name))}</a>`).join('')}</nav>
      ${cats.map((c) => {
        const its = items.filter((i) => i.category_id === c.id);
        if (!its.length) return '';
        return `<h3 id="cat${c.id}">${esc(c.emoji)} ${esc(dn(c.name))}</h3><div class="items">${its.map((i) => `
          <div class="item${i.available ? '' : ' off'}"><div class="ph"${safeUrl(i.image) ? ` style="background-image:url('${esc(safeUrl(i.image))}')"` : ''}>${safeUrl(i.image) ? '' : esc(c.emoji)}</div>
          <div class="bd"><h3>${esc(dn(i.name))}</h3><small>${esc(dn(i.descr))}</small>
          <div class="ft"><span class="price">${fmt(i.price)}</span>${i.available ? (shop.accepting && !unavailable ? `<button class="add" data-id="${i.id}" aria-label="${esc(S['s.add'])}">+</button>` : '') : `<span class="pill">${esc(S['s.soldOut'])}</span>`}</div></div></div>`).join('')}</div>`;
      }).join('')}</div></section>`,
    about: () => (about ? `<section><div class="wrap"><div class="card"><h2>${esc(S['s.about'])}</h2><p>${esc(about).replace(/\n/g, '<br>')}</p></div></div></section>` : ''),
    hours: () => `<section><div class="wrap"><div class="card"><h2>${esc(S['s.hours'])}</h2><table>${shop.hours.map((h, i) => `
      <tr${dayIdx(i) === today ? ' style="font-weight:800"' : ''}><td>${esc(S['d.' + i])}</td><td>${open(h) ? `${esc(h.open)} – ${esc(h.close)}` : esc(S['s.closedDay'])}</td></tr>`).join('')}</table></div></div></section>`,
    contact: () => `<section><div class="wrap"><div class="card"><h2>${esc(S['s.contact'])}</h2>
      ${shop.address ? `<p>📍 <a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address)}">${esc(shop.address)}</a></p>` : ''}
      ${shop.phone ? `<p>📞 <a href="tel:${esc(shop.phone.replace(/[^\d+]/g, ''))}">${esc(shop.phone)}</a></p>` : ''}
      ${shop.whatsapp ? `<p><a class="btn" target="_blank" rel="noopener" href="https://wa.me/${esc(shop.whatsapp.replace(/\D/g, ''))}">💬 WhatsApp</a></p>` : ''}</div></div></section>`,
  };
  const body = (cfg.sections || []).filter((s) => s.on && sectionHtml[s.id]).map((s) => sectionHtml[s.id]()).join('\n');

  const clientData = {
    slug: shop.slug, lang, delivery: !!shop.delivery, fee: shop.delivery_fee, min: shop.min_order, cur: shop.currency,
    items: Object.fromEntries(items.filter((i) => i.available).map((i) => [i.id, { n: dn(i.name), p: i.price }])),
    s: Object.fromEntries(Object.entries(S).filter(([k]) => k.startsWith('s.'))),
  };

  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(shop.name)}</title>
<meta name="description" content="${esc(tagline)}"><meta property="og:title" content="${esc(shop.name)}">
<style>${css}</style></head><body>
<div class="bar"><div class="wrap"><b>${logo ? `<img src="${esc(logo)}" alt="">` : ''}${esc(shop.name)}</b>
${langs.length > 1 ? `<span class="langs">${langs.map((l) => `<a class="${l === lang ? 'on' : ''}" href="${esc(langHref ? langHref(l) : `?lang=${l}${preview ? '&preview=1' : ''}`)}">${l.toUpperCase()}</a>`).join(' ')}</span>` : ''}</div></div>
${body}
<footer><div class="wrap">${shop.plan === 'pro' ? '' : `Powered by <a href="${esc(home)}">Napizzo</a>`}</div></footer>
<button id="cartbtn" class="btn"><span id="cc"></span><span id="ct"></span></button>
<div id="sheet"><div class="in" id="sin"></div></div>
<script>window.SHOP=${JSON.stringify(clientData).replace(/</g, '\\u003c')};</script>
<script src="${esc(shopJs)}"></script></body></html>`;
}

function unavailablePage(shop, lang) {
  const S = I18N[lang] || I18N.en;
  return `<!doctype html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(shop.name)}</title>
<style>body{font-family:system-ui,sans-serif;text-align:center;padding:120px 20px;background:#fff8f1;color:#2b2118}</style></head><body><h1>${esc(shop.name)}</h1><p>${esc(S['s.unavailable'])}</p></body></html>`;
}

module.exports = { render, unavailablePage, esc, safeUrl };
