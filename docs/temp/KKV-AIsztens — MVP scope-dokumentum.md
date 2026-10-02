# **KKV-AIsztens — MVP scope-dokumentum**

## **1\. Az MVP egy mondatban**

Egyetlen pilot-ügyfélnek működő **email-modul**: a postaládáját osztályozza, összefoglalót küld üzenetküldő 
szolgáltatáson keresztül (pl Telegramon/Slacken), válasz-tervezetet ír, és csak az ügyfél explicit jóváhagyása után 
küld ki bármit a nevében. Számla-modul, naptár és hasonlók nincsenek a tervben jelenleg.

## **2\. Mi van benne az MVP-ben**

> * Onboarding: postafiók bekötése unified email API-n keresztül \+ üzenetküldő regisztráció  
> * Digest-generátor: időzítve végignézi az új leveleket, kategorizál, összefoglalót küld
> * Stílus-profil generálás (az ügyfél kb. 20-50 korábbi kiküldött leveléből, hogy a válasz-tervezetek a saját hangvételét kövessék)  
> * Jóváhagyási kapu: kiküldés csak explicit "OK, küldd ki" után  
> * Naplózási réteg: minden tool-hívás strukturáltan naplózva  
> * Tenant-izolációs séma: úgy épül az elejétől kezdve, hogy 1 ügyfélről könnyen bővíthető legyen többre

## **2.1 Mi végzi ténylegesen a munkát — technológia**

A konkrét API-hívásokat (levél lekérése, levél kiküldése) egy általunk írt, könnyű, determinisztikus kódréteg végzi: 
egy saját szerver, ami az AI agynak  teszi elérhetővé az öt tool-t (get full email, send reply, stb.) az AI-agent számára.  
Az AI (egy Claude API "tool use" agent) csak azt dönti el, MELYIK tool-t hívja meg és MIKOR (pl. "ez a levél sürgős, kérjük 
le a teljeset", "írjunk rá egy udvarias választ") — magát a mechanikus lekérést/küldést nem az AI végzi, hanem a mi szolgáltatá szerverünk.

## **3\. Mi NINCS benne — explicit kizárt dolgok ebből a körből**

> * Számla-modul (bejövő számla OCR, adatkinyerés, könyvelőrendszerbe rögzítés, határidő-figyelés) — teljes egészében a következő fázis  
> * Naptár-mikroszolgáltatás  
> * Központi admin felület — az MVP-nél a "ki-be kapcsolás" annyi, hogy szólunk egymásnak / egy szkriptet futtatunk, nincs admin UI  
> * Dokumentumkeresés  
> * Self-service üzemeltetési mód — az MVP-nél managed modell, mi felügyeljük élesben az egy pilot-ügyfelet  
> * Több unified-API-vendor egyszerre — egyet választunk, azzal indulunk

## **9\. Mi jön az MVP után (csak jelzésként, nem részletezve itt)**

Számla-modul (a "bemutató" doksi 5.2 pontja szerint), központi admin Fázis 2, naptár-mikroszolgáltatás, dokumentumkeresés, majd további ügyfelek felvétele és a self-service opció kidolgozása.