export function LegalPage() {
  return (
    <article className="mx-auto max-w-2xl rounded-xl bg-slate-900 p-8 shadow-sm ring-1 ring-slate-800">
      <h1 className="text-2xl font-bold text-white">Adatkezelési tájékoztató</h1>
      <p className="mt-4 text-sm text-slate-400">
        Az űrlapon megadott adatokat (név, e-mail cím, telefonszám, megkeresés oka) kizárólag a
        visszahívás teljesítésére használjuk, és a szolgáltatás működéséhez szükséges ideig őrizzük
        meg. Rögzített hívások esetén a hívás elején tájékoztatást adunk a hangrögzítésről.
      </p>
      <p className="mt-3 text-sm text-slate-400">
        Ez a szakasz helyőrző — a végleges adatkezelési tájékoztató jogi felülvizsgálat után kerül
        beillesztésre (GDPR).
      </p>
    </article>
  );
}
