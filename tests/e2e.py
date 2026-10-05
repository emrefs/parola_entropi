import hashlib, os, sys
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
    ctx = b.new_context(viewport={"width": 900, "height": 1100}, locale="tr-TR")
    pg = ctx.new_page()
    logs, reqs = [], []
    pg.on("console", lambda m: logs.append(f"{m.type}: {m.text}"))
    pg.on("pageerror", lambda e: logs.append(f"pageerror: {e}"))
    pg.on("request", lambda r: reqs.append(r.url))
    pg.goto(URL); pg.wait_for_selector("#loading", state="hidden")
    t = lambda sel: pg.inner_text(sel).strip()
    def typ(v):
        pg.fill("#pw", v); pg.wait_for_timeout(220)

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
    typ("kV9#tLq2@Wz7!mRd"); pg.check("input[value=chars]"); pg.wait_for_timeout(100)
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
    pg.check("input[value=words]"); typ("correct-horse-battery-staple")
    check("4 kelime x 7776 = 51,7 bit", t("#bits") == "51,7 bit", t("#bits"))
    typ("axlesalludedturkeysecond"); check("ayraçsız: sayı istenir", "Kelime sayısını girin" in t("#explain"))
    pg.fill("#words", "4"); pg.fill("#listsize", "17576"); pg.wait_for_timeout(220)
    check("4 x 17576 = 56,4 bit", t("#bits") == "56,4 bit", t("#bits"))

    # kişisel bilgi
    pg.check("input[value=human]"); typ("korkutalp"); before = t("#bits")
    pg.click("summary >> text=Kişisel"); pg.fill("#personal", "Korkutalp, 1990"); pg.wait_for_timeout(220)
    check("kişisel bilgi değeri düşürür", t("#bits") != before and "Kişisel bilgi" in t("#parts-body"), f"{before} -> {t('#bits')}")
    pg.fill("#personal", "")

    check("şu ana kadar ağ isteği yok", all(u.startswith("file:") for u in reqs), [u for u in reqs if not u.startswith("file:")])

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
    other = [u for u in reqs if not u.startswith("file:") and "api.pwnedpasswords.com/range/" not in u and "example.com" not in u]
    check("beklenmeyen ağ isteği yok", not other, other)
    stored = pg.evaluate("[localStorage.length, sessionStorage.length, document.cookie]")
    check("açık kaynak bildirimleri sayfada", "OpenSubtitles" in pg.text_content("#notices") and "Dropbox" in pg.text_content("#notices") and pg.text_content("#notices").lstrip("=\n").startswith("parola-entropi") and "MIT License" in pg.text_content("#notices"))
    check("hiçbir şey saklanmıyor", stored == [0, 0, ""], stored)

    # koyu tema ve mobil
    d = b.new_context(viewport={"width": 390, "height": 900}, color_scheme="dark", locale="tr-TR").new_page()
    d.goto(URL); d.wait_for_selector("#loading", state="hidden"); d.fill("#pw", "mehmetyilmaz1985"); d.click("#toggle"); d.wait_for_timeout(250)
    w = d.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
    check("mobilde yatay taşma yok", w[0] <= w[1], w)
    shot(d, "shot-mobile-dark.png")
    b.close()
print("\nBAŞARISIZ:", fails if fails else "yok")
sys.exit(1 if fails else 0)
