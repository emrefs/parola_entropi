// Parola üreteci: DOM'a dokunmaz, Node'da da test edilebilir.
// Rastgelelik crypto.getRandomValues'tan gelir; her seçim reddetme örneklemesiyle eşit olasılıklıdır.
// Entropi tahmin değil, üretecin seçim uzayından tam olarak hesaplanır.
import * as common from '@zxcvbn-ts/language-common';
import { WORDLIST_TR } from './wordlist-tr.js';

// EFF büyük kelime listesi (7776 kelime, CC BY 3.0 US); zxcvbn-ts ortak paketinde "diceware" adıyla gelir.
const WORDLIST_EN = common.dictionary['diceware-common'].map(String);
export const WORDLISTS = {
  tr: { words: WORDLIST_TR, label: 'Türkçe' },
  en: { words: WORDLIST_EN, label: 'İngilizce (EFF)' },
};

export const CHARSETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  // Sitelerin çoğunun kabul ettiği, tırnak, ters bölü ve boşluk içermeyen simgeler
  symbols: '!#$%&*+-=?@^_',
};

export const SEPARATORS = {
  hyphen: { label: 'Tire', chars: '-' },
  space: { label: 'Boşluk', chars: ' ' },
  period: { label: 'Nokta', chars: '.' },
  underscore: { label: 'Alt çizgi', chars: '_' },
  comma: { label: 'Virgül', chars: ',' },
  digits: { label: 'Rakam', chars: CHARSETS.digits, random: true },
  digitsSymbols: { label: 'Rakam ve simge', chars: CHARSETS.digits + CHARSETS.symbols, random: true },
};

// ---------- Rastgelelik ----------
const defaultRandom = (arr) => globalThis.crypto.getRandomValues(arr);

// [0, n) aralığında eşit olasılıklı tamsayı. 2^32'nin n'e tam bölünmeyen artığı reddedilir.
export function randomBelow(n, fill = defaultRandom) {
  if (!Number.isInteger(n) || n < 1 || n > 2 ** 32) throw new RangeError(`geçersiz aralık: ${n}`);
  const limit = 2 ** 32 - (2 ** 32 % n);
  const buf = new Uint32Array(1);
  for (;;) {
    fill(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}
const pick = (str, fill) => str[randomBelow(str.length, fill)];

// BigInt için log2 (büyük sayılarda üst 53 bit yeterli doğruluk verir).
export function log2Big(n) {
  if (n <= 0n) return -Infinity;
  const bits = n.toString(2).length;
  const shift = Math.max(0, bits - 53);
  return Math.log2(Number(n >> BigInt(shift))) + shift;
}

// ---------- Rastgele karakterler ----------
export function charSets({ upper = true, digits = true, symbols = true } = {}) {
  const sets = [CHARSETS.lower];
  if (upper) sets.push(CHARSETS.upper);
  if (digits) sets.push(CHARSETS.digits);
  if (symbols) sets.push(CHARSETS.symbols);
  return sets;
}

// Seçilen her kümeden en az bir karakter içeren, length uzunluğundaki dizilerin sayısı
// (içerme-dışlama ilkesi). Kümeler ayrık olduğu için birleşim boyutları toplanır.
export function countCharPasswords(length, sets) {
  const sizes = sets.map((s) => BigInt(s.length));
  const total = sizes.reduce((a, b) => a + b, 0n);
  let count = 0n;
  for (let mask = 0; mask < 1 << sizes.length; mask++) {
    let missing = 0n;
    let k = 0;
    sizes.forEach((size, i) => { if (mask & (1 << i)) { missing += size; k++; } });
    const term = (total - missing) ** BigInt(length);
    count += k % 2 ? -term : term;
  }
  return count;
}

export function randomChars({ length = 20, ...opts } = {}, fill = defaultRandom) {
  const sets = charSets(opts);
  if (length < sets.length) throw new RangeError('uzunluk seçilen karakter türü sayısından az olamaz');
  const all = sets.join('');
  // Her kümeden en az bir karakter şartını sağlamayan diziler atılır; kalanlar eşit olasılıklıdır.
  for (;;) {
    let pw = '';
    for (let i = 0; i < length; i++) pw += pick(all, fill);
    if (sets.every((s) => [...pw].some((ch) => s.includes(ch)))) {
      return { password: pw, bits: log2Big(countCharPasswords(length, sets)) };
    }
  }
}

// ---------- Akılda kalır (kelimeler) ----------
export function memorableBits({ words = 5, list = 'tr', digits = true, separator = 'hyphen' } = {}) {
  const sep = SEPARATORS[separator];
  return words * Math.log2(WORDLISTS[list].words.length)
    + (digits ? words * Math.log2(10) : 0)
    + (sep.random ? (words - 1) * Math.log2(sep.chars.length) : 0);
}

export function memorable({ words = 5, list = 'tr', capitalize = true, digits = true, separator = 'hyphen' } = {}, fill = defaultRandom) {
  const wordList = WORDLISTS[list].words;
  const sep = SEPARATORS[separator];
  const parts = [];
  for (let i = 0; i < words; i++) {
    let w = wordList[randomBelow(wordList.length, fill)];
    if (capitalize) w = w[0].toUpperCase() + w.slice(1);
    if (digits) w += pick(CHARSETS.digits, fill);
    parts.push(w);
  }
  let password = parts[0];
  for (let i = 1; i < parts.length; i++) password += (sep.random ? pick(sep.chars, fill) : sep.chars) + parts[i];
  return { password, bits: memorableBits({ words, list, digits, separator }) };
}

export function generate(options, fill = defaultRandom) {
  return options.kind === 'chars' ? randomChars(options, fill) : memorable(options, fill);
}
