// src/ altındaki her şeyi tek bir HTML dosyasında birleştirir: dist/index.html
// (GitHub Pages) ve aynı dosyanın kopyası dist/parola_entropi.html (indirip çevrimdışı kullanmak için).
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(path.join(root, ...p), 'utf8');
const pkgVersion = (name) => JSON.parse(read('node_modules', name, 'package.json')).version;

const versions = {
  app: JSON.parse(read('package.json')).version,
  core: pkgVersion('@zxcvbn-ts/core'),
  common: pkgVersion('@zxcvbn-ts/language-common'),
  en: pkgVersion('@zxcvbn-ts/language-en'),
  tr: pkgVersion('@zxcvbn-ts/language-tr'),
  built: new Date().toISOString().slice(0, 10),
  // GitHub Actions'ta derlenirse sayfanın hangi commit'ten üretildiği altbilgide görünür.
  commit: (process.env.GITHUB_SHA || '').slice(0, 7),
  repo: process.env.GITHUB_REPOSITORY ? `https://github.com/${process.env.GITHUB_REPOSITORY}` : '',
};

const out = await build({
  entryPoints: [path.join(root, 'src', 'main.js')],
  bundle: true, format: 'iife', minify: true, charset: 'utf8', target: 'es2020',
  write: false, legalComments: 'none', metafile: true,
  define: { __VERSIONS__: JSON.stringify(versions) },
});

// Pakete gerçekten giren üçüncü taraf paketlerin lisans ve bildirim dosyaları, olduğu gibi.
const bundled = new Set();
for (const input of Object.keys(out.metafile.inputs)) {
  const m = input.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\//);
  if (m) bundled.add(m[1]);
}
const bar = '='.repeat(72);
let notices = `${bar}\nparola_entropi ${versions.app}\n${bar}\n\n--- LICENSE ---\n${read('LICENSE').trim()}\n\n`
  + 'Bu sayfa ayrıca aşağıdaki açık kaynak yazılım ve verileri içerir.\n';
for (const name of [...bundled].sort()) {
  const dir = path.join(root, 'node_modules', name);
  notices += `\n${'='.repeat(72)}\n${name} ${pkgVersion(name)}\n${'='.repeat(72)}\n`;
  const files = readdirSync(dir).filter((f) => /^(licen[cs]e|notice|third_party)/i.test(f)).sort();
  if (!files.length) throw new Error(`${name}: lisans dosyası bulunamadı`);
  for (const f of files) notices += `\n--- ${f} ---\n${readFileSync(path.join(dir, f), 'utf8').trim()}\n`;
}
// Parola oluşturucunun İngilizce kelime listesi, @zxcvbn-ts/language-common içindeki EFF listesidir.
// Paketin lisans dosyası EFF'yi anmadığı için listenin kendi atfı ayrıca eklenir.
notices += `\n${'='.repeat(72)}\nEFF Large Wordlist (parola oluşturucu, İngilizce liste)\n${'='.repeat(72)}\n`
  + '\nKaynak: Electronic Frontier Foundation, "EFF\'s New Wordlists for Random Passphrases" (2016).\n'
  + 'https://www.eff.org/deeplinks/2016/07/new-wordlists-random-passphrases\n'
  + 'Lisans: Creative Commons Attribution 3.0 United States (CC BY 3.0 US).\n'
  + 'https://creativecommons.org/licenses/by/3.0/us/\n';
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const js = out.outputFiles[0].text.trim().replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const hash = 'sha256-' + createHash('sha256').update(js, 'utf8').digest('base64');
const html = read('src', 'template.html')
  .replace('__CSP_HASH__', () => hash)
  .replace('__NOTICES__', () => escapeHtml(notices))
  .replace('__SCRIPT__', () => js);

const dist = path.join(root, 'dist');
if (!existsSync(dist)) mkdirSync(dist);
writeFileSync(path.join(dist, 'index.html'), html);
writeFileSync(path.join(dist, 'parola_entropi.html'), html);
writeFileSync(path.join(dist, 'THIRD_PARTY_NOTICES.txt'), notices);
console.log(`dist/index.html: ${(Buffer.byteLength(html) / 1e6).toFixed(2)} MB, sürüm ${versions.app}${versions.commit ? ' @ ' + versions.commit : ''}`);
console.log(`Paketlenen üçüncü taraf paketler: ${[...bundled].sort().join(', ')}`);
