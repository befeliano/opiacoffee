export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-4 pb-28 pt-4 sm:px-6 md:pt-6" aria-busy="true" aria-label="Yükleniyor">
      <div className="h-8 w-44 animate-pulse rounded-lg bg-stone-200/70" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-stone-100" />
        ))}
      </div>
      <div className="mt-3 h-64 animate-pulse rounded-2xl bg-stone-100" />
    </main>
  );
}
