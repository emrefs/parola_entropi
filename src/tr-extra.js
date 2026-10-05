// Türkçe ek sözlükler. ELLE DERLENMİŞTİR: sızıntı verisinden ölçülmüş sıklıklara değil,
// genel bilgiye dayanır; sıralar yaklaşıktır. Her liste "en olası önce" sıralıdır,
// çünkü zxcvbn sırayı (rank) tahmin sayısı olarak kullanır.

// ---- İller: dizideki konum + 1 = plaka kodu ----
const PROVINCES = [
  'adana', 'adıyaman', 'afyonkarahisar', 'ağrı', 'amasya', 'ankara', 'antalya', 'artvin', 'aydın', 'balıkesir',
  'bilecik', 'bingöl', 'bitlis', 'bolu', 'burdur', 'bursa', 'çanakkale', 'çankırı', 'çorum', 'denizli',
  'diyarbakır', 'edirne', 'elazığ', 'erzincan', 'erzurum', 'eskişehir', 'gaziantep', 'giresun', 'gümüşhane', 'hakkari',
  'hatay', 'ısparta', 'mersin', 'istanbul', 'izmir', 'kars', 'kastamonu', 'kayseri', 'kırklareli', 'kırşehir',
  'kocaeli', 'konya', 'kütahya', 'malatya', 'manisa', 'kahramanmaraş', 'mardin', 'muğla', 'muş', 'nevşehir',
  'niğde', 'ordu', 'rize', 'sakarya', 'samsun', 'siirt', 'sinop', 'sivas', 'tekirdağ', 'tokat',
  'trabzon', 'tunceli', 'şanlıurfa', 'uşak', 'van', 'yozgat', 'zonguldak', 'aksaray', 'bayburt', 'karaman',
  'kırıkkale', 'batman', 'şırnak', 'bartın', 'ardahan', 'ığdır', 'yalova', 'karabük', 'kilis', 'osmaniye', 'düzce',
];
// Yaygın kısa adlar ve il merkezleri: [ad, plaka kodu]
const ALT_NAMES = [
  ['afyon', 3], ['antep', 27], ['maraş', 46], ['urfa', 63], ['izmit', 41], ['adapazarı', 54], ['antakya', 31], ['içel', 33],
];
// Nüfusa göre yaklaşık ilk sıralar; kalanlar plaka sırasıyla eklenir.
const BIG_FIRST = [
  'istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'konya', 'adana', 'şanlıurfa', 'gaziantep', 'kocaeli',
  'mersin', 'diyarbakır', 'hatay', 'manisa', 'kayseri', 'samsun', 'balıkesir', 'tekirdağ', 'aydın', 'van',
  'kahramanmaraş', 'sakarya', 'muğla', 'denizli', 'eskişehir', 'mardin', 'trabzon', 'ordu', 'malatya', 'erzurum',
];
const code = (n) => String(n).padStart(2, '0');
const plateOf = new Map(PROVINCES.map((p, i) => [p, code(i + 1)]));
const provinceOrder = [...BIG_FIRST, ...PROVINCES.filter((p) => !BIG_FIRST.includes(p))];

const places = [...provinceOrder.slice(0, 30), ...ALT_NAMES.map(([n]) => n), ...provinceOrder.slice(30)];
const cityPlate = [];
for (const p of provinceOrder.slice(0, 30)) cityPlate.push(p + plateOf.get(p), plateOf.get(p) + p);
for (const [n, c] of ALT_NAMES) cityPlate.push(n + code(c), code(c) + n);
for (const p of provinceOrder.slice(30)) cityPlate.push(p + plateOf.get(p), plateOf.get(p) + p);

