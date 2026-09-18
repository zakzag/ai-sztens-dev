# AI Szolgáltató Startup - Brainstorming meeting

**Dátum:** 2026-09-15
**Résztvevők:** Rák Kálmán, Kővári Tamás
**Cél:** Az üzleti modell alapköveinek megbeszélése, az MVP (Minimum Viable Product) meghatározása és megállapodása az első lépésekről.

---

## 1. Vízió és Szolgáltatási Alapok

*Cél: Megismerni a közös célkitűzéseket és a „Unique Selling Point”-t (USP).*

- [x] **Milyen problémát oldunk meg elsődlegesen?** A weboldalon/hirdetésen érdeklődő
  látogatók egy része sosem kap visszahívást — mert a cégnél nincs elég ember, aki azonnal felvegye a telefont vagy visszahívjon minden beérkező kérést, és minél tovább vár az érdeklődő, annál nagyobb eséllyel fordul a konkurenciához. A **Callback Voice ágens** ezt a konkrét rést zárja be: a látogató kitölt egy visszahívás-kérő űrlapot, a rendszer pedig önállóan, AI-alapú hanghívással (VAPI) visszahívja — nem kell rá embert allokálni, és nem vész el az érdeklődés.
- [x] **Milyen érzést akarunk adni a cégeknek?**   

Az a célunk, hogy a cégnél azt az élményt tapasztalják: nem egy feature-t adtunk hozzá, hanem praktikusan egy ügyfélszolgálati munkatársat helyeztünk be. A Callback Voice ágensnek nincs kapacitáskorlátja, nem fáradt, egyszerűen minden érdeklődőt visszahív, amikor kell.   **Az operatív valóság:** az első 5 percben visszahívott érdeklődés nem megy a konkurenciához.    **Mit érnek el ezzel:** az ügyfélkommunikáció stabilabbá, kiszámíthatóbbá lesz.    Az az alapérzés, amit közvetíteni akarunk: **ez a probléma megoldódott, és most már működik**.

- [x] **Mi lesz a „szlogen"?**  A „24 órás munkatárs" 



## 2. Piaci célközönség és Niche meghatározása

*Cél: Ne próbáljuk meg mindenkit kiszolgálni egyszerre. Válasszunk ki egy főbb iparágat.*

- [x] **Potenciális iparágak listája:**   

Fogorvosok, ingatlanosok, szépségszalonok/kozmetikai klinikák, ügyfélszolgálati centerek — ezek közös vonása a Voice Agent szempontjából, hogy sok a bejövő, visszahívást igénylő érdeklődés (időpontkérés, ajánlatkérés), de kevés a recepciós/ admin kapacitás, ami minden hívást azonnal kezelne.. 

- [ ] **Melyik iparágnak van a legnagyobb szüksége erre?**   
  !! Legnagyobb? Nem tudom.
- [ ] **MVP célközönség:**   
  !! meghatározni



## 3. Termék funkciók és MVP meghatározása (Scope)

*Cél: Meghatározni, mi lesz a „minimum” az első ügyfélhez.*

- [x] **Szolgáltatási modulok prioritása:**
  - **Visszahívó asszisztens** (Callback Voice ágens): **Alap** — ez maga a termék, amiről ez a dokumentum szól.
  - **Aktív titkárnő**, **Intelligens Chatbot**, **Email-figyelő**, **Naptárfigyelő**: ezek a tágabb AIsztens-vízió más termékei, itt tudatosan **nem** tárgyaljuk őket — lásd az általános `Kick-off-Meeting-AI-draft.md`-t.
- [x] **MVP Funkciók (P0 - Abszolút alap):**
  - Visszahívás-kérő űrlap (név, email, megkeresés oka) — validációval.
  - Automatikus AI-hívás VAPI-n keresztül, élő STT→LLM→TTS beszélgetéssel, csak magyar nyelven induláskor.
  - Tulajdonos-értesítés minden új kérésről és minden lezárt hívás eredményéről (átirat + összefoglaló).
  - Hívásnapló és átirat tárolása, visszakereshetően.
  - Determinisztikus hívás-állapotgép: `queued → dialing → ringing → in-progress → completed | failed | no_answer | busy → actions-executing`, minden hívás jól definiált végállapotba jut.
- [x] **Miben „szűkítünk” az első üzemeltetéshez?**   

Nincs automatikus naptárfoglalás az MVP-ben (csak a hívás eredményének jelzése — a naptáridőpont-felajánlás P1, in-call tool-call-ként), nincs CRM-szinkronizáció, nincs admin dashboard (első körben a tulajdonos csak email/SMS-értesítésből lát rá a kérésekre), nincs többnyelvűség, nincs inbound hívásfogadás (az MVP kizárólag **outbound** visszahívás)., 

## 4. Technológiai Stratégia (High-level)

*Cél: Megállapítani az irányt az infrastruktúra és az eszközök választásában.*

- [ ] **LLM választható modell:** (OpenAI GPT-4o, Anthropic Claude, vagy lokális modellek?)
- [ ] **Voice technológia:** (Vapi.ai, Retell AI, ElevenLabs, vagy saját STT/TTS integráció?)
- [ ] **Integrációs réteg:** (Make.com, LangChain, vagy saját fejlesztett backend?)
- [ ] **Adatbázis és CRM szinkronizáció:** (Melyik CRM-ekkel kell az első lépésben tudni beszélni?)



## 5. Üzleti Modell és Árazás

*Cél: Hogyan fogunk pénzt keresni és hogyan fogjuk tartani a költségeket.*

- [x] **Árazási modell:** Havi fix díj + túllépés esetén „pay-per-minute/per-interaction”
- [ ] **Költségstruktúra:** (Milyen API költségekkel számíthatunk egy átlagos ügyfélnél?)
- [ ] **Szolgáltatási díj:** (Milyen „prémiumot” kérünk a technológia és a személyes beállításokért?)



## 6. Szolgáltatási folyamat és Szerepkörök

*Cél: Megállapítani, ki végzi mit.*

- [x] **Szerepkörök megbeszélése:**
  - **Tech/Dev:** **Tamás** (Fejlesztés, API integrációk, prompt engineering, infra)
  - **Sales/BizDev:** **Kálmán** (Ügyfélkeresés, marketing, demo prezentációk, onboarding)
- [ ] **Ügyfél „Onboarding” folyamat:** (Hogyan néz ki egy ügyfél kezdése? Megszólítás -> Adatok gyűjtése -> Tesztelés -> Go-live)



## 7. Következő lépések (Action Items)

*Cél: Konkrét feladatok az első 14 napra.*

- [ ] **[Név]:** [Feladat, pl. „Keressem ki az árakat a Vapi.ai és a Retell AI között”]
- [ ] **[Név]:** [Feladat, pl. „Készítsen egy demo prezentációt egy fiktív fogorvosi rendelő számára”]
- [ ] **[Név]:** [Feladat, pl. „Hívjanak meg 3 potenciális ügyfelet (interjú céljából)”, hogy megkérdezzük a problémáikat.]
- [ ] **Következő ülés dátuma:** [Dátum]