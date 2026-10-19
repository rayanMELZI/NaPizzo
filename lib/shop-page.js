// Server-side rendering of a restaurant's public page. Themed only through --p --a --bg --card --t --r --f
// and data-hero="gradient|sunset|dark" on the hero section.
const { I18N } = require('../public/i18n.js');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLOR = /^#[0-9a-fA-F]{6}$/;
const col = (v, d) => (COLOR.test(v) ? v : d);
const FONTS = {
  modern: "'Readex Pro', system-ui, sans-serif",
  rounded: "'Baloo Bhaijaan 2', 'Readex Pro', system-ui, sans-serif",
  serif: "'Lora', 'Noto Naskh Arabic', Georgia, serif",
};
const FONT_LINKS = {
  modern: 'family=Readex+Pro:wght@400..700',
  rounded: 'family=Baloo+Bhaijaan+2:wght@400..800&family=Readex+Pro:wght@400..700',
  serif: 'family=Lora:wght@400..700&family=Noto+Naskh+Arabic:wght@400..700',
};
const safeUrl = (u) => (/^(\/uploads\/[\w.-]+|https?:\/\/[^\s"'<>]+|data:image\/(png|jpeg|webp|gif);base64,[\w+/=]+)$/.test(u || '') ? u : '');
const pick = (obj, lang, def) => (obj && (obj[lang] || obj[def] || Object.values(obj).find(Boolean))) || '';
const TYPE_EMOJI = { pizzeria: '🍕', burger: '🍔', tacos: '🌮', sandwich: '🥙', other: '🍽️' };
const THUMB = [[30, 18], [22, 28], [36, 14], [16, 30], [28, 22]];

const CSS = `
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:128px}
body{margin:0;background:var(--bg);color:var(--t);font-family:var(--f);font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased}
[dir=rtl] body{line-height:1.7}
a{color:inherit}button,input,textarea{font:inherit;color:inherit}
:focus-visible{outline:3px solid #2D6CDF;outline-offset:3px}
.muted{color:color-mix(in srgb,var(--t) 70%,var(--bg))}
.wrap{max-width:1040px;margin:0 auto;padding:0 20px}
.hd{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--card) 92%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid color-mix(in srgb,var(--t) 9%,transparent)}
.hd .wrap{display:flex;align-items:center;gap:12px;min-height:60px}
.logo{flex:none;width:38px;height:38px;border-radius:min(var(--r),14px);background:var(--p) center/cover;color:var(--bg);display:grid;place-items:center;font-size:20px}
.hd b.nm{font-size:18px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.nav{display:flex;gap:4px;margin-inline-start:16px}@media(max-width:819px){.nav{display:none}}.nav a{padding:8px 12px;border-radius:min(var(--r),10px);text-decoration:none;font-weight:500;font-size:15px}.nav a:hover{background:color-mix(in srgb,var(--p) 10%,var(--card))}
.grow{flex:1}
.seg{display:inline-flex;gap:2px;padding:4px;border-radius:min(var(--r),14px);background:color-mix(in srgb,var(--t) 9%,var(--card))}
.seg a,.seg button{min-width:40px;min-height:36px;padding:0 11px;border:0;border-radius:min(var(--r),10px);background:none;font-weight:600;font-size:14px;cursor:pointer;text-decoration:none;display:inline-grid;place-items:center}
.seg .on{background:var(--card);font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,.18)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 22px;border:2px solid transparent;border-radius:min(var(--r),14px);background:var(--p);color:var(--bg);font-weight:600;font-size:16px;cursor:pointer;text-decoration:none;transition:filter .15s,transform .15s}
.btn:hover{filter:brightness(1.07)}.btn:active{transform:scale(.98)}
.btn.out{background:transparent;color:inherit;border-color:currentColor}
.btn.wa{background:#0F7A40;color:#fff}.btn.lg{min-height:52px;font-size:17px;padding:0 26px}.btn.block{width:100%}.btn:disabled{opacity:.5;cursor:not-allowed}
.cartbtn{display:none}
@media(min-width:820px){.cartbtn{display:inline-flex;min-height:48px;padding:0 18px}}
.hero{position:relative;overflow:hidden;color:#fff;padding:64px 0 58px;background:var(--hb)}
.hero[data-hero=gradient]{--hb:linear-gradient(135deg,var(--p),color-mix(in srgb,var(--a) 70%,var(--p)))}
.hero[data-hero=sunset]{--hb:linear-gradient(160deg,var(--a),var(--p))}
.hero[data-hero=sunset]::before{content:"";position:absolute;inset-inline-end:-80px;inset-block-start:-80px;width:360px;height:360px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--a) 85%,#fff),transparent 70%);opacity:.7}
.hero[data-hero=sunset]::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.07) 0 2px,transparent 2px 22px)}
.hero[data-hero=dark]{--hb:radial-gradient(circle at 20% 15%,color-mix(in srgb,var(--a) 40%,transparent),transparent 55%),linear-gradient(135deg,#050609,color-mix(in srgb,var(--p) 30%,#050609))}
.hero.cover{background:linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.62)),var(--cover) center/cover}
.hero .wrap{position:relative;z-index:1;display:grid;gap:20px;justify-items:start}
.pill{display:inline-flex;align-items:center;gap:8px;padding:5px 12px;border-radius:99px;background:rgba(0,0,0,.28);font-weight:600;font-size:14px;backdrop-filter:blur(4px)}
.pill i{width:10px;height:10px;border-radius:50%;background:#47D17D}.pill.off i{background:#ffb4ab}
.hero h1{margin:0;font-size:58px;line-height:1.04;letter-spacing:-.03em;font-weight:800;max-width:12ch;text-shadow:0 2px 18px rgba(0,0,0,.25)}
[dir=rtl] .hero h1{letter-spacing:0;font-weight:700;line-height:1.2}
.hero p{margin:0;font-size:19px;max-width:480px;text-shadow:0 1px 10px rgba(0,0,0,.25)}
.hero .btns{display:flex;flex-wrap:wrap;gap:12px}
.hero .btn:not(.out){background:#fff;color:color-mix(in srgb,var(--p) 78%,#000)}
.hero[data-hero=dark] .btn:not(.out){background:var(--p);color:var(--bg)}
.hero .btn.out{color:#fff}
.art{position:absolute;inset-inline-end:8%;inset-block-start:50%;transform:translateY(-50%);font-size:160px;line-height:1;filter:drop-shadow(0 18px 24px rgba(0,0,0,.3));z-index:0}
.art span{position:absolute;font-size:44px;animation:orb 6s ease-in-out infinite}.art .o1{inset-block-start:-20px;inset-inline-start:-30px}.art .o2{inset-block-end:0;inset-inline-start:-50px;animation-delay:-2s}.art .o3{inset-block-start:10px;inset-inline-end:-40px;animation-delay:-4s}
@keyframes orb{50%{transform:translateY(-12px) rotate(8deg)}}
@media(max-width:819px){.hero{padding:36px 0 40px}.hero h1{font-size:36px}.hero p{font-size:17px}.art{font-size:80px;inset-block-start:34px;transform:none;opacity:.9;inset-inline-end:16px}.art span{font-size:30px}}
section.sec{padding:36px 0}
h2.t{margin:0 0 18px;font-size:28px;line-height:1.2;font-weight:800;letter-spacing:-.02em}
[dir=rtl] h2.t{letter-spacing:0;font-weight:700}
h2.t::after{content:"";display:block;width:48px;height:5px;border-radius:3px;background:var(--a);margin-top:8px}
.cats{position:sticky;top:68px;z-index:10;background:color-mix(in srgb,var(--bg) 94%,transparent);backdrop-filter:blur(8px);padding:10px 0;margin-bottom:8px}
.cats .wrap{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none}.cats .wrap::-webkit-scrollbar{display:none}
.chip{flex:none;min-height:42px;padding:0 16px;border:1.5px solid color-mix(in srgb,var(--t) 14%,transparent);border-radius:min(var(--r),14px);background:var(--card);font-weight:600;font-size:15px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
.chip.on{background:var(--p);border-color:var(--p);color:var(--bg)}
h3.ch{margin:24px 0 12px;font-size:20px;display:flex;align-items:center;gap:10px}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))}
.it{display:flex;gap:12px;padding:10px;border-radius:var(--r);background:var(--card);border:1px solid color-mix(in srgb,var(--t) 9%,transparent)}
.th{flex:none;width:84px;height:84px;border-radius:calc(var(--r)*.7);display:grid;place-items:center;font-size:38px;background:var(--tb) center/cover;filter:none}
.th span{filter:drop-shadow(0 3px 4px rgba(0,0,0,.25))}
.it.off .th{filter:grayscale(1);opacity:.55}
.it .tx{flex:1;min-width:0;display:flex;flex-direction:column}
.it h4{margin:0;font-size:16.5px;line-height:1.25}.it .d{margin:2px 0 0;font-size:13.5px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.it .ft{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:auto;padding-top:6px}
.price{font-weight:800;font-size:17px;color:var(--p);direction:ltr}
.soldout{padding:3px 10px;border-radius:99px;font-size:13px;font-weight:700;background:color-mix(in srgb,var(--t) 12%,var(--card))}
.add{flex:none;width:40px;height:40px;border:0;border-radius:50%;background:var(--p);color:var(--bg);font-size:24px;line-height:1;cursor:pointer;display:grid;place-items:center}
.step{display:inline-flex;align-items:center;gap:2px;background:color-mix(in srgb,var(--p) 12%,var(--card));border-radius:99px}
.step button{width:40px;height:40px;border:0;border-radius:50%;background:none;font-size:22px;cursor:pointer;color:var(--p);font-weight:700}.step b{min-width:22px;text-align:center}
.card{background:var(--card);border-radius:var(--r);padding:22px;border:1px solid color-mix(in srgb,var(--t) 9%,transparent)}
.two{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))}
.hrs{display:grid}.hrs div{display:flex;align-items:center;gap:10px;min-height:42px;padding:0 12px;border-radius:min(var(--r),12px)}
.hrs div span:last-child{margin-inline-start:auto;direction:ltr}.hrs .today{background:color-mix(in srgb,var(--p) 11%,var(--card));font-weight:800}
.tag{padding:2px 9px;border-radius:99px;background:var(--p);color:var(--bg);font-size:12px;font-weight:700}
.ct{display:grid;gap:12px;align-content:start}.ct p{margin:0}.ct .row{display:flex;flex-wrap:wrap;gap:10px}
footer.ft2{padding:36px 0 120px;text-align:center;font-size:15px}
.pw{display:inline-block;margin-top:10px;padding:6px 14px;border-radius:99px;background:color-mix(in srgb,var(--t) 8%,var(--card));text-decoration:none;font-weight:600}
#bar{position:fixed;inset-inline:14px;inset-block-end:14px;z-index:30;display:none;align-items:center;justify-content:space-between;gap:12px;min-height:54px;padding:0 20px;border:0;border-radius:min(var(--r),16px) ;background:var(--p);color:var(--bg);font-weight:600;font-size:16px;box-shadow:0 14px 30px -10px rgba(0,0,0,.45);cursor:pointer;max-width:560px;margin-inline:auto}
#bar.show{display:flex}@media(min-width:820px){#bar{display:none!important}}
#bk{position:fixed;inset:0;z-index:50;background:rgba(10,10,14,.5);display:none;animation:fd .2s}#bk.open{display:block}
#sheet{position:fixed;z-index:51;inset-inline:0;inset-block-end:0;max-height:92%;overflow:auto;background:var(--card);border-radius:max(var(--r),22px) max(var(--r),22px) 0 0;padding:10px 20px 24px;display:none;animation:up .32s cubic-bezier(.2,.8,.2,1)}#sheet.open{display:block}
#sheet .grab{width:44px;height:5px;border-radius:3px;background:color-mix(in srgb,var(--t) 20%,transparent);margin:0 auto 14px}
@media(min-width:820px){#sheet{inset-inline-start:auto;inset-block:0;width:460px;max-height:none;border-radius:0;animation:sl .3s cubic-bezier(.2,.8,.2,1)}#sheet .grab{display:none}}
@keyframes fd{from{opacity:0}}@keyframes up{from{opacity:0;transform:translateY(24px)}}@keyframes sl{from{opacity:0;transform:translateX(24px)}}[dir=rtl] #sheet{animation-name:sr}@keyframes sr{from{opacity:0;transform:translateX(-24px)}}
#sheet h2{margin:0 0 12px;font-size:22px;display:flex;justify-content:space-between;align-items:center}
.x{width:40px;height:40px;border:0;border-radius:50%;background:color-mix(in srgb,var(--t) 9%,var(--card));font-size:20px;cursor:pointer}
.ln{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid color-mix(in srgb,var(--t) 9%,transparent)}.ln .n{flex:1;min-width:0}
.mode{display:flex;width:100%;margin:16px 0}.mode button{flex:1}
.f{display:block;margin:0 0 12px;font-weight:600;font-size:15px}.f input,.f textarea{display:block;width:100%;min-height:46px;margin-top:5px;padding:0 14px;font-size:16px;border:1.5px solid color-mix(in srgb,var(--t) 18%,transparent);border-radius:min(var(--r),14px);background:var(--bg);font-weight:400}
.f textarea{padding:10px 14px;min-height:72px}.f input:focus,.f textarea:focus{outline:0;border-color:var(--t);box-shadow:0 0 0 3px rgba(45,108,223,.35)}
.f input.bad{border-color:#D12F3C}
.sum{display:grid;gap:6px;margin:14px 0}.sum div{display:flex;justify-content:space-between}.sum .tot{font-size:19px;font-weight:800;padding-top:8px;border-top:1px solid color-mix(in srgb,var(--t) 12%,transparent)}.sum span:last-child{direction:ltr}
.cash{padding:10px 12px;border-radius:min(var(--r),12px);background:color-mix(in srgb,var(--a) 20%,var(--card));font-size:14px;margin-bottom:14px}
.err{color:#B3261E;font-weight:600;min-height:1.5em}
.ty{text-align:center}.ty .ck{display:grid;place-items:center;width:80px;height:80px;margin:6px auto 16px;border-radius:50%;background:var(--p);color:var(--bg);font-size:40px;animation:pop .5s cubic-bezier(.2,.8,.2,1)}
@keyframes pop{0%{transform:scale(.4)}60%{transform:scale(1.1)}100%{transform:scale(1)}}
.ty .oc{text-align:start;border:1px solid color-mix(in srgb,var(--t) 12%,transparent);border-radius:var(--r);padding:16px;margin:18px 0;display:grid;gap:6px}
@media (prefers-reduced-motion:reduce){*{animation-duration:.01s!important;scroll-behavior:auto!important}.art span{animation:none}}
`;

function render(shop, cats, items, lang, { preview = false, unavailable = false, langHref, shopJs = '/shop.js', home = '/' } = {}) {
  const langs = shop.langs;
  if (!langs.includes(lang)) lang = shop.default_lang;
  const S = I18N[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const cfg = shop.config, th = cfg.theme;
  const T = (cfg.texts && cfg.texts[lang]) || {};
  const textOf = (k) => T[k] || pick(Object.fromEntries(langs.map((l) => [l, cfg.texts?.[l]?.[k]])), lang, shop.default_lang);
  const tagline = textOf('tagline'), about = textOf('about');
  const hero = safeUrl(cfg.heroImage), logo = safeUrl(cfg.logo);
  const emoji = TYPE_EMOJI[shop.type] || '🍽️';
  const dn = (o) => pick(o, lang, shop.default_lang);
  const cur = shop.currency;
  const fmt = (n) => { const s = Number.isInteger(+n) ? String(+n) : (+n).toFixed(2); return lang === 'en' ? esc(cur) + s : lang === 'fr' ? s.replace('.', ',') + '\u00a0' + esc(cur) : s + ' ' + esc(cur); };
  const open = !unavailable && shop.accepting;
  const vars = `--p:${col(th.primary, '#D62F25')};--a:${col(th.accent, '#2E7D4F')};--bg:${col(th.bg, '#FFF6EC')};--card:${col(th.card, '#FFFFFF')};--t:${col(th.text, '#2B1B14')};--r:${Math.max(0, Math.min(40, +th.radius || 0))}px;--f:${FONTS[th.font] || FONTS.modern}`;
  const fontKey = FONTS[th.font] ? th.font : 'modern';
  const todayIdx = (new Date().getDay() + 6) % 7;
  const shown = (cfg.sections || []).filter((s) => s.on);
  const has = (id) => shown.some((s) => s.id === id);

  const S_ = {
    hero: () => `<header class="hero${hero ? ' cover' : ''}" data-hero="${['gradient', 'sunset', 'dark'].includes(th.hero) ? th.hero : 'gradient'}" id="top"${hero ? ` style="--cover:url('${esc(hero)}')"` : ''}>
      <div class="art" aria-hidden="true">${emoji}<span class="o1">🌿</span><span class="o2">🍅</span><span class="o3">🧀</span></div>
      <div class="wrap"><span class="pill" id="openpill"><i></i><span id="opentxt">${esc(open ? S['sh.openNow'] : S['sh.closed'])}</span></span>
        <h1>${esc(shop.name)}</h1>${tagline ? `<p>${esc(tagline)}</p>` : ''}
        <div class="btns">${open && has('menu') ? `<a class="btn lg" href="#menu">${esc(S['sh.orderNow'])}</a>` : ''}${shop.phone ? `<a class="btn lg out" href="tel:${esc(shop.phone.replace(/[^\d+]/g, ''))}">${esc(S['sh.call'])}</a>` : ''}</div></div></header>`,
    menu: () => `<section class="sec" id="menu"><div class="cats"><div class="wrap" id="cats">${cats.map((c, i) => `<a class="chip${i ? '' : ' on'}" href="#cat${c.id}" data-c="cat${c.id}">${esc(c.emoji)} ${esc(dn(c.name))}</a>`).join('')}</div></div>
      <div class="wrap"><h2 class="t">${esc(S['sh.menu'])}</h2>
      ${cats.map((c, ci) => {
        const its = items.filter((i) => i.category_id === c.id);
        if (!its.length) return '';
        const [x, y] = THUMB[ci % THUMB.length];
        const tb = `radial-gradient(circle at 30% 25%,rgba(255,255,255,.38),transparent 58%),linear-gradient(${135 + ci * 24}deg,color-mix(in srgb,var(--a) ${x}%,var(--card)),color-mix(in srgb,var(--p) ${y}%,var(--card)))`;
        return `<h3 class="ch" id="cat${c.id}">${esc(c.emoji)} ${esc(dn(c.name))}</h3><div class="grid">${its.map((i) => {
          const img = safeUrl(i.image);
          return `<article class="it${i.available ? '' : ' off'}"><div class="th" style="--tb:${img ? `url('${esc(img)}')` : tb}">${img ? '' : `<span>${esc(c.emoji)}</span>`}</div>
            <div class="tx"><h4>${esc(dn(i.name))}</h4><p class="d muted">${esc(dn(i.descr))}</p>
            <div class="ft"><span class="price">${fmt(i.price)}</span>${i.available ? (open ? `<span data-slot="${i.id}"><button class="add" data-id="${i.id}" aria-label="${esc(S['sh.add'])}: ${esc(dn(i.name))}">+</button></span>` : '') : `<span class="soldout">${esc(S['sh.soldOut'])}</span>`}</div></div></article>`;
        }).join('')}</div>`;
      }).join('')}</div></section>`,
    about: () => (about ? `<section class="sec" id="about"><div class="wrap"><div class="card"><h2 class="t">${esc(S['sh.about'])}</h2><p style="margin:0;font-size:19px">${esc(about).replace(/\n/g, '<br>')}</p></div></div></section>` : ''),
    hours: () => `<section class="sec" id="hours"><div class="wrap"><div class="card"><h2 class="t">${esc(S['sh.hours'])}</h2><div class="hrs">${shop.hours.map((h, i) => `<div${i === todayIdx ? ' class="today"' : ''}><span>${esc(S['sh.d' + i])}</span>${i === todayIdx ? `<span class="tag">${esc(S['sh.today'])}</span>` : ''}<span>${h.closed ? esc(S['sh.closed']) : `${esc(h.open)} – ${esc(h.close)}`}</span></div>`).join('')}</div></div></div></section>`,
    contact: () => `<section class="sec" id="contact"><div class="wrap"><h2 class="t">${esc(S['sh.contact'])}</h2><div class="two">
      ${shop.address ? `<div class="card ct"><p>📍 ${esc(shop.address)}</p><div class="row"><a class="btn out" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address)}">${esc(S['sh.maps'])}</a></div></div>` : ''}
      ${shop.phone || shop.whatsapp ? `<div class="card ct">${shop.phone ? `<p dir="ltr" style="text-align:start">📞 ${esc(shop.phone)}</p>` : ''}<div class="row">${shop.phone ? `<a class="btn" href="tel:${esc(shop.phone.replace(/[^\d+]/g, ''))}">${esc(S['sh.call'])}</a>` : ''}${shop.whatsapp ? `<a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/${esc(shop.whatsapp.replace(/\D/g, ''))}">${esc(S['sh.wa'])}</a>` : ''}</div></div>` : ''}</div></div></section>`,
  };
  const NAVK = { menu: 'sh.menu', about: 'sh.about', hours: 'sh.hours', contact: 'sh.contact' };
  const body = shown.filter((s) => S_[s.id]).map((s) => S_[s.id]()).join('\n');
  const navLinks = shown.filter((s) => NAVK[s.id]).map((s) => `<a href="#${s.id}">${esc(S[NAVK[s.id]])}</a>`).join('');

  const clientData = {
    slug: shop.slug, lang, delivery: !!shop.delivery, fee: shop.delivery_fee, min: shop.min_order, cur, open,
    hours: shop.hours, items: Object.fromEntries(items.filter((i) => i.available).map((i) => [i.id, { n: dn(i.name), p: i.price }])),
    s: Object.fromEntries(Object.entries(S).filter(([k]) => k.startsWith('s.') || k.startsWith('sh.'))),
  };

  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(shop.name)}</title>
<meta name="description" content="${esc(tagline)}"><meta property="og:title" content="${esc(shop.name)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${FONT_LINKS[fontKey]}&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body style="${vars}">
<div class="hd"><div class="wrap"><span class="logo"${logo ? ` style="background-image:url('${esc(logo)}')"` : ''}>${logo ? '' : emoji}</span><b class="nm">${esc(shop.name)}</b><nav class="nav">${navLinks}</nav><span class="grow"></span>
${langs.length > 1 ? `<span class="seg" role="group">${langs.map((l) => `<a class="${l === lang ? 'on' : ''}" ${l === lang ? 'aria-current="true"' : ''} href="${esc(langHref ? langHref(l) : `?lang=${l}${preview ? '&preview=1' : ''}`)}">${l === 'ar' ? 'عربي' : l.toUpperCase()}</a>`).join('')}</span>` : ''}
${open ? `<button class="btn cartbtn" id="hcart" type="button"><span id="hct">🛒</span></button>` : ''}</div></div>
${body}
<footer class="ft2"><div class="wrap muted">© ${esc(shop.name)}${shop.plan === 'pro' ? '' : `<br><a class="pw" href="${esc(home)}">${esc(S['sh.powered'])}</a>`}</div></footer>
<button id="bar" type="button"><span id="bc"></span><span>${esc(S['sh.viewOrder'])}</span><span id="bt"></span></button>
<div id="bk"></div><div id="sheet" role="dialog" aria-modal="true" aria-label="${esc(S['sh.yourOrder'])}"><div class="grab"></div><div id="sin"></div></div>
<script>window.SHOP=${JSON.stringify(clientData).replace(/</g, '\\u003c')};</script>
<script src="${esc(shopJs)}"></script></body></html>`;
}

function unavailablePage(shop, lang) {
  const S = I18N[lang] || I18N.en;
  return `<!doctype html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(shop.name)}</title>
<style>body{font-family:system-ui,sans-serif;text-align:center;padding:120px 20px;background:#FFF6EC;color:#2B1B14}</style></head><body><h1>${esc(shop.name)}</h1><p>${esc(S['s.unavailable'])}</p></body></html>`;
}

module.exports = { render, unavailablePage, esc, safeUrl };