// ---- Kulüpler ----
const BIG_CLUBS = [
  { names: ['galatasaray', 'gs', 'cimbom'], year: 1905 },
  { names: ['fenerbahçe', 'fb', 'fener'], year: 1907 },
  { names: ['beşiktaş', 'bjk', 'karakartal', 'kartal', 'çarşı'], year: 1903 },
  { names: ['trabzonspor', 'ts'], year: 1967 },
];
const OTHER_CLUBS = [
  ['bursaspor', 1963], ['göztepe', 1925], ['karşıyaka', 1912], ['altay', 1914], ['ankaragücü', 1910],
  ['gençlerbirliği', 1923], ['eskişehirspor', 1965], ['samsunspor', 1965], ['sivasspor', 1967], ['konyaspor', 1922],
  ['kayserispor', 1966], ['antalyaspor', 1966], ['kocaelispor', 1966], ['sakaryaspor', 1965],
  ['adanademirspor', 1940], ['adanaspor', 1954], ['rizespor', 1953],
];
const clubs = [
  'galatasaray', 'fenerbahçe', 'beşiktaş', 'trabzonspor', 'cimbom', 'fener', 'karakartal', 'cimbombom', 'ultraslan',
  'çarşı', 'bordomavi', 'sarıkanarya', 'sarılacivert', 'sarıkırmızı', 'siyahbeyaz',
  ...OTHER_CLUBS.map(([n]) => n),
  'başakşehir', 'alanyaspor', 'gaziantepspor', 'denizlispor', 'malatyaspor', 'hatayspor', 'kasımpaşa',
];
const clubYear = [];
for (const c of BIG_CLUBS) clubYear.push(c.names[0] + c.year, c.names[1] + c.year);
for (const c of BIG_CLUBS) {
  for (const n of c.names.slice(2)) clubYear.push(n + c.year);
  clubYear.push(c.year + c.names[0], c.year + c.names[1]);
}
clubYear.push('ts61', 'bordomavi61', 'trabzonspor61');
for (const [n, y] of OTHER_CLUBS) clubYear.push(n + y, y + n);

// ---- Özel günler, tarihsel kalıplar, bilinen sayılar ----
const specialDays = [
  '29ekim', '23nisan', '19mayıs', '30ağustos', '10kasım', '29ekim1923', 'cumhuriyet1923', 'türkiye1923', 'tc1923',
  'fatih1453', 'istanbul1453', 'atatürk1881', 'atatürk1938', '18811938', '19mayıs1919', '23nisan1920', '30ağustos1922',
  '10kasım1938', '18mart', '18mart1915', '15temmuz', '1mayıs', '14şubat', '8mart', '1ocak', '31aralık',
  '1453fatih', '1453istanbul', '1881atatürk', '1923cumhuriyet', 'mustafakemal1881', 'mka1881',
  'malazgirt1071', '1071malazgirt', 'osmanlı1299',
];
const knownNumbers = ['1453', '1071', '1881', '1299', '571'];

// ---- Parolalarda sık geçen Türkçe kelime ve kalıplar ----
const passwordWords = [
  'şifre', 'parola', 'şifrem', 'aşkım', 'canım', 'seniseviyorum', 'türkiye', 'atatürk', 'birtanem', 'bebeğim',
  'hayatım', 'sevgilim', 'annem', 'babam', 'allah', 'bismillah', 'muhammed', 'merhaba', 'deneme', 'bitanem',
  'tatlım', 'meleğim', 'gülüm', 'kızım', 'oğlum', 'kardeşim', 'ailem', 'canımannem', 'canımbabam', 'aşkımsın',
  'senicokseviyorum', 'seviyorum', 'sevgi', 'mutluluk', 'özgürlük', 'mustafakemal', 'kemalatatürk', 'türk', 'vatan',
  'bayrak', 'cumhuriyet', 'elhamdülillah', 'inşallah', 'maşallah', 'selam', 'selamünaleyküm', 'anahtar', 'gizli',
  'gizlişifre', 'benimşifrem', 'şifreyok', 'bilmiyorum', 'unuttum', 'kimsebilmez', 'yönetici', 'kullanıcı',
  'parolam', 'girişyap', 'hoşgeldin', 'hoşgeldiniz', 'günaydın', 'iyigeceler', 'nasılsın', 'tamam', 'evet', 'hayır',
];

