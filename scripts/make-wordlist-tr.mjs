// Türkçe parola kelime listesini üretir: src/wordlist-tr.js
// Kaynak: scripts/kelimeler/*.txt (elle seçilmiş, konulara göre gruplanmış kelimeler).
// Kurallar: Türkçe karakterler ASCII'ye çevrilir, 4-8 harf, ASCII hâliyle tekil, dışlama
// listesinde değil. Liste boyutu 2'nin kuvvetidir. Seçimde zxcvbn-ts Türkçe sıklık listelerinde
// (altyazı, Vikipedi) daha üst sırada olan kelimeler önce gelir; bu listelerde olmayan
// kelimeler en sona kalır. Sonuç alfabetik sıralanır.
// Kullanım: node scripts/make-wordlist-tr.mjs [--report]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as tr from '@zxcvbn-ts/language-tr';
import { foldTr } from '../src/engine.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dir = path.join(root, 'scripts', 'kelimeler');
const report = process.argv.includes('--report');

const S = (list) => (list || []).map(String);
const rank = new Map();
for (const name of ['commonWords-tr', 'wikipedia-tr']) {
  S(tr.dictionary[name]).forEach((w, i) => {
    const f = foldTr(w);
    rank.set(f, Math.min(rank.get(f) ?? Infinity, i));
  });
}
// Bileşik ifadelerden kalan parçalar ("gün batımı" -> "batımı"), çoğullar, yabancı ya da
// tuhaf kelimeler ve parolada bulunmaması gerekenler (ASCII yazımıyla).
const EXCLUDE = new Set(`
  batimi arisi mersini hurmasi kovasi askisi rayi fircasi curugu yesili sarisi mavisi tenisi
  pateni mekigi cevizi helvasi makinesi baligi boceği bocegi feneri cantasi atma suyu yemegi
  kalemi saati gozlugu arasi kati evi katlari yolu salonu bahcesi aksami ogle aksam
  zili insani kulesi arabasi sahibi rengi yuzlu basli
  kartlar tavuklar korular buram secik kulotlu yesilli mavili sarili beyazli yatkin sabahki
  aksamki geceki yazlik baharlik kislik ucsuz etek eteg cengel cangil waffle
  parola sifre kod silah dovmek teror
  sikmak siki sican pisi fagot domuz esek
`.split(/\s+/).filter(Boolean));

const seen = new Map();
const rejected = { length: [], excluded: [] };
for (const file of readdirSync(dir).filter((f) => f.endsWith('.txt')).sort()) {
  const text = readFileSync(path.join(dir, file), 'utf8')
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('#'))
    .join(' ');
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    const w = foldTr(raw.toLocaleLowerCase('tr-TR'));
    if (seen.has(w)) continue;
    if (!/^[a-z]{4,8}$/.test(w)) { rejected.length.push(raw); continue; }
    if (EXCLUDE.has(w)) { rejected.excluded.push(raw); continue; }
    seen.set(w, rank.get(w) ?? Infinity);
  }
}

const valid = [...seen].sort((a, b) => a[1] - b[1]).map(([w]) => w);
const size = 2 ** Math.floor(Math.log2(valid.length));
const words = valid.slice(0, size).sort();
const known = valid.filter((w) => rank.has(w)).length;
console.log(`geçerli: ${valid.length} (${known} tanesi sıklık listelerinde), liste boyutu: ${size} (${Math.log2(size)} bit/kelime)`);
console.log(`elenen: uzunluk ${rejected.length.length}, dışlama listesi ${rejected.excluded.length}`);
if (report) {
  console.log('\nlisteye girmeyen kelimeler:', valid.slice(size).join(' '));
  console.log('\nsıklık listelerinde olmayan ama listeye giren:', words.filter((w) => !rank.has(w)).join(' '));
}

const lines = [];
for (let i = 0; i < words.length; i += 16) lines.push(`  '${words.slice(i, i + 16).join(' ')}',`);
writeFileSync(path.join(root, 'src', 'wordlist-tr.js'), `// Bu dosya scripts/make-wordlist-tr.mjs ile üretilir; elle düzenlemeyin.
// ${size} kelime, kelime başına ${Math.log2(size)} bit. Kaynak: scripts/kelimeler/*.txt
export const WORDLIST_TR = [
${lines.join('\n')}
].join(' ').split(' ');
`);
