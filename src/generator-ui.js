// Parola oluşturucu sekmesi ve sekmeler arası geçiş.
import * as E from './engine.js';
import * as G from './generator.js';

const $ = (id) => document.getElementById(id);
const SUGGESTIONS = 6;

// ---------- Sekmeler ----------
const tabs = [$('tab-meter'), $('tab-gen')];
function selectTab(tab, { focus = false } = {}) {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    $(t.getAttribute('aria-controls')).hidden = !on;
  }
  if (focus) tab.focus();
  // Sekme adres çubuğunda görünsün ki bağlantı olarak paylaşılabilsin (#olustur).
  try { history.replaceState(null, '', tab.id === 'tab-gen' ? '#olustur' : location.pathname + location.search); } catch { /* file:// vb. */ }
  if (tab.id === 'tab-gen' && !$('gen-pw').textContent) regenerate();
}
for (const t of tabs) {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', (ev) => {
    const k = tabs.indexOf(t);
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
      ev.preventDefault();
      selectTab(tabs[(k + (ev.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], { focus: true });
    }
  });
}

// ---------- Seçenekler ----------
const kind = () => document.querySelector('input[name="gen-kind"]:checked').value;
function options() {
  if (kind() === 'chars') {
    return { kind: 'chars', length: Number($('gen-len').value), upper: $('gen-upper').checked, digits: $('gen-num').checked, symbols: $('gen-sym').checked };
  }
  return { kind: 'words', words: Number($('gen-words').value), list: $('gen-list').value, capitalize: $('gen-cap').checked, digits: $('gen-digit').checked, separator: $('gen-sep').value };
}

// ---------- Kopyalama ----------
async function copyText(text, button) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    // Eski tarayıcılar ya da izin verilmeyen durumlar için seçip kopyalama
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
  }
  const label = button.dataset.label || (button.dataset.label = button.textContent);
  button.textContent = ok ? 'Kopyalandı' : 'Kopyalanamadı';
  button.classList.toggle('copied', ok);
  clearTimeout(button._t);
  button._t = setTimeout(() => { button.textContent = label; button.classList.remove('copied'); }, 1500);
}

// ---------- Çizim ----------
const fast = E.SCENARIOS.find((s) => s.id === 'fast');
function renderMeta(bits) {
  const box = $('gen-meta');
  box.textContent = '';
  const b = document.createElement('span');
  b.className = 'bits';
  b.textContent = `${E.formatBits(bits)} bit`;
  const v = document.createElement('span');
  v.className = `verdict v-${Math.min(4, [28, 40, 60, 80].filter((t) => bits >= t).length)}`;
  v.textContent = E.verdict(bits);
  const t = document.createElement('span');
  t.className = 'muted';
  t.textContent = `Hızlı özetle saklanan bir veritabanı çalınsa bile kırılması: ${E.formatDuration(E.crackSeconds(bits, fast.rate))}`;
  box.append(b, v, t);
}

let current = null;
function show(result) {
  current = result;
  $('gen-pw').textContent = result.password;
  renderMeta(result.bits);
}

function regenerate() {
  const opts = options();
  $('gen-opts-words').hidden = opts.kind !== 'words';
  $('gen-opts-chars').hidden = opts.kind !== 'chars';
  $('gen-words-val').textContent = $('gen-words').value;
  $('gen-len-val').textContent = $('gen-len').value;
  show(G.generate(opts));
  const list = $('gen-suggestions');
  list.textContent = '';
  for (let i = 0; i < SUGGESTIONS; i++) {
    const r = G.generate(opts);
    const li = document.createElement('li');
    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'pw';
    pick.textContent = r.password;
    pick.title = 'Bu parolayı seç';
    pick.addEventListener('click', () => show(r));
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'copy';
    copy.textContent = 'Kopyala';
    copy.setAttribute('aria-label', `Kopyala: ${r.password}`);
    copy.addEventListener('click', () => copyText(r.password, copy));
    li.append(pick, copy);
    list.append(li);
  }
}

$('gen-new').addEventListener('click', regenerate);
$('gen-copy').addEventListener('click', () => current && copyText(current.password, $('gen-copy')));
for (const el of document.querySelectorAll('input[name="gen-kind"], #gen-words, #gen-list, #gen-sep, #gen-cap, #gen-digit, #gen-len, #gen-upper, #gen-num, #gen-sym')) {
  el.addEventListener(el.type === 'range' ? 'input' : 'change', regenerate);
}

if (location.hash === '#olustur') selectTab($('tab-gen'));
