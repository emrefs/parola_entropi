import assert from 'node:assert/strict';
import { createHash, randomInt } from 'node:crypto';
import * as E from '../src/engine.js';
import * as common from '@zxcvbn-ts/language-common';
import { buildGraph, US_QWERTY_ROWS, turkishGraphs } from '../src/keyboards.js';
import { extraDictionary } from '../src/tr-extra.js';

// Klavye üreteci, zxcvbn'in kendi ABD QWERTY tablosunu birebir üretmeli
assert.deepEqual(buildGraph(US_QWERTY_ROWS), common.adjacencyGraphs.qwerty);
for (const g of Object.values(turkishGraphs)) {
  assert.equal(Object.keys(g).length, 96);
  for (const adj of Object.values(g)) assert.equal(adj.length, 6);
}
assert.deepEqual(turkishGraphs.turkishF['a'], ['eE', 'ıI', 'oO', 'üÜ', 'cC', 'vV']);
assert.deepEqual(turkishGraphs.turkishQ['ş'], ['lL', 'pP', 'ğĞ', 'iİ', '.:', 'çÇ']);
// Ek sözlüklerde yinelenen ya da küçük harfe çevrilmemiş giriş olmamalı
for (const [name, list] of Object.entries(extraDictionary)) {
  assert.equal(new Set(list).size, list.length, name + ' yinelenen giriş');
  for (const w of list) assert.ok(w === w.toLocaleLowerCase('tr') && !/\s/.test(w), name + ': ' + w);
}
assert.ok(extraDictionary['cityPlate-tr'].includes('ankara06') && extraDictionary['cityPlate-tr'].includes('düzce81'));

// SHA-1: bilinen vektörler + Node ile rastgele karşılaştırma
assert.equal(E.sha1Hex(''), 'DA39A3EE5E6B4B0D3255BFEF95601890AFD80709');
assert.equal(E.sha1Hex('abc'), 'A9993E364706816ABA3E25717850C26C9CD0D89D');
assert.equal(E.sha1Hex('password123'), 'CBFDAC6008F9CAB4083784CBD1874F76618D2A97');
for (let n = 0; n < 400; n++) {
  const s = Array.from({ length: n }, () => String.fromCodePoint(randomInt(32, 0x250))).join('');
  assert.equal(E.sha1Hex(s), createHash('sha1').update(s).digest('hex').toUpperCase(), 'len ' + n);
}
assert.equal(E.sha1Hex('şifre🔑'), createHash('sha1').update('şifre🔑').digest('hex').toUpperCase());

// Zipf: canlı sitede 3196 kayıt -> 10,6 bit
assert.equal(E.breachBits(3196).toFixed(1), '10.6');
assert.equal(E.breachBits(1), 25);
assert.equal(E.breachBits(5e7), 0);
assert.equal(E.breachBits(0), Infinity);

// Formüller
assert.equal(E.randomCharBits('kV9#tLq2@Wz7!mRd', 94).toFixed(1), '104.9');
assert.deepEqual(E.detectPool('kV9#tLq2@Wz7!mRd'), { size: 94, hex: false, other: false });
assert.equal(E.detectPool('3f9a1c7e5b2d8f40a6c1e9b7d3f5a2c8').size, 16);
assert.equal(E.detectPool('a8f3k2m9x7q1').size, 36);
assert.equal(E.detectPool('48213975').size, 10);
assert.equal(E.detectPool('şifre').other, true);
assert.equal(E.randomWordBits(4, 7776).toFixed(1), '51.7');

// HIBP ayrıştırma (sahte fetch)
const h = E.sha1Hex('password123');
const body = `0000000000000000000000000000000000A:0\r\n${h.slice(5)}:2254650\r\nFFFF:3\r\n`;
const ok = async (url, o) => { assert.equal(url, E.HIBP_URL + h.slice(0, 5)); return { ok: true, text: async () => body }; };
assert.equal(await E.hibpCount('password123', ok), 2254650);
assert.equal(await E.hibpCount('baska-bir-parola', async () => ({ ok: true, text: async () => body })), 0);
let calls = 0;
const preflightFails = async (url, o) => { calls++; if (o.headers) throw new TypeError('blocked'); return { ok: true, text: async () => body }; };
assert.equal(await E.hibpCount('password123', preflightFails), 2254650); assert.equal(calls, 2);
await assert.rejects(E.hibpCount('x', async () => { throw new TypeError('offline'); }));
await assert.rejects(E.hibpCount('x', async () => ({ ok: false, status: 503 })));

// Süre biçimi
assert.equal(E.formatDuration(0.2), 'anında');
assert.equal(E.formatDuration(86400 * 3), 'yaklaşık 3 gün');
assert.equal(E.formatDuration(86400 * 365.25 * 4200), 'yaklaşık 4 bin yıl');
assert.equal(E.formatDuration(Infinity), 'trilyonlarca yıldan uzun');
assert.equal(E.formatBits(16.63), '16,6');

