export default function OrderLoading() {
  return (
    <div className="flex h-dvh flex-col md:flex-row" aria-busy="true" aria-label="Adisyon yükleniyor">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-stone-200/80 bg-white px-4">
          <div className="size-10 animate-pulse rounded-xl bg-stone-100" />
          <div className="h-6 w-24 animate-pulse rounded-lg bg-stone-200/70" />
        </div>
        <div className="border-b border-stone-200/70 bg-white p-3">
          <div className="h-10 animate-pulse rounded-xl bg-stone-100" />
          <div className="mt-3 flex gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="h-10 w-24 animate-pulse rounded-full bg-stone-100" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 p-3 min-[420px]:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="h-[88px] animate-pulse rounded-2xl bg-stone-100" />
          ))}
        </div>
      </section>
      <aside className="hidden w-[360px] border-l border-stone-200 bg-white md:block lg:w-[400px]" />
    </div>
  );
}