// ---- En yaygın adlar ve soyadlar (yaklaşık sıklık sırası) ----
const popularNames = [
  'mehmet', 'fatma', 'mustafa', 'ayşe', 'ahmet', 'emine', 'ali', 'hatice', 'hüseyin', 'zeynep',
  'hasan', 'elif', 'ibrahim', 'meryem', 'ismail', 'şerife', 'osman', 'zehra', 'yusuf', 'sultan',
  'murat', 'hanife', 'ömer', 'merve', 'ramazan', 'havva', 'halil', 'zeliha', 'süleyman', 'esra',
  'abdullah', 'fadime', 'mahmut', 'özlem', 'recep', 'hacer', 'salih', 'yasemin', 'fatih', 'hülya',
  'kadir', 'cemile', 'emre', 'sevim', 'hakan', 'gülsüm', 'adem', 'leyla', 'kemal', 'dilek',
  'yaşar', 'büşra', 'bekir', 'aysel', 'musa', 'songül', 'metin', 'kübra', 'serkan', 'halime',
  'orhan', 'rabia', 'burak', 'tuğba', 'furkan', 'sevgi', 'gökhan', 'ebru', 'uğur', 'derya',
  'yakup', 'gamze', 'muhammed', 'seda', 'enes', 'selin', 'yunus', 'ece', 'cemal', 'defne',
  'arif', 'ecrin', 'onur', 'nisa', 'yasin', 'azra', 'mert', 'irem', 'emir', 'aleyna',
  'eren', 'damla', 'kerem', 'gizem', 'can', 'melek', 'berat', 'pınar', 'yiğit', 'sibel',
  'efe', 'aslı', 'ozan', 'burcu', 'volkan', 'deniz', 'tolga', 'ceren', 'cem', 'eda',
  'barış', 'tuba', 'oğuz', 'nur', 'kaan', 'gül', 'umut', 'sena', 'ege', 'şeyma',
  'tuncay', 'nurcan', 'erkan', 'filiz', 'sinan', 'serpil', 'levent', 'şule', 'engin', 'neslihan',
];
const popularLastnames = [
  'yılmaz', 'kaya', 'demir', 'çelik', 'şahin', 'yıldız', 'yıldırım', 'öztürk', 'aydın', 'özdemir',
  'arslan', 'doğan', 'kılıç', 'aslan', 'çetin', 'kara', 'koç', 'kurt', 'özkan', 'şimşek',
  'polat', 'özcan', 'korkmaz', 'çakır', 'erdoğan', 'yavuz', 'can', 'acar', 'şen', 'aktaş',
  'güler', 'yalçın', 'güneş', 'bozkurt', 'bulut', 'keskin', 'ünal', 'turan', 'gül', 'özer',
  'ışık', 'kaplan', 'avcı', 'sarı', 'tekin', 'taş', 'köse', 'yüksel', 'ateş', 'aksoy',
  'kahraman', 'çiftçi', 'duman', 'karaca', 'durmaz', 'tunç', 'uçar', 'türk', 'demirci', 'altun',
  'kocaman', 'coşkun', 'karakaya', 'güven', 'kandemir', 'uysal', 'akın', 'yiğit', 'bayram', 'gündüz',
  'çınar', 'karataş', 'toprak', 'erdem', 'güngör', 'özgür', 'eren', 'ekinci', 'bilgin', 'akbulut',
  'demirel', 'ay', 'kalkan', 'aydoğan', 'başaran', 'tuna', 'çoban', 'sezer', 'durmuş', 'karabulut',
  'özbek', 'altın', 'soylu', 'uzun', 'öz', 'özkaya', 'gök', 'erol', 'şeker', 'tan',
];

export const extraDictionary = {
  'popularNames-tr': popularNames,
  'popularLastnames-tr': popularLastnames,
  'places-tr': places,
  'cityPlate-tr': cityPlate,
  'clubs-tr': clubs,
  'clubYear-tr': clubYear,
  'specialDays-tr': specialDays,
  'knownNumbers-tr': knownNumbers,
  'passwordWords-tr': passwordWords,
};