// Desen analizi
const show = (p, ui) => { const r = E.patternAnalysis(p, ui); return `${p.padEnd(22)} ${r.bits.toFixed(1).padStart(5)}  ` + r.segments.map(s => `${s.text}=${s.label}`).join(' | '); };
const cases = ['fgğıodrnhp','ankara06','galatasaray1905','29ekim1923','cumhuriyet1923','sifre1234','şifre1234','İSTANBUL34','ISPARTA32','IŞIK2020','kalemdefter','gunesliCarsamba','P@ssw0rd!','qwerty123456','kV9#tLq2@Wz7!mRd','mehmetyilmaz1985','20231015','aaaaaaaa','teknoloji!'];
for (const c of cases) console.log(show(c));
console.log(show('emre1990ankara', ['Emre', 'Ankara', 1990]));
const b = (p, ui) => E.patternAnalysis(p, ui).bits;
assert.ok(b('cumhuriyet1923') < 20);
assert.ok(b('sifre1234') < 21 && Math.abs(b('sifre1234') - b('şifre1234')) < 1.5);
assert.ok(b('İSTANBUL34') < 25, 'İ harfi');
assert.ok(b('kV9#tLq2@Wz7!mRd') > 50);
// 2. adım: Türkçe klavye düzenleri ve yerel kalıplar
const lab = (p) => E.patternAnalysis(p).segments.map((s) => s.label).join(' | ');
assert.ok(b('fgğıodrnhp') < 15 && lab('fgğıodrnhp') === 'Klavye deseni (Türkçe F)', lab('fgğıodrnhp'));
assert.ok(b('qwertyuıopğü') < 15 && lab('qwertyuıopğü') === 'Klavye deseni (Türkçe Q)');
assert.ok(b('ankara06') < 8 && lab('ankara06') === 'İl ve plaka kodu');
assert.ok(b('İSTANBUL34') < 8 && b('ISPARTA32') < 10);
assert.ok(b('galatasaray1905') < 8 && b('fenerbahce1907') < 8 && b('gs1905') < 8);
assert.ok(b('29ekim1923') < 8 && b('fatih1453') < 8);
assert.ok(lab('mehmetyilmaz1985').startsWith('Yaygın Türkçe ad | Yaygın Türkçe soyad'));
// Ek listeler rastgele parolaların tahminini bozmamalı
const plain = E.createFactory({ extras: false });
assert.equal(E.patternAnalysis('kV9#tLq2@Wz7!mRd', [], plain).bits, b('kV9#tLq2@Wz7!mRd'));
console.log('kişisel bilgi: korkutalp', b('korkutalp').toFixed(1), '->', b('korkutalp', ['Korkutalp']).toFixed(1), '| emre1990ankara', b('emre1990ankara').toFixed(1), '->', b('emre1990ankara', ['Emre','Ankara',1990]).toFixed(1));
assert.ok(b('korkutalp', ['Korkutalp']) < b('korkutalp') - 5, 'kişisel bilgi');
// Kişisel bilgilerde Türkçe İ/I ve Türkçe karaktersiz yazım
for (const [p, ui] of [['zirvex1990', ['ZİRVEX']], ['zirvex1990', ['Zİrvex']], ['zırvax1990', ['ZIRVAX']], ['ZIRVAX1990', ['zırvax']], ['zirvax1990', ['Zırvax']]]) {
  assert.ok(b(p, ui) < b(p) - 5, `kişisel bilgi (Türkçe harf): ${p} / ${ui}`);
}
const seg = E.patternAnalysis('İSTANBUL34').segments;
assert.equal(seg.map(s => s.text).join(''), 'İSTANBUL34');
// 256 karakterden uzun parolada parçalar yine parolanın tamamını kapsamalı
const longPw = 'kV9#tLq2@Wz7!mRd'.repeat(17);
assert.equal(E.patternAnalysis(longPw).segments.map(s => s.text).join(''), longPw);

// Rastgele parolalarda yanlış "desenli görünüyor" uyarısı oranı
const sets = { lower: 'abcdefghijklmnopqrstuvwxyz', alnum: 'abcdefghijklmnopqrstuvwxyz0123456789', full: Array.from({length:94},(_,i)=>String.fromCharCode(33+i)).join('') };
for (const [name, cs] of Object.entries(sets)) for (const len of [8, 12, 16, 24]) {
  let warn = 0; const N = 300;
  for (let k = 0; k < N; k++) {
    const p = Array.from({ length: len }, () => cs[randomInt(cs.length)]).join('');
    if (E.looksPatterned(E.patternAnalysis(p), E.randomCharBits(p, E.detectPool(p).size), len)) warn++;
  }
  console.log(`yanlış uyarı ${name} len=${len}: ${warn}/${N}`);
}
for (const p of ['Password1!', 'Galatasaray1905', 'qwerty123456', 'cumhuriyet1923']) {
  assert.ok(E.looksPatterned(E.patternAnalysis(p), E.randomCharBits(p, E.detectPool(p).size), p.length), p);
}
// ---------- Parola oluşturucu ----------
const G = await import('../src/generator.js');
// Kelime listeleri: boyut, tekillik, biçim; ASCII'ye çevrilince kaba ya da istenmeyen kelime yok
const trList = G.WORDLISTS.tr.words;
assert.equal(trList.length, 2048);
assert.equal(new Set(trList).size, trList.length);
assert.ok(trList.every((w) => /^[a-z]{4,8}$/.test(w)), 'Türkçe liste biçimi');
for (const w of ['sikmak', 'siki', 'pisi', 'fagot', 'parola', 'sifre', 'zili', 'batimi']) assert.ok(!trList.includes(w), w);
assert.equal(G.WORDLISTS.en.words.length, 7776);
assert.equal(new Set(G.WORDLISTS.en.words).size, 7776);

