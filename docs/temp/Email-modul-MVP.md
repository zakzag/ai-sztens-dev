# KKV-AIsztens Email-modul 

# MVP szolgáltatáslista

Az Email-modul a beérkező leveleket automatikusan besorolja, és csak a sürgős, fontos vagy talán érdekes levelekről küld rövid értesítést a csevegőfelületre (Telegram). Onnan a felhasználó kérdezhet, összefoglalót kérhet, válaszpiszkozatot készíttethet, és megerősítés után el is küldheti. E-mail soha nem megy ki jóváhagyás nélkül. A tulajdonos kivételes esetben (Telegram-kiesés, törlés-visszaigazolás) e-mailt is kap. A dokumentumban a zárójeles D-számok a folyamatábrák döntéseire utalnak (D1–D63).

## **1\. kör — Felhasználói felület (csevegő: Telegram)**

A felhasználó minden napi műveletet a csevegőből végez; webes felületre nincs szüksége.

| ID | Funkció | Részletek |
| :---- | :---- | :---- |
| U1 | **Automatikus besorolás, objektív szabályok szerint** | Öt kategória. **Sürgős** \= időkényszer: a beállított küszöbön belüli határidő (alapból 24 óra, A10), azonnali fizetési felszólítás, aznapi teendő, vagy a felhasználó által sürgősnek jelölt szabály. **Fontos** \= ki küldte vagy miről szól: kiemelt feladó, futó ügy, vagy a felhasználó által fontosnak jelölt feladó/téma, időkényszer nélkül is. **Talán érdekes** \= személyes, releváns levél, amelyre egyik szabály sem illik. **Hírlevél**, **spam**. Sorrend: sürgős → fontos → talán érdekes → hírlevél/spam (D5). |
| U2 | **Kontextusfüggő értékelés** | A besoroláskor a rendszer figyelembe veszi a feladóval és a témában folytatott korábbi levelezést: az aktív levélváltásokat teljes szövegükkel, a régebbieket az összefoglalójuk alapján (lásd az adatmegőrzést). A kontextus csak felminősíthet, leminősíteni nem (D8). |
| U3 | **Szelektív értesítés, indoklással** | Csak a sürgős, a fontos és a talán érdekes levélről megy értesítés; a három szint vizuálisan megkülönböztethető. Minden értesítés egy sorban megmondja, miért kapta a besorolást (pl. „Sürgős: határidő holnap 10:00”, „Fontos: kiemelt ügyfél”). A sürgős levél a csendes órákban is átmegy. Tartós AI-hiba esetén „nyers” értesítés megy: feladó, tárgy, link, „nem sikerült elemezni” (D55). |
| U4 | **Elnémított levelek számlálója** | Minden értesítés alján: hány hírlevél és spam jött az előző értesítés óta. Kérésre a lista is lekérhető (feladó \+ tárgy; alapból az utolsó értesítés óta, D25). Hírlevélről és spamről nem készül AI-összefoglaló (D7). |
| U5 | **Rövid összefoglaló \+ link** | Az értesítésben a levél tömör összefoglalója és közvetlen Gmail-link a teljes levélhez. Az összefoglaló részletessége kategóriánként állítható (A4). |
| U6 | **Határidők és teendők kiemelése** | Az összefoglaló külön sorban jelzi a levélben szereplő határidőt, összeget vagy kérést (pl. „Határidő: okt. 15.”). Ez egyben a sürgős besorolás alapja. |
| U7 | **Gyorsgombok az értesítés alatt** | Egy koppintással: Teljes levél · Rövidebben/Részletesebben · Válasz · Olvasottnak jelöl (D9) · Archiválás · Címkézés · Nem fontos/Fontos/Sürgős. |
| U7b | **Teljes levél megjelenítése** | Kérésre a kiválasztott levél teljes szövege megjelenik a csevegőben. Ha nem fér bele egy Telegram-üzenetbe, csak az eleje \+ Gmail-link (D12). |
| U7c | **Részletesség újragenerálása** | Az összefoglaló kérésre rövidebben vagy részletesebben újraírható. |
| U10 | **Visszajelzés a besorolásra** | „Ez nem fontos” / „Ez fontos” / „Ez sürgős” jelzés után a rendszer megkérdezi, legyen-e ebből tartós szabály a feladóra vagy a témára. Kiemelt feladó leminősítésekor: ha az AI vette fel, lekerül a listáról (D11); ha a felhasználó, a rendszer rákérdez, levegye-e (D22). Az így létrejött szabályok az admin felületen (A5) látszanak, forrás: „visszajelzés” (D47). Ez a gombsor adminból kikapcsolható. |
| U10b | **Szabad szöveges válasz egy értesítésre** | Ha a felhasználó Telegram-válaszként ír egy értesítésre, az az adott levélhez kötődik (D10): válaszlevél kérése → U12; kérdés a levélről → válasz a levél és a kontextus alapján. |
| U11 | **Archiválás, olvasottnak jelölés, címkézés** | A felhasználó a csevegőből rendet tart a postafiókban, a Gmail megnyitása nélkül. Címkézésnél a rendszer visszakérdez, melyik címkéhez rendelje (a Gmail-címkék gombokként). Archiválás után az értesítés „archiválva” jelöléssel megmarad (D13). |
| U12 | **Válaszpiszkozat** | A Válasz gombra a rendszer visszakérdez, mit válaszoljon, 2–3 javasolt iránnyal (D15). A tervezet alatt: Mentés piszkozatként · Módosítás · Küldés · Elvetés. Csak a feladónak válaszol, melléklet nélkül (D19). Mentés vagy küldés után az eredeti levél olvasott lesz (D20). |
| U13 | **Stílus-illesztés** | Ha van stílusprofil a feladóhoz, felajánlja, hogy abban írjon (tegezés/magázás, hossz, hangnem, megszólítás, zárás). Ha nincs, stílusopciókat kínál gombként, egyet „Javasolt” jelöléssel (D17); a választás a feladó profilja lesz, később finomodik (D18). A profil hónapokkal később is megvan, a levelek szövege nélkül. |
| U14 | **Kiküldés csak jóváhagyással** | Levél kizárólag explicit jóváhagyás után megy ki: küldés a csevegőből kétlépcsős megerősítéssel („Biztosan elküldöd X-nek?”) (D21). Nincs automatikus küldés, nincs „Válasz mindenkinek”, nincs melléklet (D19). |
| U15 | **Visszakeresés** | Kérdésre keres a korábbi levelekben, pl. „mikor írt utoljára a Kovács Kft., és miről?”. Csak a tárolt, 90 napos adatokban (D23); 5 találat \+ „Továbbiak” gomb (D24); kétértelmű kérdésnél visszakérdez gombokkal (D27). Témán kívüli kérdésre közepes terjedelmű válasz, visszaterelés a levelezésre (D26). |
| U16 | **Időszakos összesítő** | Reggeli és/vagy esti összesítő (D28): az előző összesítő óta érkezett sürgős, fontos és talán érdekes levelek egy listában, valamint hány hírlevél és spam került félre; ide kerülnek a csendes órákban visszatartott értesítések is. Üres összesítő is kimegy („nem jött fontos levél”, D29). Közeli időpontú összesítők egy üzenetbe vonódnak (alapból 2 órás ablak, konfigurálható; D30, D44). Az elintézetlen tételek jelölve (D31); kategóriánként max. 5 tétel \+ „Továbbiak” (D32). Mellette: csendes órák utáni összesítő a visszatartott fontos és fennakadt sürgős levelekről (D3, D6). |
| U17 | **Beállítások a csevegőből** | Beszélgetésben módosítható minden hétköznapi és kényelmi beállítás: részletesség (A4), besorolási szabályok (A5), stílusprofil (A6), összesítők és időpontjaik (A7), csendes órák (A8), ideiglenes szüneteltetés és visszakapcsolás (A9), sürgősségi küszöb (A10). Minden módosítás előtt megerősítés (régi → új érték, D33), utána visszaigazolás az új állapotról. Ideiglenes szünet: a vége kötelező, legfeljebb 72 óra; 15 perccel lejárat előtt figyelmeztetés meghosszabbítási lehetőséggel (D35, D39). Csak az admin felületen: postafiók bekötése és leválasztása, csatornaváltás, végleges leállítás; ilyen kérésre a csevegő jelez és linket ad (D34). |
| U17b | **Kiemelt feladók és tiltólista a csevegőből** | Kiemelt (VIP) feladó levele mindig fontos, tiltott feladóé mindig elnémítva. Ez adja a „fontos” kategória alapját (U1). Csevegőből bővíthető feladó- és domain-szinten is (D37): „A könyvelőm mindig fontos.” Név alapján a rendszer a levelezésből azonosítja a címet, és megerősítteti (D36). A teljes lista az adminon kezelhető (A11). |

