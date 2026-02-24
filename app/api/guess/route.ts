import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import {
  buildGuessCreateData,
  parseAttemptGuesses,
  type AttemptGuess,
} from "@/lib/attempts";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { scoreGuessWithOpenRouter } from "@/lib/openrouter";
import {
  getDailyPuzzleFromDateKey,
  getDateKey,
  getRequiredPuzzleFromDateKey,
  type Puzzle,
} from "@/lib/puzzles";

type GuessBody = {
  guess?: unknown;
  dateKey?: unknown;
  anonymousId?: unknown;
};

const guessSelect = {
  guess: true,
  score: true,
  verdict: true,
  reason: true,
  correct: true,
  position: true,
} as const;

const attemptSelect = {
  id: true,
  solved: true,
  gaveUp: true,
  solvedIn: true,
  guesses: {
    select: guessSelect,
    orderBy: {
      position: "asc",
    },
  },
} as const;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const url = new URL(request.url);
  const dateKey = sanitizeDateKey(url.searchParams.get("dateKey"));
  const anonymousId = sanitizeAnonymousId(url.searchParams.get("anonymousId"));

  if (!session?.user?.id) {
    if (!anonymousId) {
      return NextResponse.json({
        results: [],
        triesUsed: 0,
        isSolved: false,
        gaveUp: false,
        revealedAnswer: null,
        noTriesLeft: false,
      });
    }

    const anonymousAttempt = await db.gameAttempt.findUnique({
      where: {
        anonymousId_puzzleDate: {
          anonymousId,
          puzzleDate: dateKey,
        },
      },
      select: attemptSelect,
    });

    return await buildAttemptResponse(anonymousAttempt, dateKey);
  }

  const attempt = await db.gameAttempt.findFirst({
    where: {
      puzzleDate: dateKey,
      player: {
        externalId: session.user.id,
      },
    },
    select: attemptSelect,
  });

  return await buildAttemptResponse(attempt, dateKey);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  let body: GuessBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const guess = typeof body.guess === "string" ? body.guess.trim() : "";
  const dateKey = sanitizeDateKey(
    typeof body.dateKey === "string" ? body.dateKey : null,
  );
  const anonymousId = sanitizeAnonymousId(
    typeof body.anonymousId === "string" ? body.anonymousId : null,
  );

  if (!guess) {
    return NextResponse.json({ error: "Guess is required." }, { status: 400 });
  }

  let puzzle: Puzzle;
  try {
    puzzle = await getRequiredPuzzleFromDateKey(dateKey);
  } catch {
    return NextResponse.json(
      { error: "No puzzle is configured for that date yet." },
      { status: 503 },
    );
  }
  if (!session?.user?.id) {
    if (!anonymousId) {
      return NextResponse.json(
        { error: "anonymousId is required for anonymous guesses." },
        { status: 400 },
      );
    }

    const attempt = await db.gameAttempt.upsert({
      where: {
        anonymousId_puzzleDate: {
          anonymousId,
          puzzleDate: dateKey,
        },
      },
      create: {
        anonymousId,
        puzzleDate: dateKey,
      },
      update: {},
      select: attemptSelect,
    });

    return submitGuessToAttempt({ attempt, guess, puzzle });
  }

  const player = await db.player.upsert({
    where: {
      externalId: session.user.id,
    },
    create: {
      externalId: session.user.id,
      displayName: session.user.name ?? null,
    },
    update: {},
  });

  const attempt = await db.gameAttempt.upsert({
    where: {
      playerId_puzzleDate: {
        playerId: player.id,
        puzzleDate: dateKey,
      },
    },
    create: {
      playerId: player.id,
      puzzleDate: dateKey,
    },
    update: {},
    select: attemptSelect,
  });

  return submitGuessToAttempt({ attempt, guess, puzzle });
}

async function submitGuessToAttempt(input: {
  attempt: {
    id: string;
    solved: boolean;
    gaveUp: boolean;
    guesses: Array<{
      guess: string;
      score: number;
      verdict: string;
      reason: string;
      correct: boolean;
      position: number;
    }>;
  };
  guess: string;
  puzzle: Puzzle;
}) {
  const existingResults = parseAttemptGuesses(input.attempt.guesses);
  if (input.attempt.gaveUp) {
    return NextResponse.json(
      { error: "You already gave up today's puzzle." },
      { status: 409 },
    );
  }

  if (input.attempt.solved || existingResults.some((entry) => entry.correct)) {
    return NextResponse.json(
      { error: "You already solved today's puzzle." },
      { status: 409 },
    );
  }

  let judgment: Awaited<ReturnType<typeof scoreGuessWithOpenRouter>>;
  try {
    judgment = await scoreGuessWithOpenRouter({
      guess: input.guess,
      puzzle: input.puzzle,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to judge guess right now. Try again." },
      { status: 502 },
    );
  }

  const correct = judgment.verdict === "correct";
  const nextGuess: AttemptGuess = {
    guess: input.guess,
    score: judgment.score,
    verdict: judgment.verdict,
    reason: judgment.reason,
    correct,
  };
  const triesUsed = existingResults.length + 1;

  await db.$transaction([
    db.guess.create({
      data: buildGuessCreateData({
        attemptId: input.attempt.id,
        position: triesUsed,
        guess: nextGuess,
      }),
    }),
    db.gameAttempt.update({
      where: {
        id: input.attempt.id,
      },
      data: {
        gaveUp: false,
        solved: correct,
        solvedIn: correct ? triesUsed : null,
      },
    }),
  ]);

  return NextResponse.json({
    correct,
    score: judgment.score,
    verdict: judgment.verdict,
    reason: judgment.reason,
    triesUsed,
    noTriesLeft: false,
    gaveUp: false,
    saved: true,
  });
}

async function buildAttemptResponse(
  attempt:
    | {
        solved: boolean;
        gaveUp: boolean;
        guesses: Array<{
          guess: string;
          score: number;
          verdict: string;
          reason: string;
          correct: boolean;
          position: number;
        }>;
      }
    | null,
  dateKey: string,
) {
  const results = attempt ? parseAttemptGuesses(attempt.guesses) : [];
  const triesUsed = results.length;
  const isSolved = Boolean(attempt?.solved) || results.some((entry) => entry.correct);
  const gaveUp = Boolean(attempt?.gaveUp);
  const puzzle = await getDailyPuzzleFromDateKey(dateKey);

  return NextResponse.json({
    results,
    triesUsed,
    isSolved,
    gaveUp,
    revealedAnswer: gaveUp ? puzzle?.answer ?? null : null,
    noTriesLeft: false,
  });
}

function sanitizeDateKey(input: string | null): string {
  if (!input) {
    return getDateKey();
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : getDateKey();
}

function sanitizeAnonymousId(input: string | null): string | null {
  if (!input) {
    return null;
  }

  const normalized = input.trim();
  if (!normalized) {
    return null;
  }

  return /^[a-zA-Z0-9_-]{6,128}$/.test(normalized) ? normalized : null;
}
