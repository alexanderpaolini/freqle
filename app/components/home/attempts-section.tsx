import type { GuessResult } from "./types";

type AttemptsSectionProps = {
  status: "authenticated" | "loading" | "unauthenticated";
  isLoadingAttempts: boolean;
  attempts: Array<{
    result: GuessResult;
    index: number;
  }>;
};

export function AttemptsSection({
  status,
  isLoadingAttempts,
  attempts,
}: AttemptsSectionProps) {
  return (
    <section className="rounded-3xl border border-stone-300/70 bg-[#fffdf7] p-6">
      <h2 className="text-xl font-semibold">Attempts</h2>
      {status === "authenticated" && isLoadingAttempts ? (
        <p className="mt-3 text-sm text-stone-600">Loading saved attempts...</p>
      ) : attempts.length === 0 ? (
        <p className="mt-3 text-sm text-stone-600">No guesses yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {attempts.map(({ result, index }) => (
            <li
              key={`${result.guess}-${index}`}
              className="rounded-xl border border-stone-300 bg-white p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{result.guess}</p>
                <p
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${
                    result.correct
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {result.correct ? "Correct" : "Incorrect"}
                </p>
              </div>
              <p className="mt-2 text-sm text-stone-600">
                Closeness score: <span className="font-semibold">{result.score}</span>/100
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