## **1\. kör — Admin felület (a vállalkozás tulajdonosának beállításai)**

Az admin felület webes oldal, böngészőből, Google-fiókos bejelentkezéssel érhető el. Az AIsztens-fiók (ki vagy) és a bekötött postafiók (mit figyelünk) külön entitás: így később egy fiókhoz több postafiók is köthető, és a postafiók leválasztása nem törli a belépést (D45). Itt egyben látszik az összes beállítás és szabály; itt történik a bekötés és minden olyan beállítás, amely a fiók biztonságát vagy a teljes működést érinti.

| ID | Funkció | Részletek |
| :---- | :---- | :---- |
| A1 | **Postafiók bekötése és leválasztása** | **Kizárólag Gmail**; más postafiók-típus nincs az MVP-ben. Előfizetésenként egy postafiók és egy felhasználó (az adatszerkezet már a fiók → postafiókok viszonyra épül, D45). Leválasztáskor a tárolt hozzáférés törlődik; 30 napon belül újrabekötve a beállítások és szabályok visszaállnak (D42); választható az adatok azonnali törlése (D63). |
| A2 | **Csatorna** | Telegram (D1). Párosítás link / QR-kóddal a botra, egyszeri kóddal (D53); újrapárosítás az admin felületen. |
| A3 | **Ellenőrzés** | Az ellenőrzés trigger alapú: minden beérkező levélnél. Az összesítők gyakorisága az A7-ben (D28). |
| A4 | **Részletesség kategóriánként** | Mennyire részletes legyen az összefoglaló a sürgős, a fontos és a talán érdekes levelnél. |
| A5 | **Besorolási szabályok** | A kategóriák definíciói (U1) és minden egyedi szabály egy listában: kiemelt feladók, mindig sürgős témák, mindig elnémított feladók, domain-szabályok. Minden tétel forrás-jelölést kap: AI · felhasználó · visszajelzés (D47). |
| A6 | **Stílusprofil** | Onboardingkor a rendszer javasol egy alap stílusprofilt; a tulajdonos jóváhagyja vagy felülírja, később is. A feladónkénti stílusprofilok megtekinthetők és törölhetők. |
| A7 | **Összesítők beállítása** | Reggeli és/vagy esti összesítő (U16), választható időpontokkal (pl. 8:00, 17:00) (D28). |
| A8 | **Csendes órák** | Időablak (pl. 19:00–7:00 és hétvége), amikor nem megy azonnali értesítés. A sürgős levelek ilyenkor is átmennek; a fontosakról beállítható, hogy átmenjenek-e (alapból nem; onboardingkor a rendszer rákérdez). A visszatartott fontos és sürgős levelek a csendes órák utáni összesítőbe kerülnek (D3); a talán érdekes az időszakos összesítőbe, ha az ki van kapcsolva, a csendes órák utániba (D6). |
| A9 | **Szüneteltetés és leállítás** | Adminból indított szünet visszakapcsolásig tart (D38); csevegőből max. 72 óra (D35). Szünet alatt a levelek csak megjelölődnek. Újraindításkor az utolsó 24 óra nem értesített levelei egy összesítőben jönnek, a régebbiek csendben besorolódnak (D4, D40, D41); a csendes órák erre az üzenetre nem hatnak, de ha épp csendes óra van, az üzenet alján jelzi, meddig (D41). Végleges leállítás egy megerősítő gombbal (D43); választható az adatok azonnali törlése (D63). |
| A10 | **Sürgősségi küszöb** | Hány órán belüli határidő számítson sürgősnek (alapból 24 óra, 48 órára állítható), és mely események (pl. fizetési felszólítás, hatósági levél) legyenek mindig sürgősek. |
| A11 | **Kiemelt feladók és tiltólista kezelése** | Feladók és domainek listája (kiemelt / tiltott), forrás-jelöléssel: AI · felhasználó · visszajelzés (D11, D47). Onboardingkor az AI a múltbeli levelezésből alapértelmezett kiemelt-feladó listát állít elő (D14). Itt látszanak a csevegőből (U17b) és a visszajelzésekből (U10) felvett tételek is. |
| A12 | **Múlt feltérképezésének időtartama** | Onboardingkor hány napra visszamenőleg elemzi a rendszer a levelezést (kiemelt feladók alaplistája, alap stílusprofil); alapból 30 nap, állítható (D50). |
| A13 | **Admin-módosítások jelzése** | Az admin felületen tett módosításról jelzés megy: azonnal a csevegőbe (alapérték) vagy csak a következő összesítőben megemlítve (D46). |
| A14 | **Változásnapló** | A fiókbeállítások változásai: mikor, honnan (csevegő / admin), mit (D48); megőrzés 12 hónap (D60). |

