import { Card } from '@callback/ui';
import { BuildInfoFooter } from '../components/BuildInfoFooter.js';

/** The three value propositions under the hero panel. */
const VALUE_POINTS: ReadonlyArray<readonly [string, string]> = [
  ['Gyors', 'Átlagosan perceken belül visszahívjuk.'],
  ['Személyes', 'Szakértő kollégánk beszél Önnel telefonon.'],
  ['Ingyenes', 'A visszahívás Önnek semmibe nem kerül.'],
];

export function HomePage() {
  return (
    <section className="space-y-6">
      <Card className="p-8">
        <h1 className="text-3xl font-bold text-text-primary">
          Nem értünk el? Hívjuk mi vissza Önt! Még ma!
        </h1>
        <p className="mt-3 text-text-secondary">
          Adja meg elérhetőségeit, és szakértő kollégánk a lehető leghamarabb
          visszahívja. Az ügyintézés telefonon történik, így nem kell várakoznia
          a vonalban.
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {VALUE_POINTS.map(([title, text]) => (
          <Card key={title}>
            <h2 className="font-semibold text-text-primary">{title}</h2>
            <p className="mt-2 text-sm text-text-secondary">{text}</p>
          </Card>
        ))}
      </div>

      {/* Which revision is actually being served? Baked in at image build time. */}
      <BuildInfoFooter />
    </section>
  );
}
