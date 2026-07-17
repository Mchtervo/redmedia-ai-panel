export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <main className="flex flex-col items-center gap-4 text-center">
        <span className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Kurulum Tamamlandı
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl dark:text-zinc-50">
          Redmedia AI Panel
        </h1>
        <p className="max-w-md text-base text-zinc-600 dark:text-zinc-400">
          Proje temel altyapısı hazır. Entegrasyonlar ve modüller bir sonraki
          adımlarda eklenecek.
        </p>
      </main>
    </div>
  );
}