// randomBelow: üst sınırı aşan değerler reddedilir (yanlılık yok)
// n = 3 için 2^32 mod 3 = 1, yani yalnızca 2^32 - 1 reddedilir.
const seq = (vals) => { const f = (buf) => { buf[0] = vals[f.calls++]; return buf; }; f.calls = 0; return f; };
const fill = seq([2 ** 32 - 1, 7]);
assert.equal(G.randomBelow(3, fill), 1, 'reddetme örneklemesi');
assert.equal(fill.calls, 2, 'en büyük değer reddedilmeli');
assert.equal(G.randomBelow(3, seq([2 ** 32 - 2])), (2 ** 32 - 2) % 3, 'sınırın altı kabul edilmeli');
// Gerçek kaynakla kaba eşit dağılım denetimi (ki-kare, 6 serbestlik derecesi, %0,1 eşiği 22,46)
{
  const n = 7, N = 70000, counts = new Array(n).fill(0);
  for (let k = 0; k < N; k++) counts[G.randomBelow(n)]++;
  const chi = counts.reduce((s, c) => s + (c - N / n) ** 2 / (N / n), 0);
  assert.ok(chi < 22.46, `randomBelow dağılımı: ki-kare ${chi.toFixed(1)}`);
}

// Her kümeden en az bir karakter şartıyla sayım: küçük örnekte tek tek sayarak doğrula
{
  const sets = ['ab', 'XY', '12'];
  const all = sets.join('');
  let brute = 0;
  const walk = (s) => {
    if (s.length === 4) { if (sets.every((set) => [...s].some((c) => set.includes(c)))) brute++; return; }
    for (const c of all) walk(s + c);
  };
  walk('');
  assert.equal(G.countCharPasswords(4, sets), BigInt(brute));
}
assert.ok(Math.abs(G.log2Big(2n ** 200n * 3n) - (200 + Math.log2(3))) < 1e-9, 'log2Big');

// Rastgele karakterler: uzunluk, seçilen her türden en az bir karakter, tam entropi
for (const opts of [{ length: 8 }, { length: 20 }, { length: 12, symbols: false }, { length: 16, upper: false, digits: false, symbols: false }]) {
  for (let k = 0; k < 200; k++) {
    const r = G.randomChars(opts);
    const sets = G.charSets(opts);
    assert.equal(r.password.length, opts.length);
    assert.ok(sets.every((s) => [...r.password].some((c) => s.includes(c))), r.password);
    assert.ok([...r.password].every((c) => sets.join('').includes(c)), r.password);
  }
}
const allOn = G.randomChars({ length: 20 }).bits;
assert.ok(allOn < 20 * Math.log2(75) && allOn > 20 * Math.log2(75) - 1, `20 karakter: ${allOn}`);
assert.ok(Math.abs(G.randomChars({ length: 16, upper: false, digits: false, symbols: false }).bits - 16 * Math.log2(26)) < 1e-9);

// Akılda kalır: biçim ve entropi
{
  const r = G.memorable({ words: 5, list: 'tr', capitalize: true, digits: true, separator: 'hyphen' });
  assert.match(r.password, /^[A-Z][a-z]{3,7}\d(-[A-Z][a-z]{3,7}\d){4}$/, r.password);
  assert.ok(Math.abs(r.bits - 5 * (11 + Math.log2(10))) < 1e-9);
  const parts = r.password.split('-').map((p) => p.slice(0, -1).toLowerCase());
  assert.ok(parts.every((p) => trList.includes(p)), r.password);
  const e = G.memorable({ words: 6, list: 'en', capitalize: false, digits: false, separator: 'space' });
  assert.equal(e.password.split(' ').length, 6);
  assert.ok(Math.abs(e.bits - 6 * Math.log2(7776)) < 1e-9);
  const s = G.memorable({ words: 4, list: 'tr', capitalize: false, digits: false, separator: 'digitsSymbols' });
  assert.ok(Math.abs(s.bits - (4 * 11 + 3 * Math.log2(23))) < 1e-9);
  assert.match(s.password, /^[a-z]+[0-9!#$%&*+\-=?@^_][a-z]+[0-9!#$%&*+\-=?@^_][a-z]+[0-9!#$%&*+\-=?@^_][a-z]+$/, s.password);
}
// Varsayılan ayarlar en az 60 bit vermeli
assert.ok(G.memorableBits({}) >= 60 && G.randomChars({}).bits >= 60);
console.log('parola oluşturucu: örnek', G.memorable().password, G.randomChars().password);

console.log('TÜM TESTLER GEÇTİ');