## **Döntések**

| \# | Kérdés | Döntés |
| :---- | :---- | :---- |
| 1 | **Kategóriák** | Öt kategória, külön sürgős szinttel (U1, U3, A8). |
| 2 | **Postafiók-típusok** | Csak Gmail (A1). |
| 3 | **Csatorna** | Csak Telegram az MVP-ben (A2, D1). |
| 4 | **Csevegőből állítható beállítások** | Minden hétköznapi és kényelmi beállítás, a lista az U17-ben; módosítás előtt megerősítés (D33). |
| 5 | **Több felhasználó** | Nem: egy előfizetés \= egy postafiók, egy felhasználó (A1); a fiók és a postafiók külön entitás, a több postafiók később bevezethető (D45). |
| 6 | **Admin felület formája** | Webes oldal, Google-fiókos belépéssel (D45). A csevegőben marad a napi használat és a hétköznapi beállítások (U17). |

### **Adatmegőrzés**

Alapelv: csak annyit és addig tárolunk, amennyi a vállalt szolgáltatásokhoz kell. Az előző változat (teljes szöveg azonnali törlése) mellett a kontextusvizsgálat (U2) és a stílus-illesztés (U13) gyengén működne, mert az összefoglalóból a hangnem elvész.

| Adat | Megőrzés | Melyik szolgáltatáshoz kell |
| :---- | :---- | :---- |
| Aktív levélváltások teljes szövege | Az utolsó üzenettől számított 14 napig, utána csak az összefoglaló marad | Kontextusfüggő besorolás (U2), válaszpiszkozat (U12) |
| Mellékletek | Nem tároljuk; szükség esetén a Gmailből | U7b |
| Összefoglalók, besorolások, értesítések | 90 nap | Időszakos összesítő (U16), visszakeresés (U15) |
| Elnémított levelek feladó \+ tárgy | 30 nap (D61) | Elnémított levelek listája (U4) |
| Feladónkénti stílusprofil (csak jellemzők, pl. tegezés, hossz, hangnem; levélszöveg nélkül) | Az előfizetés végéig; az adminon törölhető (A6) | Stílus-illesztés (U13) |
| Beállítások, szabályok, kiemelt feladók | Az előfizetés végéig | Besorolás (U1, A5) |
| Változásnapló (fiókbeállítások) | 12 hónap (D60) | Változásnapló (A14) |
| Statisztika (csak darabszámok) | 12 hónap | Kimutatások, számlázás |
| Technikai naplók (levélszöveg nélkül) | 30 nap | Hibakeresés |
| Onboardingkor elemzett levelek (alapból 30 nap visszamenőleg) | A fenti szabályok szerint (14 nap / 90 nap) | Onboarding (A12, D50) |
| Minden ügyféladat lemondás vagy leválasztás után | 30 napon belül törlődik; addig újrabekötve visszaáll (D42); kérésre azonnal, 24 órán belül (D63); utána visszaigazoló e-mail (D62) | — |
| Hangüzenetek | Az átírás után azonnal törlődnek; csak a szöveges átirat marad, a csevegés részeként | Hangüzenetes bevitel (U2-1, 2\. kör) |

