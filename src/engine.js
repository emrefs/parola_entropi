// Hesaplama çekirdeği: DOM'a dokunmaz, Node'da da test edilebilir.
import { ZxcvbnFactory } from '@zxcvbn-ts/core';
import * as common from '@zxcvbn-ts/language-common';
import * as en from '@zxcvbn-ts/language-en';
import * as tr from '@zxcvbn-ts/language-tr';
import { extraDictionary } from './tr-extra.js';
import { turkishGraphs } from './keyboards.js';

const LOG2_10 = Math.log2(10);

// ---------- Türkçe karaktersiz sözlük kopyaları ----------
const FOLD = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
export const foldTr = (w) => w.replace(/[çğıöşüâîû]/g, (ch) => FOLD[ch]);

// Her Türkçe listenin "sifre", "gunes" gibi ASCII yazımlı kopyası. Sıra (rank) korunur:
// değişmeyen kelimelerin yerine boş dize konur, böylece asıl listeyle çakışmaz.
function asciiCopies(dict) {
  const out = {};
  for (const [name, list] of Object.entries(dict)) {
    const folded = list.map((w) => {
      const s = String(w);
      const f = foldTr(s);
      return f === s ? '' : f;
    });
    if (folded.some(Boolean)) out[`${name}-ascii`] = folded;
  }
  return out;
}

// extras: false, yalnızca hazır paketlerle (ek sözlük ve Türkçe klavyeler olmadan) kurar;
// testlerde ek listelerin etkisini ölçmek için kullanılır.
export function createFactory({ extras = true } = {}) {
  const trAll = extras ? { ...tr.dictionary, ...extraDictionary } : tr.dictionary;
  return new ZxcvbnFactory({
    dictionary: {
      ...common.dictionary,
      ...en.dictionary,
      ...trAll,
      ...asciiCopies(trAll),
    },
    graphs: extras ? { ...common.adjacencyGraphs, ...turkishGraphs } : common.adjacencyGraphs,
    translations: en.translations,
  });
}

let factory = null;
export function init() {
  if (!factory) factory = createFactory();
}

// ---------- Eşleşmeleri Türkçe etiketlere çevirme ----------
const TR_NAMES = {
  'commonWords-tr': 'Türkçe kelime',
  'wikipedia-tr': 'Türkçe kelime',
  'firstnames-tr': 'Türkçe ad',
  'lastnames-tr': 'Türkçe soyad',
  'popularNames-tr': 'Yaygın Türkçe ad',
  'popularLastnames-tr': 'Yaygın Türkçe soyad',
  'places-tr': 'İl adı',
  'cityPlate-tr': 'İl ve plaka kodu',
  'clubs-tr': 'Kulüp',
  'clubYear-tr': 'Kulüp ve yıl',
  'specialDays-tr': 'Özel gün veya tarih',
  'knownNumbers-tr': 'Bilinen yıl veya sayı',
  'passwordWords-tr': 'Yaygın parola kelimesi',
};
const GRAPH_NAMES = {
  turkishQ: 'Türkçe Q',
  turkishF: 'Türkçe F',
  keypad: 'sayı tuşları',
  keypadMac: 'sayı tuşları',
};
const EN_NAMES = {
  'commonWords-en': 'İngilizce kelime',
  'wikipedia-en': 'İngilizce kelime',
  'firstnames-en': 'İngilizce ad',
  'lastnames-en': 'İngilizce soyad',
};

export function describeMatch(m) {
  let kind = 'none';
  let label = 'Eşleşme yok';
  switch (m.pattern) {
    case 'dictionary': {
      const raw = m.dictionaryName || '';
      const ascii = raw.endsWith('-ascii');
      const name = ascii ? raw.slice(0, -6) : raw;
      if (name === 'passwords-common') { kind = 'leaked'; label = 'Yaygın parola'; }
      else if (name === 'userInputs') { kind = 'personal'; label = 'Kişisel bilgi'; }
      else if (name === 'diceware-common') { kind = 'en'; label = 'Diceware kelimesi'; }
      else if (name.endsWith('-tr')) { kind = 'tr'; label = TR_NAMES[name] || 'Türkçe terim'; }
      else if (name.endsWith('-en')) { kind = 'en'; label = EN_NAMES[name] || 'İngilizce terim'; }
      else { kind = 'en'; label = 'Sözlük kelimesi'; }
      const extra = [];
      if (ascii) extra.push('Türkçe karaktersiz');
      if (m.l33t) extra.push('harf değişimli');
      if (m.reversed) extra.push('ters yazılmış');
      if (extra.length) label += ` (${extra.join(', ')})`;
      break;
    }
    case 'date': kind = 'date'; label = 'Tarih'; break;
    case 'regex': kind = 'date'; label = 'Yıl'; break;
    case 'repeat': kind = 'pattern'; label = 'Tekrar'; break;
    case 'sequence': kind = 'pattern'; label = 'Ardışık dizi'; break;
    case 'spatial':
      kind = 'pattern';
      label = GRAPH_NAMES[m.graph] ? `Klavye deseni (${GRAPH_NAMES[m.graph]})` : 'Klavye deseni';
      break;
    case 'separator': kind = 'pattern'; label = 'Ayraç'; break;
    default: break;
  }
  return { kind, label };
}

