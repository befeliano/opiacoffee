export default function FloorLoading() {
  return (
    <main className="mx-auto max-w-7xl px-4 pb-28 pt-4 sm:px-6 md:pt-6" aria-busy="true" aria-label="Masalar yükleniyor">
      <div className="h-8 w-36 animate-pulse rounded-lg bg-stone-200/70" />
      <div className="mt-5 grid grid-cols-3 gap-3 min-[480px]:grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
        {Array.from({ length: 16 }, (_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-2xl bg-stone-100" />
        ))}
      </div>
    </main>
  );
}