## **1\. kör — Rendszerszintű működés**

Az alábbi működés nem egy-egy funkcióhoz, hanem a teljes szolgáltatáshoz tartozik; a részleteket az F1, F10 és F11 folyamatábra írja le.

* R1 Onboarding: Google-belépés → Gmail bekötése → a múlt feltérképezése a háttérben (alapból 30 nap, A12) → Telegram-párosítás → alapbeállítások webes varázslóban (D51) → AI-javaslatok jóváhagyása (kiemelt feladók alaplistája, alap stílusprofil; D14) → élesítés, üdvözlő üzenet, induló összesítő az utolsó 24 óráról (D52). Az előfizetés az MVP-ben kézzel kezelt (D49).  
* R2 Hibakezelés: átmeneti hibánál újrapróbálás; 3 sikertelen próbálkozás vagy 15 perc után üzemeltetői riasztás Telegram-csatornára és e-mailben (D57). Lejárt Gmail-hozzáférés: feldolgozás felfüggesztve, napi 1 emlékeztető, újrabekötés után pótlás a D4/D40/D41 szerint (D56, D59). Ha a Telegram 6 órája nem érhető el: e-mail a tulajdonosnak, 6 óránként, legfeljebb 3-szor (D54); helyreálláskor magyarázó összesítő (D58). Tartós AI-hiba: nyers értesítés (D55).  
* R3 Adatmegőrzés és törlés: napi ütemezett törlés a megőrzési tábla szerint; leválasztás vagy leállítás után 30 napig visszaállítható, utána teljes törlés, vagy kérésre azonnal, 24 órán belül (D42, D63); a teljes törlés után visszaigazoló e-mail (D62).