// ---------- Desen analizi (zxcvbn) ----------
// zxcvbn kişisel bilgileri toLowerCase() ile küçültür: "İsmail" "i̇smail", "IŞIK" "işik" olur
// ve parolayla eşleşmez. Her girdinin Türkçe küçük harfli ve Türkçe karaktersiz yazımları da
// eklenir. Asıl girdiler başta kalır, böylece sıraları (rank) değişmez.
export function expandUserInputs(userInputs) {
  const out = [];
  const add = (w) => { if (w && !out.includes(w)) out.push(w); };
  for (const raw of userInputs) add(String(raw));
  for (const raw of userInputs) {
    const s = String(raw);
    for (const v of [s.replace(/İ/g, 'I').toLowerCase(), s.toLocaleLowerCase('tr-TR')]) {
      add(v);
      add(foldTr(v));
    }
  }
  return out;
}

// JavaScript'in küçük harfe çevirmesi Türkçe İ/I harflerini doğru işlemez; bu yüzden
// parolanın iki yazımı denenir ve saldırgan için daha kolay olanı (az tahmin) alınır.
export function patternAnalysis(password, userInputs = [], engine = null) {
  init();
  const zx = engine || factory;
  const inputs = expandUserInputs(userInputs);
  const variants = [password.replace(/İ/g, 'I')];
  if (/[Iİ]/.test(password)) variants.push(password.replace(/İ/g, 'i').replace(/I/g, 'ı'));
  let best = null;
  for (const v of variants) {
    const r = zx.check(v, inputs);
    if (!best || r.guessesLog10 < best.guessesLog10) best = r;
  }
  const segments = best.sequence.map((m) => ({
    i: m.i,
    j: m.j,
    text: password.slice(m.i, m.j + 1),
    bits: Math.log2(Math.max(1, m.guesses)),
    ...describeMatch(m),
  }));
  // zxcvbn yalnızca ilk maxLength (256) karakteri inceler. Kalan kısım tahmine katkı
  // vermez (sonuç olduğundan düşük çıkar), ama tabloda görünmesi için ayrı parça olarak eklenir.
  const analyzed = best.password.length;
  if (analyzed < password.length) {
    segments.push({
      i: analyzed,
      j: password.length - 1,
      text: password.slice(analyzed),
      bits: 0,
      kind: 'none',
      label: `İncelenmedi (ilk ${analyzed} karakterden sonrası)`,
    });
  }
  return { bits: best.guessesLog10 * LOG2_10, segments };
}

