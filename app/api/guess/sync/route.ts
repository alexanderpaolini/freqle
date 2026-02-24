import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import {
  buildGuessCreateData,
  parseAttemptGuesses,
  type AttemptGuess,
} from "@/lib/attempts";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ATTEMPT_LIMIT, GUESS_MAX_LENGTH } from "@/lib/game-limits";
import { scoreGuessWithOpenRouter } from "@/lib/openrouter";
import {
  getDateKey,
  getRequiredPuzzleFromDateKey,
  type Puzzle,
} from "@/lib/puzzles";

type SyncBody = {
  dateKey?: unknown;
  guesses?: unknown;
  anonymousId?: unknown;
};

type DbTransactionClient = Omit<
  typeof db,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

type AttemptRecord = {
  id: string;
  playerId: string | null;
  anonymousId: string | null;
  solved: boolean;
  gaveUp: boolean;
  solvedIn: number | null;
  guesses: Array<{
    guess: string;
    score: number;
    verdict: string;
    reason: string;
    correct: boolean;
    position: number;
  }>;
};

const attemptInclude = {
  guesses: {
    orderBy: {
      position: "asc",
    },
    select: {
      guess: true,
      score: true,
      verdict: true,
      reason: true,
      correct: true,
      position: true,
    },
  },
} as const;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "You must be signed in to sync attempts." },
      { status: 401 },
    );
  }

  let body: SyncBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const dateKey = sanitizeDateKey(
    typeof body.dateKey === "string" ? body.dateKey : null,
  );
  const anonymousId = sanitizeAnonymousId(
    typeof body.anonymousId === "string" ? body.anonymousId : null,
  );
  const incomingGuesses = Array.isArray(body.guesses)
    ? body.guesses
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0 && entry.length <= GUESS_MAX_LENGTH)
    : [];

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

  const claimedAttempt = await claimAnonymousAttempt({
    playerId: player.id,
    puzzleDate: dateKey,
    anonymousId,
  });

  if (!claimedAttempt && incomingGuesses.length === 0) {
    return NextResponse.json({
      results: [],
      triesUsed: 0,
      isSolved: false,
      gaveUp: false,
      noTriesLeft: false,
    });
  }

  const attempt =
    claimedAttempt ??
    (await db.gameAttempt.upsert({
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
      include: attemptInclude,
    }));

  const existingGuesses = parseAttemptGuesses(attempt.guesses);
  if (attempt.gaveUp) {
    return NextResponse.json({
      results: existingGuesses,
      triesUsed: existingGuesses.length,
      isSolved: false,
      gaveUp: true,
      noTriesLeft: existingGuesses.length >= ATTEMPT_LIMIT,
    });
  }

  if (existingGuesses.length >= ATTEMPT_LIMIT) {
    return NextResponse.json({
      results: existingGuesses,
      triesUsed: existingGuesses.length,
      isSolved: attempt.solved || existingGuesses.some((entry) => entry.correct),
      gaveUp: false,
      noTriesLeft: true,
    });
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
  let solved = attempt.solved || existingGuesses.some((entry) => entry.correct);
  const pendingGuesses = incomingGuesses.slice(existingGuesses.length);
  const nextGuesses = [...existingGuesses];
  const judgedGuesses: AttemptGuess[] = [];

  for (const guess of pendingGuesses) {
    if (solved || nextGuesses.length >= ATTEMPT_LIMIT) {
      break;
    }

    let judgment: Awaited<ReturnType<typeof scoreGuessWithOpenRouter>>;
    try {
      judgment = await scoreGuessWithOpenRouter({ guess, puzzle });
    } catch {
      return NextResponse.json(
        { error: "Unable to judge local guesses right now. Try again." },
        { status: 502 },
      );
    }

    const judgedGuess: AttemptGuess = {
      guess,
      score: judgment.score,
      verdict: judgment.verdict,
      reason: judgment.reason,
      correct: judgment.verdict === "correct",
    };

    nextGuesses.push(judgedGuess);
    judgedGuesses.push(judgedGuess);
    if (judgedGuess.correct) {
      solved = true;
      break;
    }
  }

  const solvedIndex = nextGuesses.findIndex((entry) => entry.correct);
  const solvedIn = solvedIndex >= 0 ? solvedIndex + 1 : null;
  const shouldUpdateAttempt =
    solved !== attempt.solved ||
    (solved && solvedIn !== attempt.solvedIn) ||
    judgedGuesses.length > 0;

  if (shouldUpdateAttempt) {
    await db.$transaction(async (transaction: DbTransactionClient) => {
      if (judgedGuesses.length > 0) {
        await transaction.guess.createMany({
          data: judgedGuesses.map((entry, index) =>
            buildGuessCreateData({
              attemptId: attempt.id,
              position: existingGuesses.length + index + 1,
              guess: entry,
            }),
          ),
        });
      }

      await transaction.gameAttempt.update({
        where: {
          id: attempt.id,
        },
        data: {
          gaveUp: false,
          solved,
          solvedIn: solved ? solvedIn : null,
        },
      });
    });
  }

  return NextResponse.json({
    results: nextGuesses,
    triesUsed: nextGuesses.length,
    isSolved: solved,
    gaveUp: false,
    noTriesLeft: nextGuesses.length >= ATTEMPT_LIMIT,
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

async function claimAnonymousAttempt(input: {
  playerId: string;
  puzzleDate: string;
  anonymousId: string | null;
}): Promise<AttemptRecord | null> {
  const { playerId, puzzleDate, anonymousId } = input;
  if (!anonymousId) {
    return null;
  }

  const [playerAttempt, anonymousAttempt] = await Promise.all([
    db.gameAttempt.findUnique({
      where: {
        playerId_puzzleDate: {
          playerId,
          puzzleDate,
        },
      },
      include: attemptInclude,
    }),
    db.gameAttempt.findUnique({
      where: {
        anonymousId_puzzleDate: {
          anonymousId,
          puzzleDate,
        },
      },
      include: attemptInclude,
    }),
  ]);

  if (!anonymousAttempt) {
    return playerAttempt as AttemptRecord | null;
  }

  if (anonymousAttempt.playerId === playerId) {
    if (anonymousAttempt.anonymousId) {
      const linkedAttempt = await db.gameAttempt.update({
        where: {
          id: anonymousAttempt.id,
        },
        data: {
          anonymousId: null,
        },
        include: attemptInclude,
      });
      return linkedAttempt as AttemptRecord;
    }

    return anonymousAttempt as AttemptRecord;
  }

  if (anonymousAttempt.playerId && anonymousAttempt.playerId !== playerId) {
    return playerAttempt as AttemptRecord | null;
  }

  if (!playerAttempt) {
    const claimedAttempt = await db.gameAttempt.update({
      where: {
        id: anonymousAttempt.id,
      },
      data: {
        playerId,
        anonymousId: null,
      },
      include: attemptInclude,
    });
    return claimedAttempt as AttemptRecord;
  }

  const merged = mergeAttemptStates(
    playerAttempt as AttemptRecord,
    anonymousAttempt as AttemptRecord,
  );

  return db.$transaction(async (transaction: DbTransactionClient) => {
    await transaction.guess.deleteMany({
      where: {
        attemptId: playerAttempt.id,
      },
    });

    if (merged.guesses.length > 0) {
      await transaction.guess.createMany({
        data: merged.guesses.map((entry, index) =>
          buildGuessCreateData({
            attemptId: playerAttempt.id,
            position: index + 1,
            guess: entry,
          }),
        ),
      });
    }

    const updatedPlayerAttempt = await transaction.gameAttempt.update({
      where: {
        id: playerAttempt.id,
      },
      data: {
        solved: merged.solved,
        gaveUp: merged.gaveUp,
        solvedIn: merged.solved ? merged.solvedIn : null,
      },
      include: attemptInclude,
    });

    await transaction.gameAttempt.delete({
      where: {
        id: anonymousAttempt.id,
      },
    });

    return updatedPlayerAttempt as AttemptRecord;
  });
}

function mergeAttemptStates(
  linkedAttempt: AttemptRecord,
  anonymousAttempt: AttemptRecord,
): {
  guesses: AttemptGuess[];
  solved: boolean;
  gaveUp: boolean;
  solvedIn: number | null;
} {
  const linkedGuesses = parseAttemptGuesses(linkedAttempt.guesses);
  const anonymousGuesses = parseAttemptGuesses(anonymousAttempt.guesses);
  const linkedSummary = summarizeAttempt(linkedAttempt, linkedGuesses);
  const anonymousSummary = summarizeAttempt(anonymousAttempt, anonymousGuesses);

  let selectedGuesses = linkedGuesses;
  if (anonymousSummary.solved && !linkedSummary.solved) {
    selectedGuesses = anonymousGuesses;
  } else if (anonymousSummary.solved && linkedSummary.solved) {
    const linkedSolvedIn = linkedSummary.solvedIn ?? Number.MAX_SAFE_INTEGER;
    const anonymousSolvedIn =
      anonymousSummary.solvedIn ?? Number.MAX_SAFE_INTEGER;
    if (anonymousSolvedIn < linkedSolvedIn) {
      selectedGuesses = anonymousGuesses;
    }
  } else if (
    !linkedSummary.solved &&
    !anonymousSummary.solved &&
    anonymousGuesses.length > linkedGuesses.length
  ) {
    selectedGuesses = anonymousGuesses;
  }

  const solvedIndex = selectedGuesses.findIndex((entry) => entry.correct);
  const solved = linkedSummary.solved || anonymousSummary.solved;
  const solvedIn = solved
    ? solvedIndex >= 0
      ? solvedIndex + 1
      : linkedSummary.solvedIn ?? anonymousSummary.solvedIn ?? null
    : null;
  const gaveUp = solved
    ? false
    : linkedSummary.gaveUp || anonymousSummary.gaveUp;

  return {
    guesses: selectedGuesses,
    solved,
    gaveUp,
    solvedIn,
  };
}

function summarizeAttempt(attempt: AttemptRecord, guesses: AttemptGuess[]) {
  const solvedIndex = guesses.findIndex((entry) => entry.correct);
  const solvedFromGuesses = solvedIndex >= 0;
  const solved = attempt.solved || solvedFromGuesses;
  const solvedIn = solved
    ? solvedIndex >= 0
      ? solvedIndex + 1
      : attempt.solvedIn
    : null;

  return {
    solved,
    solvedIn,
    gaveUp: attempt.gaveUp,
  };
}