## **Folyamatábra-döntések (D1–D63)**

A szolgáltatási folyamatábrák (F1–F11) kidolgozása közben hozott döntések, 2026-10-09 és 2026-10-10. Az ábrák Mermaid formában: Obsidian AIsztens/Email-modul/Folyamatabrak és D:\\Munka\\AIsztens\\KKV-AIsztens\\Folyamatabrak.

* D1: Az MVP-ben csak Telegram csatorna van (Slack nincs).  
* D2: Az A11-ben hivatkozott „U18” \= U17b.  
* D3: A csendes órákban fennakadt fontos és sürgős levelek a csendes órák lejárta után összesítőben mennek ki (független a napi összesítő A7 beállításától).  
* D4: Szüneteltetés visszakapcsolása után a rendszer közvetlenül csak az utolsó 24 óra korábban nem értesített / nem feldolgozott leveleiről küld értesítést.  
* D5: Besorolási sorrend: sürgős → fontos → talán érdekes → hírlevél/spam.  
* D6: Csendes órákban visszatartott „talán érdekes” levél, ha a napi összesítő ki van kapcsolva → a csendes órák utáni összesítőbe kerül.  
* D7: Hírlevél/spam levélről nem készül AI-összefoglaló; csak feladó \+ tárgy (U4 lista).  
* D8: A kontextus (U2) csak felminősíthet, leminősíteni nem.  
* D9: Olvasottnak jelölés külön gomb az értesítés alatt (U7 gombsor bővül).  
* D10: Szabad szöveges válasz egy értesítésre az adott levélhez kötődik.  
* D11: A kiemelt feladók listáján minden tétel forrás-jelölést kap: AI vette fel / felhasználó vette fel. „Nem fontos” feladószabály esetén az AI által felvett feladó lekerül a listáról, a felhasználó által felvett nem.  
* D12: Túl hosszú levélnél a „Teljes levél” csak az elejét mutatja \+ Gmail-link.  
* D13: Archiválás után az értesítés megmarad a csevegőben „archiválva” jelöléssel.  
* D14: Az AI kontextus alapján vehet fel kiemelt feladót (forrás: AI); elsősorban onboardingkor a múltbeli levelezés feltérképezésével alapértelmezett listát állít elő (F1).  
* D15: A Válasz gomb hatására a rendszer visszakérdez, javasolt irányokkal.  
* D16: (felülírva a D21-gyel)  
* D17: Stílusválasztásnál opciók gombként, ezek közül egy „Javasolt” jelöléssel.  
* D18: Új feladónál a választott stílus a feladó stílusprofilja lesz; később finomodik.  
* D19: Nincs „Válasz mindenkinek” és nincs melléklet az MVP-ben.  
* D20: Piszkozat mentése vagy küldés után az eredeti levél olvasottnak jelölődik.  
* D21: Van küldés a csevegőből, kizárólag kétlépcsős, explicit megerősítéssel (U14 érvényes marad).  
* D22: Felhasználó által felvett kiemelt feladó „Nem fontos” feladószabályánál a rendszer rákérdez, levegye-e a listáról.  
* D23: A visszakeresés csak a rendszer által tárolt, 90 napos adatokban fut.  
* D24: Több találatnál 5 jelenik meg, utána „Továbbiak” gomb.  
* D25: Az elnémított lista alapból az utolsó értesítés óta érkezett leveleket mutatja.  
* D26: Témán kívüli kérdésre közepes terjedelmű válasz engedett, visszaterelés a levelezésre.  
* D27: Kétértelmű kérdésnél visszakérdez gombokkal.  
* D28: Az időszakos összesítő reggeli és/vagy esti; az A3 „összefoglaló gyakoriság” ide kerül (A7), az A3 ellenőrzés trigger alapú.  
* D29: Üres időszakos összesítő is kimegy rövid „nem jött fontos levél” üzenettel.  
* D30: Közeli időpontú összesítők egy üzenetbe vonódnak össze.  
* D31: Az összesítő jelöli az elintézetlen leveleket (nem olvasott, nem archivált, nincs rá válasz).  
* D32: Összesítőben kategóriánként max. 5 tétel \+ „Továbbiak” gomb.  
* D33: Minden csevegőből indított módosítás előtt megerősítést kér (régi → új érték).  
* D34: Admin-only kérésnél a csevegő jelzést és linket ad az admin felülethez.  
* D35: Ideiglenes szüneteltetés: a vége kötelező, legfeljebb 72 óra; utána újra be kell kapcsolni, ha kell. Visszakapcsolás csevegőből is.  
* D36: Név alapján megadott feladót a rendszer a levelezésből azonosítja, és megerősítteti a címet.  
* D37: Domain szintű szabály csevegőből is felvehető.  
* D38: Az admin felületről indított szünet visszakapcsolásig tart (a 72 órás korlát csak a csevegőre vonatkozik).  
* D39: Csevegős szünetnél 15 perccel a lejárat előtt figyelmeztetés, meghosszabbítási lehetőséggel.  
* D40: A szünet alatt érkezett, 24 óránál régebbi levelek csendben besorolódnak és mentődnek.  
* D41: Újraindításkor az értesítések egy összesítőben mennek; a csendes órák erre nem hatnak, de ha épp csendes óra van, az üzenet alján tájékoztat (X-ig).  
* D42: 30 napon belül ugyanazt a postafiókot újra bekötve a beállítások és szabályok visszaállnak.  
* D43: Végleges leállításhoz egy megerősítő gomb elég.  
* D44: Az összesítők összevonási időablaka alapból 2 óra, egyszerűen módosítható konfigurációs érték.  
* D45: Az AIsztens-fiók (belépés Google-fiókkal) és a bekötött postafiók külön entitás — így később egy fiókhoz több postafiók köthető.  
* D46: Admin-módosításról jelzés: beállítható, hogy azonnal a csevegőbe vagy csak az összesítőben; alapérték: azonnal.  
* D47: A szabálylista forrás-jelölése: AI · felhasználó · visszajelzés (U10); a D11/D22-ben a visszajelzésből születettek felhasználói forrásúak.  
* D48: A fiókbeállítások változásairól változásnapló készül.  
* D49: Az előfizetés nem része az MVP onboardingnak (kézzel kezelt).  
* D50: A múlt feltérképezése onboardingkor alapból 30 nap, az admin felületen állítható.  
* D51: Az alapbeállítások a webes varázslóban kerülnek bekérésre.  
* D52: Élesítéskor induló összesítő megy az utolsó 24 óra friss leveleiről.  
* D53: Telegram-párosítás link / QR-kóddal, egyszeri kóddal.  
* D54: Ha a Telegram 6 órája nem érhető el, e-mail megy a tulajdonosnak; 6 óránként, legfeljebb 3-szor.  
* D55: Tartós AI-hiba esetén nyers értesítés (feladó, tárgy, link, „nem sikerült elemezni”).  
* D56: Gmail-újrabekötés után a kimaradt levelek a D4 / D40 / D41 szerint.  
* D57: Üzemeltetői riasztás Telegram-csatornára és e-mailben; küszöb: 3 sikertelen próbálkozás vagy 15 perc.  
* D58: Telegram-kiesés után a sorban álló értesítések egy magyarázó összesítőben.  
* D59: Lejárt Gmail-hozzáférésnél napi 1 emlékeztető.  
* D60: Változásnapló megőrzése 12 hónap.  
* D61: Elnémított levelek feladó \+ tárgy megőrzése 30 nap.  
* D62: Teljes törlés után visszaigazoló e-mail a tulajdonosnak.  
* D63: Azonnali törlés kérhető leválasztáskor és leállításkor (admin), figyelmeztetéssel, 24 órán belül.

