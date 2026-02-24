import type { JudgeVerdict } from "@/lib/openrouter";

export type AttemptGuess = {
  guess: string;
  score: number;
  verdict: JudgeVerdict;
  reason: string;
  correct: boolean;
};

type GuessLike = {
  guess: unknown;
  score: unknown;
  verdict: unknown;
  reason: unknown;
  correct: unknown;
};

export type GuessRow = {
  guess: string;
  score: number;
  verdict: string;
  reason: string;
  correct: boolean;
  position: number;
};

export function parseAttemptGuesses(value: unknown): AttemptGuess[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is GuessLike => typeof entry === "object" && entry !== null)
    .map((entry) => {
      const score =
        typeof entry.score === "number" && Number.isFinite(entry.score)
          ? Math.max(0, Math.min(100, Math.round(entry.score)))
          : 0;
      const verdict = normalizeVerdict(entry.verdict, entry.correct);
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

export function buildGuessCreateData(input: {
  attemptId: string;
  position: number;
  guess: AttemptGuess;
}) {
  return {
    attemptId: input.attemptId,
    position: input.position,
    guess: input.guess.guess,
    score: input.guess.score,
    verdict: input.guess.verdict,
    reason: input.guess.reason,
    correct: input.guess.correct,
  };
}

function normalizeVerdict(
  verdict: unknown,
  correct: unknown,
): JudgeVerdict {
  if (verdict === "correct" || verdict === "incorrect") {
    return verdict;
  }

  return correct === true ? "correct" : "incorrect";
}
