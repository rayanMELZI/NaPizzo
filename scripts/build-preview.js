// Builds a static, backend-less demo into dist/ (for hosting under any sub-path, e.g. /preview/napizzo/<task>/).
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
for (const f of ['style.css', 'app.js', 'shop.js', 'i18n.js', 'nz.js', 'nz-components.html']) fs.copyFileSync(path.join(root, 'public', f), path.join(dist, f));

const mod = (name, file) => `def(${JSON.stringify(name)}, function (module, exports, require) {\n${fs.readFileSync(path.join(root, file), 'utf8')}\n});`;
const bundle = `(function () {
const defs = {}, cache = {};
function def(n, f) { defs[n] = f; }
function require(n) {
  n = n.replace(/^(\\.\\.\\/public\\/|\\.\\/)/, (m) => (m === './' ? 'lib/' : 'public/')).replace(/\\.js$/, '');
  if (cache[n]) return cache[n].exports;
  const m = cache[n] = { exports: {} };
  if (!defs[n]) throw new Error('module ' + n);
  defs[n](m, m.exports, require);
  return m.exports;
}
${mod('lib/templates', 'lib/templates.js')}
${mod('lib/shop-page', 'lib/shop-page.js')}
${mod('public/i18n', 'public/i18n.js')}
${fs.readFileSync(path.join(root, 'preview/mock.js'), 'utf8')}
})();`;
fs.writeFileSync(path.join(dist, 'demo.js'), bundle);
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8')
  .replace('<script src="app.js"></script>', '<script src="demo.js"></script>\n<script src="app.js"></script>');
fs.writeFileSync(path.join(dist, 'index.html'), html);
console.log('preview built in dist/');
