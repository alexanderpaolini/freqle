import type { Prisma } from "@prisma/client";

export type AttemptGuess = {
  guess: string;
  score: number;
  correct: boolean;
};

export function parseAttemptGuesses(value: unknown): AttemptGuess[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (entry): entry is { guess: unknown; score: unknown; correct: unknown } =>
        typeof entry === "object" && entry !== null,
    )
    .map((entry) => ({
      guess: typeof entry.guess === "string" ? entry.guess.trim() : "",
      score:
        typeof entry.score === "number" && Number.isFinite(entry.score)
          ? Math.max(0, Math.min(100, Math.round(entry.score)))
          : 0,
      correct: entry.correct === true,
    }))
    .filter((entry) => Boolean(entry.guess));
}

export function toAttemptGuessesJson(guesses: AttemptGuess[]): Prisma.InputJsonValue {
  return guesses.map((entry) => ({
    guess: entry.guess,
    score: entry.score,
    correct: entry.correct,
  })) as Prisma.InputJsonValue;
}
