// Aynı paket iki yerde çalışır: sayfada arayüz, Web Worker içinde desen analizi (bkz. analyzer.js).
import { workerMain } from './analyzer.js';

if (typeof document === 'undefined') workerMain();
else require('./ui.js');
