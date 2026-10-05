import * as E from './engine.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

const pw = $('pw');
const state = {
  hidden: true,
  breach: { status: 'idle', count: 0, forPassword: null },
  token: 0,
};

const mode = () => document.querySelector('input[name="mode"]:checked').value;
const mask = (s) => (state.hidden ? '•'.repeat(Array.from(s).length) : s);
const posInt = (input) => {
  const v = parseInt(input.value, 10);
  return Number.isFinite(v) && v > 0 ? v : null;
};

function approxGuesses(bits) {
  const log10 = bits / Math.log2(10);
  if (log10 < 6) {
    const g = Math.max(1, 10 ** log10);
    const p = 10 ** Math.floor(Math.log10(g));
    return { text: `yaklaşık ${(Math.round(g / p) * p).toLocaleString('tr-TR')} deneme` };
  }
  let exp = Math.floor(log10);
  let mant = Math.round(10 ** (log10 - exp));
  if (mant === 10) { mant = 1; exp += 1; }
  return { mant, exp };
}

// ---------- Hesap ----------
function compute() {
  const password = pw.value;
  if (!password) return null;
  const personal = $('personal').value.split(/[,;\s]+/).filter(Boolean);
  const pattern = E.patternAnalysis(password, personal);
  const m = mode();
  const out = { password, mode: m, pattern, warnings: [], needsInput: null };

  if (m === 'human') {
    out.bits = pattern.bits;
    out.segments = pattern.segments;
    out.explain = 'Bu bir tahmindir. Düşük sonuçlar güvenilirdir; yüksek sonuç parolanın güçlü olduğunu kanıtlamaz.';
  } else if (m === 'chars') {
    const auto = E.detectPool(password);
    const manual = posInt($('pool'));
    const pool = manual || auto.size;
    const names = [];
    if (/[a-z]/.test(password)) names.push('küçük harf');
    if (/[A-Z]/.test(password)) names.push('büyük harf');
    if (/[0-9]/.test(password)) names.push('rakam');
    if (/[!-/:-@[-`{-~]/.test(password)) names.push('simge');
    if (/ /.test(password)) names.push('boşluk');
    let hint;
    if (auto.hex) hint = 'Otomatik: 16, çünkü yalnızca onaltılık karakterler var. Üreteciniz tüm harfleri kullanıyorsa 36 girin.';
    else if (auto.other) hint = 'Parolada ASCII dışı karakter var; bunlar otomatik havuza katılmadı. Havuz boyutunu elle girin.';
    else hint = `Otomatik: ${auto.size} (${names.join(', ')}). Üretecinizin havuzu farklıysa elle girin.`;
    $('pool-hint').textContent = hint;
    $('pool').placeholder = auto.size ? String(auto.size) : '';
    if (pool < 2) {
      out.needsInput = 'Havuz boyutunu girin; bu parolada otomatik belirlenemedi.';
      return out;
    }
    const n = E.charCount(password);
    out.bits = E.randomCharBits(password, pool);
    out.segments = [{ text: password, bits: out.bits, kind: 'random', label: `${n} rastgele karakter, havuz ${pool}` }];
    out.explain = `${n} karakter × log₂(${pool}) = ${E.formatBits(out.bits)} bit. Parola gerçekten rastgele üretildiyse bu değer kesindir.`;
    if (E.looksPatterned(pattern, out.bits, password.length)) {
      out.warnings.push(`Bu parola rastgele görünmüyor: tanıdık desenlerden oluşuyor ve desen tahmini yalnızca ${E.formatBits(pattern.bits)} bit. Parolayı kendiniz seçtiyseniz "Kendim seçtim" seçeneğine dönün.`);
    }
  } else {
    const guess = password.split(/[\s\-_.,+]+/).filter(Boolean).length;
    $('words').placeholder = guess > 1 ? String(guess) : '';
    const words = posInt($('words')) || (guess > 1 ? guess : null);
    const list = posInt($('listsize')) || 7776;
    if (!words) {
      out.needsInput = 'Kelime sayısını girin; kelimeler ayraçsız yazıldığı için sayılamadı.';
      return out;
    }
    out.bits = E.randomWordBits(words, list);
    out.segments = [{ text: password, bits: out.bits, kind: 'random', label: `${words} rastgele kelime, liste ${list.toLocaleString('tr-TR')}` }];
    out.explain = `${words} kelime × log₂(${list.toLocaleString('tr-TR')}) = ${E.formatBits(out.bits)} bit. Kelimeler listeden gerçekten rastgele seçildiyse bu değer kesindir.`;
  }

  out.baseBits = out.bits;
  const b = state.breach;
  if (b.status === 'found' && b.forPassword === password) {
    const capped = E.breachBits(b.count);
    if (capped < out.bits) {
      out.bits = capped;
      out.breached = true;
      out.explain = `Parola sızıntı kayıtlarında ${b.count.toLocaleString('tr-TR')} kez geçiyor. Saldırganlar bu listeleri ilk sırada dener; değer ${E.formatBits(out.baseBits)} bitten ${E.formatBits(capped)} bite düşürüldü.`;
    }
  }
  return out;
}

// ---------- Çizim ----------
function renderStrata(segments) {
  const box = $('strata');
  box.textContent = '';
  if (!segments) return;
  for (const s of segments) {
    const seg = el('div', `seg k-${s.kind}`);
    seg.style.flexGrow = String(Math.max(1, s.bits));
    seg.title = `${s.label}: ${E.formatBits(s.bits)} bit`;
    seg.append(el('span', 'seg-text', mask(s.text)));
    box.append(seg);
  }
}

function renderTable(r) {
  const body = $('parts-body');
  body.textContent = '';
  for (const s of r.segments) {
    const tr = el('tr');
    tr.append(el('td', 'mono part', mask(s.text)));
    const what = el('td');
    what.append(el('span', `swatch k-${s.kind}`), document.createTextNode(s.label));
    tr.append(what);
    tr.append(el('td', 'num', E.formatBits(s.bits)));
    body.append(tr);
  }
  let note = '';
  if (r.breached) {
    note = 'Parola sızıntı kayıtlarında geçtiği için sonucu parçalar değil sızıntı sayısı belirliyor.';
  } else if (r.mode === 'human' && r.segments.length > 1) {
    note = 'Katkıların toplamı sonuca tam eşit olmaz; parça sayısı arttıkça ek çarpan uygulanır.';
  } else if (r.mode !== 'human') {
    note = `Aynı parola için desen tahmini ${E.formatBits(r.pattern.bits)} bit. Rastgele parolalarda bu tahmin gerçeğin altında kalır; bilgi amaçlıdır.`;
  }
  $('parts-note').textContent = note;
}

function renderScenarios(bits) {
  const body = $('times-body');
  body.textContent = '';
  for (const sc of E.SCENARIOS) {
    const tr = el('tr');
    const what = el('td', '', sc.label);
    what.append(el('div', 'small muted', sc.rateText));
    tr.append(what, el('td', 'num strong', E.formatDuration(E.crackSeconds(bits, sc.rate))));
    body.append(tr);
  }
}

function renderBreach() {
  const b = state.breach;
  const box = $('breach-status');
  const btn = $('breach-btn');
  box.className = `breach-status s-${b.status}`;
  btn.disabled = !pw.value || b.status === 'loading';
  btn.textContent = b.status === 'error' ? 'Yeniden ara' : 'Sızıntı kayıtlarında ara';
  switch (b.status) {
    case 'loading': box.textContent = 'Aranıyor…'; break;
    case 'found': box.textContent = `Bulundu: bu parola sızıntı kayıtlarında ${b.count.toLocaleString('tr-TR')} kez geçiyor. Kullanmayın.`; break;
    case 'clean': box.textContent = 'Bulunamadı: bu parola bilinen sızıntı kayıtlarında geçmiyor.'; break;
    case 'error': box.textContent = 'Arama yapılamadı: bağlantı yok ya da istek engellendi. Sonuç sızıntı kontrolü yapılmadan gösteriliyor.'; break;
    default: box.textContent = 'Henüz aranmadı. Ararsanız parolanın SHA-1 özetinin yalnızca ilk 5 karakteri api.pwnedpasswords.com adresine gönderilir; parolanın kendisi gönderilmez.';
  }
}

function render() {
  const password = pw.value;
  if (state.breach.forPassword !== null && state.breach.forPassword !== password) {
    state.breach = { status: 'idle', count: 0, forPassword: null };
    state.token++;
  }
  $('opts-chars').hidden = mode() !== 'chars';
  $('opts-words').hidden = mode() !== 'words';

  const r = compute();
  const result = $('result');
  const has = !!(r && r.bits !== undefined);
  result.classList.toggle('empty', !has);
  $('details-block').hidden = !has;

  const warn = $('warnings');
  warn.textContent = '';
  if (!r) {
    $('bits').textContent = '';
    $('verdict').textContent = '';
    $('guesses').textContent = '';
    $('explain').textContent = 'Bir parola yazın. Parçalarına ayrılmış hâli ve tahmini gücü burada görünür.';
    renderStrata(null);
  } else if (r.needsInput) {
    $('bits').textContent = '';
    $('verdict').textContent = '';
    $('guesses').textContent = '';
    $('explain').textContent = r.needsInput;
    renderStrata(null);
  } else {
    $('bits').textContent = `${E.formatBits(r.bits)} bit`;
    const v = $('verdict');
    v.textContent = E.verdict(r.bits);
    v.className = `verdict v-${Math.min(4, [28, 40, 60, 80].filter((t) => r.bits >= t).length)}`;
    const g = approxGuesses(r.bits);
    const gEl = $('guesses');
    gEl.textContent = '';
    if (g.text) gEl.textContent = g.text;
    else gEl.append(g.mant === 1 ? 'yaklaşık 10' : `yaklaşık ${g.mant} × 10`, el('sup', '', String(g.exp)), ' deneme');
    $('explain').textContent = r.explain;
    for (const w of r.warnings) warn.append(el('p', 'warning', w));
    renderStrata(r.breached ? [{ text: r.password, bits: r.bits, kind: 'leaked', label: 'Sızmış parola' }] : r.segments);
    renderTable(r);
    renderScenarios(r.bits);
  }
  renderBreach();
}

// ---------- Olaylar ----------
let timer = null;
const schedule = () => { clearTimeout(timer); timer = setTimeout(render, 120); };
pw.addEventListener('input', schedule);
for (const id of ['personal', 'pool', 'words', 'listsize']) $(id).addEventListener('input', schedule);
for (const radio of document.querySelectorAll('input[name="mode"]')) radio.addEventListener('change', render);

$('toggle').addEventListener('click', () => {
  state.hidden = !state.hidden;
  pw.type = state.hidden ? 'password' : 'text';
  $('toggle').textContent = state.hidden ? 'Göster' : 'Gizle';
  $('toggle').setAttribute('aria-pressed', String(!state.hidden));
  render();
});

$('breach-btn').addEventListener('click', async () => {
  const password = pw.value;
  if (!password) return;
  const token = ++state.token;
  state.breach = { status: 'loading', count: 0, forPassword: password };
  renderBreach();
  let next;
  try {
    const count = await E.hibpCount(password, (url, opts) => fetch(url, opts));
    next = { status: count > 0 ? 'found' : 'clean', count, forPassword: password };
  } catch {
    next = { status: 'error', count: 0, forPassword: password };
  }
  if (token !== state.token) return; // parola bu arada değişti
  state.breach = next;
  render();
});

// Sözlükleri ilk boyamadan sonra hazırla
const v = __VERSIONS__;
$('versions').textContent = `Parola ölçer ${v.app}. zxcvbn-ts ${v.core}; sözlükler: ortak ${v.common}, İngilizce ${v.en}, Türkçe ${v.tr}. Derleme: ${v.built}${v.commit ? `, ${v.commit}` : ''}. `;
if (v.repo) {
  const a = el('a', '', 'Kaynak kod');
  a.href = v.repo;
  a.rel = 'noopener noreferrer';
  $('versions').append(a);
}
render();
setTimeout(() => {
  E.init();
  $('loading').hidden = true;
  pw.focus();
}, 0);
