import type { FormEvent } from "react";

type GuessFormProps = {
  status: "authenticated" | "loading" | "unauthenticated";
  guess: string;
  triesUsed: number;
  isLoadingAttempts: boolean;
  isSubmitting: boolean;
  isGivingUp: boolean;
  isSolved: boolean;
  hasGivenUp: boolean;
  onGuessChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onGiveUp: () => void;
  onOpenResults: () => void;
};

export function GuessForm({
  status,
  guess,
  triesUsed,
  isLoadingAttempts,
  isSubmitting,
  isGivingUp,
  isSolved,
  hasGivenUp,
  onGuessChange,
  onSubmit,
  onGiveUp,
  onOpenResults,
}: GuessFormProps) {
  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
      <textarea
        value={guess}
        onChange={(event) => onGuessChange(event.target.value)}
        placeholder="guess goes here"
        disabled={isLoadingAttempts || isSolved || hasGivenUp || isGivingUp}
        className="min-h-24 w-full rounded-2xl border border-stone-300 bg-white p-3 text-base outline-none ring-stone-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-stone-100"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">
          {triesUsed} {triesUsed === 1 ? "attempt" : "attempts"} used
        </p>

        {isSolved || hasGivenUp ? (
          <button
            type="button"
            onClick={onOpenResults}
            className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700"
          >
            Results
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {status === "authenticated" && !hasGivenUp ? (
              <button
                type="button"
                onClick={onGiveUp}
                disabled={isLoadingAttempts || isSubmitting || isGivingUp || hasGivenUp}
                className="rounded-full border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGivingUp ? "Giving up..." : "Give up"}
              </button>
            ) : null}

            <button
              type="submit"
              disabled={
                isLoadingAttempts ||
                isSubmitting ||
                isGivingUp ||
                hasGivenUp ||
                !guess.trim()
              }
              className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
            >
              {isSubmitting ? "Checking..." : "Submit Guess"}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
