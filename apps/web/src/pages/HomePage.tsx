import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <section className="space-y-6">
      <div className="rounded-xl bg-slate-900 p-8 shadow-sm ring-1 ring-slate-800">
        <h1 className="text-3xl font-bold text-white">
          Nem értünk el? Hívjuk mi vissza Önt!
        </h1>
        <p className="mt-3 text-slate-400">
          Adja meg elérhetőségeit, és szakértő kollégánk a lehető leghamarabb visszahívja.
          Az ügyintézés telefonon történik, így nem kell várakoznia a vonalban.
        </p>
        <Link
          to="/callback"
          className="mt-6 inline-block rounded-md bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-500"
        >
          Visszahívást kérek
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['Gyors', 'Átlagosan perceken belül visszahívjuk.'],
          ['Személyes', 'Szakértő kollégánk beszél Önnel telefonon.'],
          ['Ingyenes', 'A visszahívás Önnek semmibe nem kerül.'],
        ].map(([title, text]) => (
          <div key={title} className="rounded-xl bg-slate-900 p-6 shadow-sm ring-1 ring-slate-800">
            <h2 className="font-semibold text-white">{title}</h2>
            <p className="mt-2 text-sm text-slate-400">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
