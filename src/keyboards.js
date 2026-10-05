// Klavye komşuluk tabloları. zxcvbn'in özgün üretecindeki "eğik" düzen modeli:
// (x, y) konumundaki tuşun komşuları sırasıyla sol, üst, sağ üst, sağ, alt, sol alt.
// Her satır [başlangıç x'i, tuşlar] biçimindedir; tuş = normal + Shift karakteri.
export function buildGraph(rows) {
  const pos = new Map();
  rows.forEach(([x0, keys], y) => keys.forEach((k, n) => pos.set(`${x0 + n},${y}`, k)));
  const graph = {};
  for (const [at, chars] of pos) {
    const [x, y] = at.split(',').map(Number);
    const adj = [[x - 1, y], [x, y - 1], [x + 1, y - 1], [x + 1, y], [x, y + 1], [x - 1, y + 1]]
      .map(([a, b]) => pos.get(`${a},${b}`) ?? null);
    for (const ch of chars) graph[ch] = adj;
  }
  return graph;
}

// Üretecin doğruluğunu sınamak için: zxcvbn'deki ABD QWERTY tablosuyla birebir aynı çıkmalı.
export const US_QWERTY_ROWS = [
  [0, ['`~', '1!', '2@', '3#', '4$', '5%', '6^', '7&', '8*', '9(', '0)', '-_', '=+']],
  [1, ['qQ', 'wW', 'eE', 'rR', 'tT', 'yY', 'uU', 'iI', 'oO', 'pP', '[{', ']}', '\\|']],
  [1, ['aA', 'sS', 'dD', 'fF', 'gG', 'hH', 'jJ', 'kK', 'lL', ';:', '\'"']],
  [1, ['zZ', 'xX', 'cC', 'vV', 'bB', 'nN', 'mM', ',<', '.>', '/?']],
];

// Türkçe Q (TS 5881). Alt satırın başındaki "<>" tuşu ISO klavyelerdeki ek tuştur.
export const TURKISH_Q_ROWS = [
  [0, ['"é', '1!', '2\'', '3^', '4+', '5%', '6&', '7/', '8(', '9)', '0=', '*?', '-_']],
  [1, ['qQ', 'wW', 'eE', 'rR', 'tT', 'yY', 'uU', 'ıI', 'oO', 'pP', 'ğĞ', 'üÜ']],
  [1, ['aA', 'sS', 'dD', 'fF', 'gG', 'hH', 'jJ', 'kK', 'lL', 'şŞ', 'iİ', ',;']],
  [0, ['<>', 'zZ', 'xX', 'cC', 'vV', 'bB', 'nN', 'mM', 'öÖ', 'çÇ', '.:']],
];

// Türkçe F
export const TURKISH_F_ROWS = [
  [0, ['+*', '1!', '2"', '3^', '4$', '5%', '6&', '7\'', '8(', '9)', '0=', '/?', '-_']],
  [1, ['fF', 'gG', 'ğĞ', 'ıI', 'oO', 'dD', 'rR', 'nN', 'hH', 'pP', 'qQ', 'wW']],
  [1, ['uU', 'iİ', 'eE', 'aA', 'üÜ', 'tT', 'kK', 'mM', 'lL', 'yY', 'şŞ', 'xX']],
  [0, ['<>', 'jJ', 'öÖ', 'vV', 'cC', 'çÇ', 'zZ', 'sS', 'bB', '.:', ',;']],
];

export const turkishGraphs = {
  turkishQ: buildGraph(TURKISH_Q_ROWS),
  turkishF: buildGraph(TURKISH_F_ROWS),
};
