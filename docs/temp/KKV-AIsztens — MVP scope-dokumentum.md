# **KKV-AIsztens — MVP scope-dokumentum**

## **1\. Az MVP egy mondatban**

Egyetlen pilot-ügyfélnek működő **email-modul**: a postaládáját osztályozza, összefoglalót küld Telegramon/Slacken, válasz-tervezetet ír, és csak az ügyfél explicit jóváhagyása után küld ki bármit a nevében. A számla-modul, a naptár és minden más a katalógusból **ebben a körben NEM épül meg** — az MVP kizárólag az email-oldal.

## **2\. Mi van benne az MVP-ben**

> * Onboarding-réteg: postafiók bekötése unified email API-n (Unipile vagy Nylas) keresztül \+ Telegram/Slack-bot regisztráció  
> * Digest-generátor: időzítve végignézi az új leveleket, kategorizál, összefoglalót küld  
> * Tool-use agent 5 konkrét képességgel (lásd 5\. pont táblázat)  
> * Stílus-profil generálás (az ügyfél kb. 20-50 korábbi kiküldött leveléből, hogy a válasz-tervezetek a saját hangvételét kövessék)  
> * Jóváhagyási kapu: kiküldés csak explicit "OK, küldd ki" után  
> * Naplózás alapréteg: minden tool-hívás strukturáltan naplózva — ezt tudatosan MOST, az elején építjük be, nem a végén, mert utólag sokkal macerásabb  
> * Tenant-izolációs séma: már úgy épül, hogy 1 ügyfélről bővíthető legyen többre, anélkül hogy újra kéne írni

## **2.1 Mi végzi ténylegesen a munkát — technológia**

A konkrét API-hívásokat (levél lekérése, levél kiküldése) egy általunk írt, könnyű, determinisztikus kódréteg végzi: egy saját "Unipile-MCP szerver" (Python), ami az MCP protokollon keresztül teszi elérhetővé az öt tool-t (get\_full\_email, send\_reply, stb.) az AI-agent számára. Ez NEM AI — hagyományos, tesztelhető kód, ami a háttérben ténylegesen HTTP-hívásokat intéz a Unipile REST API felé.  
Az AI (egy Claude API "tool use" agent) csak azt dönti el, MELYIK tool-t hívja meg és MIKOR (pl. "ez a levél sürgős, kérjük le a teljeset", "írjunk rá egy udvarias választ") — magát a mechanikus lekérést/küldést nem az AI végzi, hanem a determinisztikus MCP-kód.  
Ezt a vékony MCP-hidat NEKÜNK kell megírnunk — ez az egyetlen igazán új kód-komponens a projektben, minden más (agent-logika, jóváhagyási kapu) a meglévő flotta-mintára épül.  
Üzleti szempontból ez a jó megközelítés: az AI-t csak ott használjuk, ahol tényleg ítélőképesség kell (kategorizálás, stílus, válaszírás) — ez olcsóbb (nem fizetünk LLM-tokent egy egyszerű API-hívásért) és megbízhatóbb (a mechanikus rész determinisztikus kód, nem AI-hallucináció-kockázatos).

## **3\. Mi NINCS benne — explicit kizárva ebből a körből**

> * Számla-modul (bejövő számla OCR, adatkinyerés, könyvelőrendszerbe rögzítés, határidő-figyelés) — teljes egészében a következő fázis  
> * Naptár-mikroszolgáltatás  
> * Központi admin felület — az MVP-nél a "ki-be kapcsolás" annyi, hogy szólunk egymásnak / egy szkriptet futtatunk, nincs admin UI  
> * Dokumentumkeresés  
> * Self-service üzemeltetési mód — az MVP-nél managed modell, mi felügyeljük élesben az egy pilot-ügyfelet  
> * Több unified-API-vendor egyszerre — egyet választunk, azzal indulunk

## **4\. Építési lépések, ebben a sorrendben**

> 1. **Email-osztályozás \+ naplózás alapréteg.** A digest-generátor és a build\_digest/get\_full\_email tool-ok. A naplózást itt, az architektúra alapjaként vezetjük be.  
> 2. **Választervezet \+ jóváhagyás utáni küldés.** draft\_reply és send\_reply tool. Ennek a lépésnek a végén az MVP kész és élesíthető.

## **5\. Az öt agent-tool — pontos definíció**

| Tool | Mit csinál |
| :---- | :---- |
| get\_full\_email(email\_id) | A kiválasztott levél teljes tartalmának lekérése (a digestben csak kivonat van) |
| resummarize(email\_id, detail\_level) | Az összefoglaló újragenerálása más részletességi szinten |
| draft\_reply(email\_id, instructions?) | Válasz-tervezet írása/átírása az ügyfél szöveges instrukciója alapján |
| send\_reply(email\_id, approved\_text) | A végleges szöveg tényleges kiküldése — KIZÁRÓLAG explicit jóváhagyás után |
| build\_digest() | Az időzített összefoglaló-üzenet összeállítása |

Szándékosan ennyi és nem több — nincs fájlrendszer-, kód- vagy más ügyfél-adathoz hozzáférés, ez adja a sebességet és a biztonságot is.

## **6\. Vendor-döntés az MVP-hez**

Egy pilot-ügyfélnél a Unipile-Nylas kérdés nem sorsdöntő — mindkettő megoldja a CASA-audit-mentes OAuth-bekötést. Javaslat: amelyiket könnyebb gyorsan integrálni (jobb dokumentáció/webhook-támogatás), azzal induljunk; a végleges vendor-döntést (ami már a naptár-modulnál számít) a 2\. fázisra érdemes halasztani.

## **7\. Óraszám-becslés (csak az MVP-re)**

\~60-90 óra — a technikai terv szerinti komponensek: onboarding-flow, digest-generátor, saját unified-API-MCP szerver, öt-eszközös ágens, stílus-profil, tenant-izoláció alapréteg. (Az usage-metering és a teljes tenant-skálázás finomítása már a többi ügyfél felvételekor jön, nem az 1\. pilot-ügyfélnél kritikus.)

## **8\. Sikerkritérium — mikor mondjuk, hogy kész az MVP**

> * 1 pilot-ügyfél postafiókja élesben be van kötve  
> * a napi/időzített digest megbízhatóan megérkezik Telegramra/Slackre  
> * a pilot-ügyfél tud kérni részletesebb infót, tervezetet írni/átíratni, és jóváhagyással kiküldeni egy választ — végig a beszélgetős felületen  
> * nulla olyan eset, hogy bármi jóváhagyás nélkül kiment volna  
> * a stílus-profil alapján írt tervezetek a pilot-ügyfél szerint "rá hasonlítanak" hangvételben

## **9\. Mi jön az MVP után (csak jelzésként, nem részletezve itt)**

Számla-modul (a "bemutató" doksi 5.2 pontja szerint), központi admin Fázis 2, naptár-mikroszolgáltatás, dokumentumkeresés, majd további ügyfelek felvétele és a self-service opció kidolgozása.