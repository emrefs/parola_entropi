# parola_entropi

Bir parolanın tahmin edilmesi için kaç deneme gerektiğini hesaplayan, tek dosyalık bir
araç. Hesap tamamen tarayıcıda yapılır; Türkçe kelimeleri, Türkçe klavye desenlerini ve
yerel kalıpları tanır.

**Canlı sürüm:** https://emrefs.github.io/parola_entropi/

**Çevrimdışı kullanım:** https://emrefs.github.io/parola_entropi/parola_entropi.html
dosyasını indirip tarayıcıda açın. Dosya kendi kendine yeter; kurulum gerekmez.

## Ne yapar

- **Desen analizi.** [zxcvbn-ts](https://github.com/zxcvbn-ts/zxcvbn) ile parolayı sözlük
  kelimeleri, tarihler, tekrarlar, ardışık diziler ve klavye desenlerine ayırır; hangi
  parçanın ne olarak tanındığını ve kaç bit kattığını gösterir.
- **Türkçe.** Hazır Türkçe sözlük paketine ek olarak Türkçe karaktersiz yazımları
  ("sifre", "gunes"), büyük İ/I harflerini, Türkçe Q ve F klavye düzenlerini, il ve plaka
  kodu, kulüp ve kuruluş yılı, millî günler gibi yerel kalıpları tanır.
- **Rastgele parolalar.** Parola bir üreteçten çıktıysa zxcvbn tahmini yerine
  `uzunluk × log₂(havuz)` ya da `kelime sayısı × log₂(liste boyutu)` formülünü kullanır.
- **Sızıntı kontrolü.** İsteğe bağlıdır; [Have I Been Pwned](https://haveibeenpwned.com/Passwords)
  kayıtlarında arar ve parola sızmışsa değeri düşürür.
- **Kişisel bilgiler.** Ad, doğum yılı gibi kelimeler verilirse parolada geçenleri
  tahmin edilmiş sayar.

## Gizlilik ve ağ davranışı

- Parola hiçbir yere gönderilmez ve saklanmaz (çerez, localStorage vb. kullanılmaz).
- Sayfada analitik ya da üçüncü taraf betik yoktur; her şey tek HTML dosyasının içindedir.
- Sayfanın içerik güvenlik ilkesi (CSP) yalnızca `https://api.pwnedpasswords.com`
  adresine bağlantıya izin verir. Bu istek yalnızca "Sızıntı kayıtlarında ara" düğmesine
  basınca yapılır ve parolanın SHA-1 özetinin yalnızca ilk 5 karakterini içerir
  (k-anonimlik).
- Gömülü betiğin SHA-256 özeti CSP'ye yazılır; betik değiştirilirse tarayıcı çalıştırmaz.
- Desen analizi, sayfa donmasın diye bir Web Worker'da yapılır. Worker, gömülü betiğin
  kendisinden yerel bir `blob:` adresiyle üretilir (CSP'de `worker-src blob:`); ağa istek
  yapmaz. Worker açılamayan tarayıcılarda analiz sayfanın kendisinde yapılır.
- GitHub Actions ile derlenen sürümün altbilgisinde, sayfanın üretildiği commit görünür.

## Sınırlar

- "Kendim seçtim" seçeneğindeki değer bir tahmindir. Zayıf parolaları yakalamakta
  güvenilirdir; yüksek bir sonuç parolanın güçlü olduğunu kanıtlamaz.
- `src/tr-extra.js` içindeki listeler elle derlenmiştir; sızıntı verisinden ölçülmüş
  sıklıklara dayanmaz, sıralamaları yaklaşıktır.
- zxcvbn modelinde parça sayısına bağlı bir alt sınır vardır: üç parçalı bir parola,
  parçaların hepsi tanınsa bile yaklaşık 27 bitin altına inmez.
- Sızıntı cezası, sızıntı sayısından sıra tahmini yapan kaba bir modeldir.
- Kırılma süreleri mertebe düzeyindedir.

## Geliştirme

Node.js 22 ile test edilmiştir.

    npm ci
    npm test             # birim testleri
    npm run build        # dist/index.html ve dist/parola_entropi.html üretir
    npm run e2e          # tarayıcı testleri; önce: pip install playwright && playwright install chromium

| Dosya | İçerik |
|---|---|
| `src/engine.js` | Hesaplama çekirdeği: zxcvbn-ts kurulumu, rastgele parola formülü, SHA-1, sızıntı araması ve cezası |
| `src/keyboards.js` | Türkçe Q ve F klavye komşuluk tabloları ve üreteci |
| `src/tr-extra.js` | Elle derlenmiş Türkçe ek sözlükler |
| `src/ui.js`, `src/template.html` | Arayüz, sayfa iskeleti ve stiller |
| `src/main.js`, `src/analyzer.js` | Giriş noktası; desen analizini Web Worker'da çalıştırır, Worker yoksa sayfada |
| `build.mjs` | Her şeyi tek HTML dosyasında birleştirir, CSP özetini ve lisans bildirimlerini yazar |
| `tests/` | Birim testleri (`test.mjs`) ve tarayıcı testleri (`e2e.py`) |

### Kendi kelimelerinizi eklemek

`src/tr-extra.js` içindeki listelere küçük harfle ve Türkçe karakterlerle giriş ekleyin.
Türkçe karaktersiz yazımlar otomatik üretilir. Listeler "en olası önce" sıralıdır; sıra,
tahmin sayısı olarak kullanılır. Sonra `npm test && npm run build` çalıştırın.

## Yayınlama

`main` dalına yapılan her gönderimde `.github/workflows/pages.yml` testleri çalıştırır,
sayfayı derler ve GitHub Pages'e yayınlar. Bunun için depo ayarlarında
**Settings → Pages → Build and deployment → Source** değeri **GitHub Actions** olmalıdır.

## Kaynaklar

- D. L. Wheeler, [zxcvbn: Low-Budget Password Strength Estimation](https://www.usenix.org/conference/usenixsecurity16/technical-sessions/presentation/wheeler), USENIX Security 2016.
- [zxcvbn-ts](https://github.com/zxcvbn-ts/zxcvbn) ve dil paketleri (MIT). Sözlük verilerinin
  kaynak ve lisans bildirimleri sayfanın altındaki "Açık kaynak bildirimleri" bölümünde ve
  derleme çıktısındaki `THIRD_PARTY_NOTICES.txt` dosyasında yer alır.
- Sızıntı araması: [Pwned Passwords](https://haveibeenpwned.com/API/v3#PwnedPasswords) aralık API'si.
- Sızıntı cezasındaki Zipf modeli [passwordentropy.com](https://github.com/hoxxep/passwordentropy.com)
  projesinde tarif edilen yaklaşımı izler.

## Lisans

Bu deponun kendi kodu [MIT lisansı](LICENSE) ile yayınlanır. Derlenen sayfaya paketlenen
üçüncü taraf yazılım ve sözlük verileri kendi lisans ve atıf koşullarını korur; bunlar
sayfanın altındaki "Açık kaynak bildirimleri" bölümünde listelenir.