# 2\. körös MVP

A 2\. kör két új integrációt hoz (hangüzenetek, naptár), valamint olyan kényelmi és követési funkciókat, amelyek az 1\. kör működő alapjára épülnek (emlékeztetők, mellékletek, sablonok, kimutatás).

## **Felhasználói felület**

| ID | Funkció | Részletek |
| :---- | :---- | :---- |
| U2-1 | Hangüzenetes bevitel | Telegramon és Slacken is lehet hangüzenettel kérdezni, kérni és választ diktálni; a rendszer átírja, és úgy kezeli, mintha beírták volna. Ha a diktálásból kimenő levél vagy beállítás-módosítás lesz, a rendszer előbb visszaírja, mit értett („Ezt értettem: …”), és csak jóváhagyás után lép. A hangüzenetek az átírás után törlődnek. |
| U2-2 | Naptár bekötése | A rendszer látja a naptárat, és a levelekben szereplő időpontkérésekhez szabad időpontot javasol vagy eseményt hoz létre jóváhagyással. |
| U2-4 | Emlékeztető egy levélre | „Emlékeztess holnap 9-kor erre.” A rendszer a megadott időben újra elküldi az értesítést. |
| U2-5 | Megválaszolatlan fontos levelek figyelése | Ha egy fontos levélre a beállított időn belül nincs válasz, a rendszer szól; ezek a napi összesítőben is megjelennek. |
| U2-6 | Melléklet-összefoglaló | PDF és Word mellékletekről is rövid összefoglaló (pl. ajánlat, szerződés, számla fő adatai). |
| U2-7 | Válaszsablonok használata | Gyakori válaszoknál (árajánlat-kérés, időpont-egyeztetés) a piszkozat a mentett sablonból indul. |
| U2-8 | Beállítási űrlap a csevegőn belül | A csevegőben megnyíló, egyszerű vizuális űrlap a beállításokhoz (csendes órák, összesítő, részletesség, szabályok). A felhasználó nem hagyja el a csevegőt, és egyben látja, mi van beállítva. |
| U2-9 | Hangválasz | A rendszer hangüzenettel is tud válaszolni (az U2-1 hangbevitelre épül). Alapból tükör mód: hangra hanggal, írásra írással válaszol. A hangválasz rövid (kb. 20–30 mp-es összefoglaló), mellé mindig szöveg is jár; levéltervezet, link, összeg csak írásban. Telegramon igazi hangüzenet-buborékként, Slacken lejátszható hangfájlként érkezik. |
| U2-10 | „Beállításaim” kártya | Kérésre és hetente egyszer egy áttekintő kártya a csevegőben: az érvényes beállítások és az összes besorolási szabály egy helyen. A szabályok mellett Törlés / Módosítás gomb, a hét új szabályai kiemelve. Nem kell átlépni a webes adminra vagy visszagörgetni a csevegésben. |

