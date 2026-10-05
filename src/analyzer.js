// Desen analizi uzun parolalarda saniyeler sürebilir (64 karakterde ~1 sn); sayfa donmasın diye
// Web Worker'da yapılır. Worker, sayfadaki betiğin kendi metninden bir blob olarak üretilir:
// ayrı dosya gerekmez, çalışan kod CSP özetiyle doğrulanmış kodun aynısıdır.
import * as E from './engine.js';

// Worker tarafı
export function workerMain() {
  self.onmessage = ({ data }) => {
    let reply;
    try {
      reply = { id: data.id, result: E.patternAnalysis(data.password, data.personal) };
    } catch (err) {
      reply = { id: data.id, error: String((err && err.message) || err) };
    }
    self.postMessage(reply);
  };
  E.init();
  self.postMessage({ ready: true });
}

// Sayfa tarafı. Bu satır betik ilk çalışırken değerlendirilmeli: currentScript sonradan null olur.
const selfSource = typeof document !== 'undefined' && document.currentScript ? document.currentScript.textContent : '';

// onReady: sözlükler hazır olduğunda bir kez çağrılır (Worker'da ya da sayfada).
// Worker kullanılamıyorsa (eski tarayıcı, engellenmiş blob) analiz sayfada yapılır.
export function createAnalyzer(onReady) {
  let worker = null;
  let ready = false;
  let nextId = 0;
  const waiting = new Map();
  const markReady = () => {
    if (ready) return;
    ready = true;
    onReady();
  };
  const local = (password, personal) => {
    E.init();
    return E.patternAnalysis(password, personal);
  };
  const runLocally = (job) => {
    try { job.resolve(local(job.password, job.personal)); } catch (err) { job.reject(err); }
  };
  const fallBack = () => {
    if (worker) worker.terminate();
    worker = null;
    api.mode = 'local';
    const jobs = [...waiting.values()];
    waiting.clear();
    E.init();
    markReady();
    jobs.forEach(runLocally);
  };

  const api = {
    mode: 'local',
    analyze(password, personal) {
      return new Promise((resolve, reject) => {
        const job = { password, personal, resolve, reject };
        if (!worker) {
          // Yerel hesap da eşzamansız döner, böylece çağıran taraf iki durumda aynı davranır.
          setTimeout(() => runLocally(job), 0);
          return;
        }
        const id = ++nextId;
        waiting.set(id, job);
        worker.postMessage({ id, password, personal });
      });
    },
  };

  let url = null;
  try {
    if (!selfSource || typeof Worker === 'undefined') throw new Error('Worker yok');
    url = URL.createObjectURL(new Blob([selfSource], { type: 'text/javascript' }));
    worker = new Worker(url);
    api.mode = 'worker';
    worker.onmessage = ({ data }) => {
      if (data.ready) {
        URL.revokeObjectURL(url);
        markReady();
        return;
      }
      const job = waiting.get(data.id);
      if (!job) return;
      waiting.delete(data.id);
      if (data.error) job.reject(new Error(data.error));
      else job.resolve(data.result);
    };
    // Worker başlatılamazsa (CSP, file:// kısıtı, betik hatası) sayfada hesaplamaya geç.
    worker.onerror = (ev) => {
      if (ev && ev.preventDefault) ev.preventDefault();
      if (url) URL.revokeObjectURL(url);
      fallBack();
    };
  } catch {
    if (url) URL.revokeObjectURL(url);
    worker = null;
    setTimeout(fallBack, 0);
  }
  return api;
}
