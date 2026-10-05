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
const seg = E.patternAnalysis('İSTANBUL34').segments;
assert.equal(seg.map(s => s.text).join(''), 'İSTANBUL34');

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
console.log('TÜM TESTLER GEÇTİ');