## **Admin felület**

| ID | Funkció | Részletek |
| :---- | :---- | :---- |
| A2-1 | Naptár bekötése és leválasztása | Az U2-2 előfeltétele (Google Calendar OAuth). |
| A2-2 | Hangbevitel és hangválasz beállítása | Hangbevitel be/ki (U2-1); hangválasz: kikapcsolva / tükör mód / mindig hang (U2-9). A csevegőből is állítható (U17). |
| A2-4 | Válaszfigyelés határideje | Hány nap után jelezzen az U2-5 egy megválaszolatlan fontos levélről. |
| A2-5 | Válaszsablonok kezelése | Sablonok létrehozása, szerkesztése, törlése az U2-7-hez. |
| A2-6 | Heti kimutatás | Hetente egy üzenet a tulajdonosnak: hány levél jött, hány került félre, hány válasz készült, becsült megtakarított idő. |

### **Levelek ideiglenes tárolása**

* Méret probléma (pl. Sok nagy méretű csatolmány)  
* Biztonságos tárolás  
* Tárolás előtti optimalizáló szűrés (pl. spamaket ne mentse; D7: hírlevél/spamből csak feladó \+ tárgy, 30 napig)  
* Hosszabb távú összefoglaló memória kiépítése

### **Admin felület**

* Biztonság (elkülönülő ügyfél adatok)  
* Beléptetés (oAuth): Google-fiókkal; a fiók és a postafiók külön entitás (D45)  
* Jogosultságok kezelése

### **AI kezelés**

* Milyen AI-t használunk milyen feladatra (Opus vs. JEV)  
* Kiválaszthatja-e a felhasználó **\- NEM**  
* AI korlátai (Nem kell tudnia mindenről beszélgetni; témán kívül közepes terjedelmű válasz, D26)

## **Kálmán feladatai**

### **Logok**

* Miket logoljunk? (**Költségvetési log, Működési log, Biztonsági log, Hiba log**)  
* MIlyen adatok kellenek a számlázáshoz. Üzemeltetői riasztás: 3 sikertelen próbálkozás vagy 15 perc kiesés, Telegram-csatorna \+ e-mail (D57); a fiókbeállítások változásnaplója 12 hónapig (D48, D60)


**Email modul belső működési diagramja**