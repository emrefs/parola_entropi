import hashlib, os, re, sys
from playwright.sync_api import sync_playwright
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / "dist" / "index.html").as_uri()
# Ekran görüntüsü almak için: SHOTS=shots python3 tests/e2e.py
SHOTS = os.environ.get("SHOTS")
def shot(page, name):
    if SHOTS:
        pathlib.Path(SHOTS).mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(pathlib.Path(SHOTS) / name), full_page=True)
fails = []
def check(name, cond, extra=""):
    print(("OK   " if cond else "FAIL ") + name + (" | " + str(extra) if extra else ""))
    if not cond: fails.append(name)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 900, "height": 1100}, locale="tr-TR", permissions=["clipboard-read", "clipboard-write"])
    pg = ctx.new_page()
    logs, reqs = [], []
    pg.on("console", lambda m: logs.append(f"{m.type}: {m.text}"))
    pg.on("pageerror", lambda e: logs.append(f"pageerror: {e}"))
    pg.on("request", lambda r: reqs.append(r.url))
    pg.goto(URL); pg.wait_for_selector("#loading", state="hidden")
    t = lambda sel: pg.inner_text(sel).strip()
    # Desen analizi Worker'da eşzamansız yapılır; yazdıktan sonra sonucun gelmesini bekle.
    idle = lambda page: page.wait_for_selector("#result:not([aria-busy=true])", state="attached")
    def typ(v):
        pg.fill("#pw", v); pg.wait_for_timeout(220); idle(pg)

    check("analiz Web Worker'da", pg.evaluate("document.documentElement.dataset.analyzer") == "worker", pg.evaluate("document.documentElement.dataset.analyzer"))
    check("boş durum metni", "Bir parola yazın" in t("#explain"))
    check("ara düğmesi boşken kapalı", pg.is_disabled("#breach-btn"))

    typ("kalemdefter")
    check("kalemdefter = 26,9 bit", t("#bits") == "26,9 bit", t("#bits"))
    check("etiket Çok zayıf", t("#verdict") == "Çok zayıf")
    check("gizliyken kesitte nokta", t("#strata").replace("\n","") == "•"*11, t("#strata"))
    check("deneme sayısı metni", t("#guesses").replace("\n","") == "yaklaşık 108 deneme", t("#guesses"))
    check("iki parça", pg.locator("#parts-body tr").count() == 2)
    pg.click("#toggle")
    check("gösterince kesitte metin", "kalem" in t("#strata") and "defter" in t("#strata"))
    check("tablo etiketleri", t("#parts-body").count("Türkçe kelime") == 2, t("#parts-body"))
    typ("fgğıodrnhp"); check("F klavye deseni tanınıyor", "Klavye deseni (Türkçe F)" in t("#parts-body"), t("#bits") + " " + t("#parts-body"))
    typ("asdfghjklşi"); check("Q klavye deseni tanınıyor", "Klavye deseni (Türkçe Q)" in t("#parts-body"), t("#bits"))
    typ("ankara06"); check("il ve plaka tanınıyor", "İl ve plaka kodu" in t("#parts-body") and t("#guesses") == "yaklaşık 4 deneme", t("#bits") + " " + t("#guesses"))
    typ("Galatasaray1905"); check("kulüp ve yıl tanınıyor", "Kulüp ve yıl" in t("#parts-body"), t("#bits"))
    typ("kalemdefter")
    check("süre tablosu 3 satır", pg.locator("#times-body tr").count() == 3, t("#times-body"))
    shot(pg, "shot-human.png")

    typ("İSTANBUL34"); check("İ harfi işleniyor", float(t("#bits").split()[0].replace(",", ".")) < 8, t("#bits"))
    typ("<img src=x onerror=alert(1)>"); check("HTML enjeksiyonu yok", pg.locator("#strata img, #parts-body img").count() == 0)

    # rastgele karakter kipi
    typ("kV9#tLq2@Wz7!mRd"); pg.check("input[name=mode][value=chars]"); pg.wait_for_timeout(100)
    check("rastgele 16 kr = 104,9 bit", t("#bits") == "104,9 bit", t("#bits"))
    check("havuz ipucu 94", "Otomatik: 94" in t("#pool-hint"), t("#pool-hint"))
    check("büyük deneme sayısı biçimi", t("#guesses").replace("\n","") == "yaklaşık 4 × 1031 deneme", t("#guesses"))
    check("etiket Çok güçlü", t("#verdict") == "Çok güçlü")
    check("uyarı yok", t("#warnings") == "")
    shot(pg, "shot-chars.png")
    pg.fill("#pool", "62"); pg.wait_for_timeout(220)
    check("elle havuz 62 = 95,3 bit", t("#bits") == "95,3 bit", t("#bits"))
    pg.fill("#pool", "")
    typ("Password1!"); check("desenli uyarısı", "rastgele görünmüyor" in t("#warnings"), t("#warnings")[:60])
    typ("3f9a1c7e5b2d8f40a6c1e9b7d3f5a2c8"); check("hex = 128,0 bit", t("#bits") == "128,0 bit", t("#bits"))
    typ("şğüöçı"); check("ASCII dışı: havuz istenir", "Havuz boyutunu girin" in t("#explain"), t("#explain"))

    # rastgele kelime kipi
    pg.check("input[name=mode][value=words]"); typ("correct-horse-battery-staple")
    check("4 kelime x 7776 = 51,7 bit", t("#bits") == "51,7 bit", t("#bits"))
    typ("axlesalludedturkeysecond"); check("ayraçsız: sayı istenir", "Kelime sayısını girin" in t("#explain"))
    pg.fill("#words", "4"); pg.fill("#listsize", "17576"); pg.wait_for_timeout(220)
    check("4 x 17576 = 56,4 bit", t("#bits") == "56,4 bit", t("#bits"))

    # kişisel bilgi
    pg.check("input[name=mode][value=human]"); typ("korkutalp"); before = t("#bits")
    pg.click("summary >> text=Kişisel"); pg.fill("#personal", "Korkutalp, 1990"); pg.wait_for_timeout(220); idle(pg)
    check("kişisel bilgi değeri düşürür", t("#bits") != before and "Kişisel bilgi" in t("#parts-body"), f"{before} -> {t('#bits')}")
    typ("zirvex1990"); pg.fill("#personal", "ZİRVEX"); pg.wait_for_timeout(220); idle(pg)
    check("kişisel bilgide Türkçe İ", "Kişisel bilgi" in t("#parts-body"), t("#parts-body"))
    pg.fill("#personal", ""); pg.wait_for_timeout(220); idle(pg)

    # Uzun parola: analiz sürerken sayfa donmamalı, sonuç doğru parolaya ait olmalı
    long_pw = "kV9#tLq2@Wz7!mRd" * 6
    gap = pg.evaluate("""(pw) => new Promise((done) => {
        const el = document.getElementById('pw');
        el.value = pw; el.dispatchEvent(new Event('input'));
        let last = performance.now(), worst = 0;
        const tick = () => {
            const now = performance.now(); worst = Math.max(worst, now - last); last = now;
            if (document.getElementById('result').getAttribute('aria-busy') === 'true' || now - start < 400) setTimeout(tick, 10);
            else done(Math.round(worst));
        };
        const start = performance.now(); setTimeout(tick, 10);
    })""", long_pw)
    check("96 karakterlik parolada sayfa donmuyor", gap < 150, f"en uzun bekleme {gap} ms")
    check("uzun parolada sonuç yeni parolaya ait", t("#parts-body") != "" and pg.locator("#strata .seg").count() >= 1)
    # Hızlı yazma: ara değerler atlanabilir ama son sonuç son parolaya ait olmalı
    for k in range(1, 12): pg.fill("#pw", "kalemdefter"[:k])
    pg.wait_for_timeout(220); idle(pg)
    check("hızlı yazmada son sonuç doğru", t("#bits") == "26,9 bit", t("#bits"))

    # parola oluşturucu
    check("oluşturucu sekmesi başta gizli", pg.is_hidden("#panel-gen") and pg.is_visible("#panel-meter"))
    pg.click("#tab-gen")
    check("sekme geçişi", pg.is_visible("#panel-gen") and pg.is_hidden("#panel-meter") and pg.get_attribute("#tab-gen", "aria-selected") == "true")
    first = t("#gen-pw")
    check("akılda kalır parola biçimi", bool(re.fullmatch(r"[A-Z][a-z]{3,7}\d(-[A-Z][a-z]{3,7}\d){4}", first)), first)
    check("entropi ve etiket", t("#gen-meta").startswith("71,6 bit") and "Güçlü" in t("#gen-meta"), t("#gen-meta"))
    check("6 öneri", pg.locator("#gen-suggestions li").count() == 6)
    pg.click("#gen-new"); check("yenile yeni parola üretir", t("#gen-pw") != first)
    pg.fill("#gen-words", "4"); pg.dispatch_event("#gen-words", "input")
    check("kelime sayısı 4", len(t("#gen-pw").split("-")) == 4 and t("#gen-words-val") == "4", t("#gen-pw"))
    pg.select_option("#gen-list", "en"); pg.select_option("#gen-sep", "space"); pg.uncheck("#gen-digit")
    check("İngilizce, boşluklu, rakamsız: 51,7 bit", bool(re.fullmatch(r"[A-Z][a-z]+( [A-Z][a-z]+){3}", t("#gen-pw"))) and t("#gen-meta").startswith("51,7 bit"), t("#gen-pw") + " | " + t("#gen-meta"))
    pg.check("input[name=gen-kind][value=chars]")
    check("rastgele karakter 20", len(t("#gen-pw")) == 20 and pg.is_hidden("#gen-opts-words"), t("#gen-pw"))
    pg.fill("#gen-len", "32"); pg.dispatch_event("#gen-len", "input"); pg.uncheck("#gen-sym")
    check("32 karakter, simgesiz", bool(re.fullmatch(r"[A-Za-z0-9]{32}", t("#gen-pw"))), t("#gen-pw"))
    sug = pg.locator("#gen-suggestions .pw").first.inner_text(); pg.locator("#gen-suggestions .pw").first.click()
    check("öneri seçilince ana parola olur", t("#gen-pw") == sug)
    pg.click("#gen-copy"); pg.wait_for_timeout(100)
    clip = pg.evaluate("navigator.clipboard.readText().catch(() => null)")
    check("kopyala panoya yazar", clip == sug and t("#gen-copy") == "Kopyalandı", clip)
    check("adres #olustur", pg.evaluate("location.hash") == "#olustur")
    shot(pg, "shot-generator.png")
    pg.focus("#tab-gen"); pg.keyboard.press("ArrowLeft")
    check("ok tuşuyla sekme geçişi", pg.is_visible("#panel-meter") and pg.evaluate("document.activeElement.id") == "tab-meter")
    pg.click("#tab-gen"); pg.click("#tab-meter")
    check("ölçüm sekmesine dönüş", pg.is_visible("#panel-meter") and pg.evaluate("location.hash") == "")
    hp = b.new_context(locale="tr-TR").new_page(); hp.goto(URL + "#olustur"); hp.wait_for_selector("#loading", state="hidden")
    check("#olustur bağlantısı oluşturucuyu açar", hp.is_visible("#panel-gen") and hp.inner_text("#gen-pw").strip() != "")
    hp.context.close()

    # blob: Worker'ın sayfanın kendi betiğinden üretilen yerel adresidir; ağa çıkmaz.
    local = lambda u: u.startswith("file:") or u.startswith("blob:")
    check("şu ana kadar ağ isteği yok", all(local(u) for u in reqs), [u for u in reqs if not local(u)])

    # HIBP: sahte yanıt
    typ("Tr0ub4dor&3"); base = t("#bits")
    h = hashlib.sha1(b"Tr0ub4dor&3").hexdigest().upper()
    seen = {}
    def found(route):
        seen["url"] = route.request.url; seen["hdr"] = route.request.headers.get("add-padding")
        route.fulfill(status=200, headers={"access-control-allow-origin": "*"}, body=f"0000000000000000000000000000000000A:0\r\n{h[5:]}:3196\r\n")
    def preflight(route):
        if route.request.method == "OPTIONS":
            route.fulfill(status=204, headers={"access-control-allow-origin": "*", "access-control-allow-headers": "add-padding"})
        else: found(route)
    pg.route("https://api.pwnedpasswords.com/**", preflight)
    pg.click("#breach-btn"); pg.wait_for_selector(".s-found")
    check("istek yalnızca 5 karakterlik önek", seen.get("url") == "https://api.pwnedpasswords.com/range/" + h[:5], seen)
    check("3196 kayıt -> 10,6 bit", t("#bits") == "10,6 bit", f"{base} -> {t('#bits')}")
    check("açıklama sızıntıyı söylüyor", "3.196" in t("#explain") and "3.196" in t("#breach-status"), t("#explain"))
    shot(pg, "shot-breach.png")
    typ("Tr0ub4dor&3x"); check("parola değişince sızıntı sonucu sıfırlanır", "Henüz aranmadı" in t("#breach-status") and t("#bits") != "10,6 bit")

    # HIBP: bulunamadı
    pg.click("#breach-btn"); pg.wait_for_selector(".s-clean")
    check("bulunamadı durumu", "Bulunamadı" in t("#breach-status"))

    # HIBP: hata
    pg.unroute("https://api.pwnedpasswords.com/**")
    pg.route("https://api.pwnedpasswords.com/**", lambda r: r.abort())
    typ("baska-parola-1"); pg.click("#breach-btn"); pg.wait_for_selector(".s-error")
    check("hata 'temiz' diye gösterilmiyor", "Arama yapılamadı" in t("#breach-status") and t("#breach-btn") == "Yeniden ara")

    # CSP: başka adrese istek engellenmeli
    r = pg.evaluate("fetch('https://example.com/').then(()=>'izin verildi').catch(()=> 'engellendi')")
    check("CSP başka adresleri engelliyor", r == "engellendi", r)
    check("CSP ihlali konsola yazıldı", any("Content Security Policy" in l and "example.com" in l for l in logs))
    bad = [l for l in logs if ("error" in l.lower()) and "example.com" not in l and "pwnedpasswords" not in l and "ERR_FAILED" not in l]
    check("konsol hatası yok", not bad, bad[:3])
    other = [u for u in reqs if not local(u) and "api.pwnedpasswords.com/range/" not in u and "example.com" not in u]
    check("beklenmeyen ağ isteği yok", not other, other)
    stored = pg.evaluate("[localStorage.length, sessionStorage.length, document.cookie]")
    check("açık kaynak bildirimleri sayfada", "OpenSubtitles" in pg.text_content("#notices") and "Dropbox" in pg.text_content("#notices") and pg.text_content("#notices").lstrip("=\n").startswith("parola_entropi") and "MIT License" in pg.text_content("#notices"))
    check("hiçbir şey saklanmıyor", stored == [0, 0, ""], stored)

    # koyu tema ve mobil
    d = b.new_context(viewport={"width": 390, "height": 900}, color_scheme="dark", locale="tr-TR").new_page()
    d.goto(URL); d.wait_for_selector("#loading", state="hidden"); d.fill("#pw", "mehmetyilmaz1985"); d.click("#toggle"); d.wait_for_timeout(250); idle(d)
    w = d.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
    check("mobilde yatay taşma yok", w[0] <= w[1], w)
    shot(d, "shot-mobile-dark.png")

    # Worker kullanılamayan tarayıcı: analiz sayfada yapılmalı, sonuç aynı olmalı
    nw_ctx = b.new_context(locale="tr-TR"); nw_ctx.add_init_script("delete window.Worker")
    nw = nw_ctx.new_page(); nw_logs = []
    nw.on("pageerror", lambda e: nw_logs.append(str(e)))
    nw.goto(URL); nw.wait_for_selector("#loading", state="hidden")
    nw.fill("#pw", "kalemdefter"); nw.wait_for_timeout(220); idle(nw)
    check("Worker yoksa sayfada hesaplanıyor", nw.evaluate("document.documentElement.dataset.analyzer") == "local" and nw.inner_text("#bits").strip() == "26,9 bit", nw.inner_text("#bits"))
    check("Worker yokken sayfa hatası yok", not nw_logs, nw_logs[:2])
    b.close()
print("\nBAŞARISIZ:", fails if fails else "yok")
sys.exit(1 if fails else 0)
