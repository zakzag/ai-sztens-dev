# Jira housekeeping — notification/log ticketek egy story alá vonása

**Dátum:** 2026-10-23 22:10 (Europe/Budapest)
**Típus:** Jira housekeeping (nem kódváltozás)
**Érintett Jira projekt:** `AIS` (AISztens)

## Kiindulás

A frontend notification + élő log rendszerhez 2026-10-22-én 8 külön issue készült
ugyanarra a hatókörre:

- 7 db önálló **Story** a részleges munkabontásra (AIS-79 … AIS-85),
- 1 db **Story** a teljes rendszerre (AIS-86), amelynek a leírása már hivatkozott
  a „subtaskokban élő” munkabontásra, de `subtasks` listája üres volt.

Ez a felállás sértette a „egy story = egy szállítható egység” elvet: a 7 story
ugyanannak a `docs/plans/2026-10-22--15-40-00-frontend-notification-and-log-system-plan.md`
tervnek a munkapontjai voltak, nem önálló termékértékek.

## Elvégzett művelet

A 7 Story-t Jira `Move` (bulk-move) művelettel **Subtaskká** alakítottuk az
**AIS-86** Story alatt (`AIS` projekt, `Subtask` issue type, `parent = AIS-86`).

| Issue  | Előtte | Utána   | Hatókör                             |
| ------ | ------ | ------- | ----------------------------------- |
| AIS-79 | Story  | Subtask | `packages/notifications` core store |
| AIS-80 | Story  | Subtask | `sessionStorage` perzisztencia      |
| AIS-81 | Story  | Subtask | `Toast` + `ToastStack`              |
| AIS-82 | Story  | Subtask | `LogDrawer` + `LogEntryRow`         |
| AIS-83 | Story  | Subtask | React bindings + `NotificationHost` |
| AIS-84 | Story  | Subtask | Admin globális capture              |
| AIS-85 | Story  | Subtask | `ApiKeyForm` + dokumentáció lezárás |

### Mellékhatások

- A `Priority` mező (korábban `High`) **elveszett** a 7 issue-n, mert a projekt
  `Subtask` issue típusán nincs priority mező. Ez tudatosan elfogadott
  kompromisszum volt (a felhasználó jóváhagyta a konverzió előtt); a prioritás
  a parent story szintjén továbbra is `High`.
- A státusz **nem** változott: minden issue `To Do` maradt.
- A leírások, labelek és követelményszövegek **változatlanok**.

### A parent story frissítése

Az AIS-86 leírása átírásra került, hogy a követelmények és a megvalósítás
pontosan ugyanazt fedje:

- új „Munkabontás — subtaskok” szakasz a tényleges kulcsokkal, tartalommal és
  előfeltétel-lánccal (AIS-79 → AIS-80 → AIS-83 → AIS-84 → AIS-85, illetve a
  független UI subtaskok AIS-81, AIS-82),
- a story szintű tesztelvárások subtaskokhoz rendelve,
- új „Nem része ennek a storynak” szakasz (`apps/web` bekötés,
  navigációs log, swipe-to-dismiss),
- új „Verifikáció” szakasz a futtatandó parancsokkal.

A story-hoz audit komment is készült a konverzióról.

## Hogyan ellenőrizhető

```text
project = AIS AND (parent = AIS-86 OR key = AIS-86) ORDER BY key ASC
```

Elvárt eredmény: 1 db `Story` (AIS-86) + 7 db `Subtask` (AIS-79 … AIS-85),
más notification/log témájú standard issue nem maradt a projektben.

## Kapcsolódó dokumentumok

- Terv: [`2026-10-22--15-40-00-frontend-notification-and-log-system-plan.md`](../plans/2026-10-22--15-40-00-frontend-notification-and-log-system-plan.md)
- Spec: [`UI-Architecture.md`](../Specs/UI-Architecture.md)
