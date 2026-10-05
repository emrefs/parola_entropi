// npm run e2e: Windows'ta "python3" komutu yoktur, diğer sistemlerde "python" olmayabilir.
import { spawnSync } from 'node:child_process';

const python = process.platform === 'win32' ? 'python' : 'python3';
const r = spawnSync(python, ['tests/e2e.py'], { stdio: 'inherit' });
if (r.error) {
  console.error(`${python} çalıştırılamadı: ${r.error.message}`);
  process.exit(1);
}
process.exit(r.status ?? 1);
