import type { Prisma } from "@prisma/client";
import type { JudgeVerdict } from "@/lib/openrouter";

export type AttemptGuess = {
  guess: string;
  score: number;
  verdict: JudgeVerdict;
  reason: string;
  correct: boolean;
};

export function parseAttemptGuesses(value: unknown): AttemptGuess[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (
        entry,
      ): entry is {
        guess: unknown;
        score: unknown;
        correct: unknown;
        verdict: unknown;
        reason: unknown;
      } =>
        typeof entry === "object" && entry !== null,
    )
    .map((entry) => {
      const score =
        typeof entry.score === "number" && Number.isFinite(entry.score)
          ? Math.max(0, Math.min(100, Math.round(entry.score)))
          : 0;
      const verdict: JudgeVerdict =
        entry.verdict === "correct" || entry.verdict === "incorrect"
          ? entry.verdict
          : entry.correct === true
            ? "correct"
            : "incorrect";
      return {
        guess: typeof entry.guess === "string" ? entry.guess.trim() : "",
        score,
        verdict,
        reason: typeof entry.reason === "string" ? entry.reason.trim() : "",
        correct: verdict === "correct",
      };
    })
    .filter((entry) => Boolean(entry.guess));
}

export function toAttemptGuessesJson(
  guesses: AttemptGuess[],
): Prisma.InputJsonValue {
  return guesses.map((entry) => ({
    guess: entry.guess,
    score: entry.score,
    verdict: entry.verdict,
    reason: entry.reason,
    correct: entry.correct,
  })) as Prisma.InputJsonValue;
}
