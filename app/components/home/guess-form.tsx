import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
      <Textarea
        value={guess}
        onChange={(event) => onGuessChange(event.target.value)}
        placeholder="guess goes here"
        disabled={isLoadingAttempts || isSolved || hasGivenUp || isGivingUp}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">
          {triesUsed} {triesUsed === 1 ? "attempt" : "attempts"} used
        </p>

        {isSolved || hasGivenUp ? (
          <Button type="button" onClick={onOpenResults}>
            Results
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            {status === "authenticated" && !hasGivenUp ? (
              <Button
                type="button"
                variant="destructive"
                onClick={onGiveUp}
                disabled={isLoadingAttempts || isSubmitting || isGivingUp || hasGivenUp}
              >
                {isGivingUp ? "Giving up..." : "Give up"}
              </Button>
            ) : null}

            <Button
              type="submit"
              disabled={
                isLoadingAttempts ||
                isSubmitting ||
                isGivingUp ||
                hasGivenUp ||
                !guess.trim()
              }
            >
              {isSubmitting ? "Checking..." : "Submit Guess"}
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}
