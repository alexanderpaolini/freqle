import Link from "next/link";

type SharePageProps = {
  searchParams: Promise<{
    tries?: string;
    date?: string;
    ref?: string;
  }>;
};

export default async function SharePage({ searchParams }: SharePageProps) {
  const params = await searchParams;
  const triesValue = Number(params.tries);
  const tries =
    Number.isFinite(triesValue) && triesValue > 0
      ? Math.floor(triesValue)
      : null;
  const date = params.date ?? "today";
  const ref = params.ref;
  const playHref = ref ? `/?friend=${encodeURIComponent(ref)}` : "/";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fef6e7,_#efe4d4)] px-4 py-10 text-stone-900">
      <div className="mx-auto max-w-xl rounded-3xl border border-stone-300 bg-[#fffdf7] p-8 text-center shadow-[0_18px_50px_-28px_rgba(31,29,26,0.45)]">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">
          freqle share
        </p>
        <h1 className="mt-2 text-4xl font-semibold">Daily Result</h1>
        <p className="mt-4 text-lg text-stone-700">
          {tries ? (
            <>
              Solved in <span className="font-semibold">{tries}</span>{" "}
              {tries === 1 ? "attempt" : "attempts"}.
            </>
          ) : (
            "No tries count was provided in the share link."
          )}
        </p>
        <p className="mt-2 text-sm text-stone-500">Puzzle date: {date}</p>

        <Link
          href={playHref}
          className="mt-6 inline-flex rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700"
        >
          Play today&apos;s puzzle
        </Link>
      </div>
    </main>
  );
}