// ---------- Rastgele parola: uzunluk × log2(havuz) ----------
export function detectPool(pw) {
  const lower = /[a-z]/.test(pw);
  const upper = /[A-Z]/.test(pw);
  const digit = /[0-9]/.test(pw);
  const space = / /.test(pw);
  const symbol = /[!-/:-@[-`{-~]/.test(pw);
  const other = /[^\x20-\x7e]/.test(pw);
  const hex = !other && pw.length >= 8 && digit && (lower || upper) && (/^[0-9a-f]+$/.test(pw) || /^[0-9A-F]+$/.test(pw));
  if (hex) return { size: 16, hex: true, other: false };
  const size = (lower ? 26 : 0) + (upper ? 26 : 0) + (digit ? 10 : 0) + (symbol ? 32 : 0) + (space ? 1 : 0);
  return { size, hex: false, other };
}

export const charCount = (pw) => Array.from(pw).length;
export const randomCharBits = (pw, pool) => (pool > 1 ? charCount(pw) * Math.log2(pool) : 0);
export const randomWordBits = (words, listSize) => (words > 0 && listSize > 1 ? words * Math.log2(listSize) : 0);

// Kullanıcı "rastgele" dedi ama parola tanıdık desenlerden oluşuyorsa uyar.
export function looksPatterned(pattern, formulaBits, length) {
  if (!length || !formulaBits) return false;
  const covered = pattern.segments
    .filter((s) => s.kind !== 'none')
    .reduce((n, s) => n + (s.j - s.i + 1), 0);
  return covered / length > 0.6 && pattern.bits < 0.5 * formulaBits;
}

// ---------- Sızıntı cezası (Zipf modeli) ----------
// passwordentropy.com'un kullandığı model: sıra = (C / sıklık)^(1/s), bit = log2(sıra), en çok 25 bit.
export const ZIPF = { C: 1_000_000, s: 0.78, capBits: 25 };
export function breachBits(count) {
  if (!(count > 0)) return Infinity;
  const f = Math.min(count, ZIPF.C);
  const rank = Math.max(1, (ZIPF.C / f) ** (1 / ZIPF.s));
  return Math.min(Math.log2(rank), ZIPF.capBits);
}

// ---------- SHA-1 (saf JS; file:// altında crypto.subtle olmayabilir) ----------
export function sha1Hex(str) {
  const msg = new TextEncoder().encode(str);
  const ml = msg.length;
  const withPad = new Uint8Array(((ml + 9 + 63) >> 6) << 6);
  withPad.set(msg);
  withPad[ml] = 0x80;
  const dv = new DataView(withPad.buffer);
  dv.setUint32(withPad.length - 8, Math.floor((ml * 8) / 0x100000000));
  dv.setUint32(withPad.length - 4, (ml * 8) >>> 0);
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  const rol = (x, n) => (x << n) | (x >>> (32 - n));
  for (let off = 0; off < withPad.length; off += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(off + t * 4);
    for (let t = 16; t < 80; t++) w[t] = rol(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1);
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let t = 0; t < 80; t++) {
      let f, k;
      if (t < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (t < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (t < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      const tmp = (rol(a, 5) + f + e + k + w[t]) | 0;
      e = d; d = c; c = rol(b, 30); b = a; a = tmp;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
  }
  return [h0, h1, h2, h3, h4].map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('').toUpperCase();
}

// ---------- HIBP (k-anonimlik: yalnızca SHA-1'in ilk 5 karakteri gider) ----------
export const HIBP_URL = 'https://api.pwnedpasswords.com/range/';
export async function hibpCount(password, fetchFn) {
  const hash = sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const base = { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' };
  let res;
  try {
    // Dolgu, yanıt boyutundan çıkarım yapılmasını zorlaştırır.
    res = await fetchFn(HIBP_URL + prefix, { ...base, headers: { 'Add-Padding': 'true' } });
  } catch {
    // Özel başlık ön denetime (preflight) takılırsa başlıksız yeniden dene.
    res = await fetchFn(HIBP_URL + prefix, base);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  for (const line of text.split(/\r?\n/)) {
    const [s, c] = line.split(':');
    if (s && s.trim().toUpperCase() === suffix) return parseInt(c, 10) || 0;
  }
  return 0;
}

// ---------- Sunum yardımcıları ----------
export function verdict(bits) {
  if (bits < 28) return 'Çok zayıf';
  if (bits < 40) return 'Zayıf';
  if (bits < 60) return 'Orta';
  if (bits < 80) return 'Güçlü';
  return 'Çok güçlü';
}

export const SCENARIOS = [
  { id: 'online', label: 'Çevrimiçi saldırı, deneme sınırı var', rate: 100 / 3600, rateText: 'saatte 100 deneme' },
  { id: 'slow', label: 'Çalınmış veritabanı, yavaş özet (bcrypt, Argon2)', rate: 1e4, rateText: 'saniyede 10⁴ deneme' },
  { id: 'fast', label: 'Çalınmış veritabanı, hızlı özet (MD5, SHA-1)', rate: 1e11, rateText: 'saniyede 10¹¹ deneme' },
];

const sig1 = (x) => {
  const p = 10 ** Math.floor(Math.log10(x));
  return Math.round(x / p) * p;
};
const num = (x) => sig1(x).toLocaleString('tr-TR');

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return 'trilyonlarca yıldan uzun';
  if (seconds < 1) return 'anında';
  if (seconds < 60) return 'saniyeler';
  const minutes = seconds / 60;
  if (minutes < 60) return `yaklaşık ${num(minutes)} dakika`;
  const hours = minutes / 60;
  if (hours < 24) return `yaklaşık ${num(hours)} saat`;
  const days = hours / 24;
  if (days < 30) return `yaklaşık ${num(days)} gün`;
  if (days < 365) return `yaklaşık ${num(days / 30)} ay`;
  const years = days / 365.25;
  if (years < 1e3) return `yaklaşık ${num(years)} yıl`;
  if (years < 1e6) return `yaklaşık ${num(years / 1e3)} bin yıl`;
  if (years < 1e9) return `yaklaşık ${num(years / 1e6)} milyon yıl`;
  if (years < 1e12) return `yaklaşık ${num(years / 1e9)} milyar yıl`;
  return 'trilyonlarca yıldan uzun';
}

export const crackSeconds = (bits, rate) => 2 ** bits / rate;
export const formatBits = (bits) =>
  bits.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
