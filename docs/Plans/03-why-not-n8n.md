# Miért nem n8n a gerinc?

> **Összefoglaló:** az n8n kiváló eszköz **gyors integrációs prototípushoz**, de ehhez a
> rendszerhez **nem a gerincre való**. A kód-alapú, saját backend a megfelelő döntéshozó réteg.

## A fő okok

### 1. A saját elved sérülne

A terv kulcselve: **a backend a döntéshozó, a külső szolgáltatások csak végrehajtók**
(lásd: [`01-callback-assistant.md`](../01-callback-assistant.md)).

Ha az n8n lenne az orkesztrátor, akkor egy külső, fekete dobozos runtime válna a
döntéshozóvá, a saját backend pedig csak adattárolóvá degradálódna — ez fordított irány.

### 2. Determinisztikus állapotgép kell

A hívás-életciklus szigorú állapotgép:

```
queued → dialing → ringing → in-progress → completed | failed | no_answer | busy
       → actions_executing
```

Ezt típusos kódban lehet megbízhatóan, tesztelhetően és verziózhatóan leírni; vizuális
workflow-ban ez nehezen karbantartható.

### 3. Tranzakciós konzisztencia

A webhook-feldolgozásnál **egyszerre** kell:

- státuszt frissíteni,
- `call_details`-t menteni,
- akció-jobot berakni a várólistába.

Ezt a pg-boss / Laravel database driver **DB + queue azonos tranzakcióban** natívan adja;
az n8n queue/retry mechanizmusa nincs a saját adatmodellhez tranzakcióba kötve.

### 4. Idempotencia

A VAPI újraküldheti a webhookokat; a terv idempotens feldolgozást ír elő
(`call.id` + event id alapján). Ez dedup-kulcsokkal és unique constraint-ekkel kódban
garantálható — n8n-ben csak kerülőutakkal.

### 5. Tesztelhetőség és verziókezelés

A NestJS/Laravel kód unit-tesztelhető, type-safe, gitben review-zható, CI/CD-vel
deploy-olható. Az n8n workflow-k JSON-exportok, lényegesen gyengébb verziókövetéssel és
tesztelhetőséggel.

### 6. Felesleges függőség

A terv minimális, önálló stacket céloz (Postgres + egy backend). Az n8n egy plusz runtime,
amit üzemeltetni, védeni és verziózni kell — új meghibásodási pont.

## n8n vs. kód-alapú gerinc

| Szempont | n8n | Kód-alapú gerinc (NestJS / Laravel) |
|---|---|---|
| Állapotgép | Nehezen, vizuálisan | Típusos, explicit tranzíciók |
| Tranzakció (DB + queue) | Nincs natívan | pg-boss / database driver, natívan |
| Idempotencia | Kerülőutakkal | Dedup-kulcs + unique constraint |
| Tesztelés | Gyenge | Unit-teszt, type-safe |
| Verziókezelés | JSON-export | Git, review, CI/CD |
| Függőség | Plusz runtime | Nincs plusz komponens |
| Erősség | 3. feles összekötése gyorsan | Determinista, állapottartó backend |

## Miért javasolja Kálmán mégis mindenhova?

Kálmán koncepciója **nem épít valódi backendet** — gyorsan köti össze a harmadik feleket:

```
űrlap → n8n → Retell → Sheets/CRM/email
```

A saját terv ezzel szemben a backendet teszi a döntéshozóvá, amihez a kód-alapú gerinc a
megfelelő eszköz.

## Az n8n helyes szerepe

Az n8n **opcionális periféria-rétegként** maradhat a rendszerben — például:

- CRM-sync,
- marketing-email automatizálás,
- külső SaaS-összekötések.

De **nem a core orkesztráció**. A core a saját, várólistás, tranzakciós backend marad.
