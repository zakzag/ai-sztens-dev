import { Card } from '@callback/ui';

export function LegalPage() {
  return (
    <Card className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold text-text-primary">
        Adatkezelési tájékoztató
      </h1>
      <p className="mt-4 text-sm text-text-secondary">
        Az űrlapon megadott adatokat (név, e-mail cím, telefonszám, megkeresés
        oka) kizárólag a visszahívás teljesítésére használjuk, és a szolgáltatás
        működéséhez szükséges ideig őrizzük meg. Rögzített hívások esetén a
        hívás elején tájékoztatást adunk a hangrögzítésről.
      </p>
      <p className="mt-3 text-sm text-text-secondary">
        Ez a szakasz helyőrző — a végleges adatkezelési tájékoztató jogi
        felülvizsgálat után kerül beillesztésre (GDPR).
      </p>
    </Card>
  );
}
