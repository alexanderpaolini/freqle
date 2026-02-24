import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import {
  parseAttemptGuesses,
  toAttemptGuessesJson,
  type AttemptGuess,
} from "@/lib/attempts";
import { db } from "@/lib/db";
import { scoreGuessWithOpenRouter } from "@/lib/openrouter";
import { getDailyPuzzleFromDateKey, getDateKey } from "@/lib/puzzles";

type SyncBody = {
  dateKey?: unknown;
  guesses?: unknown;
  anonymousId?: unknown;
};

const attemptSelect = {
  id: true,
  playerId: true,
  anonymousId: true,
  solved: true,
  gaveUp: true,
  solvedIn: true,
  guesses: true,
} as const;

type AttemptRecord = {
  id: string;
  playerId: string | null;
  anonymousId: string | null;
  solved: boolean;
  gaveUp: boolean;
  solvedIn: number | null;
  guesses: unknown;
};

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
        .filter(Boolean)
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
        guesses: toAttemptGuessesJson([]),
      },
      update: {},
      select: attemptSelect,
    }));

  if (attempt.gaveUp) {
    const existingGuesses = parseAttemptGuesses(attempt.guesses);
    return NextResponse.json({
      results: existingGuesses,
      triesUsed: existingGuesses.length,
      isSolved: false,
      gaveUp: true,
      noTriesLeft: false,
    });
  }

  const existingGuesses = parseAttemptGuesses(attempt.guesses);
  let triesUsed = existingGuesses.length;
  let solved = attempt.solved || existingGuesses.some((entry) => entry.correct);
  const puzzle = getDailyPuzzleFromDateKey(dateKey);
  const pendingGuesses = incomingGuesses.slice(triesUsed);
  const nextGuesses = [...existingGuesses];

  for (const guess of pendingGuesses) {
    if (solved) {
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

    const correct = judgment.verdict === "correct";
    nextGuesses.push({
      guess,
      score: judgment.score,
      verdict: judgment.verdict,
      reason: judgment.reason,
      correct,
    });
    triesUsed += 1;

    if (correct) {
      solved = true;
      break;
    }
  }

  const solvedIndex = nextGuesses.findIndex((entry) => entry.correct);
  const solvedIn = solvedIndex >= 0 ? solvedIndex + 1 : null;

  if (
    nextGuesses.length !== existingGuesses.length ||
    solved !== attempt.solved ||
    (solved && solvedIn !== attempt.solvedIn)
  ) {
    await db.gameAttempt.update({
      where: {
        id: attempt.id,
      },
      data: {
        guesses: toAttemptGuessesJson(nextGuesses),
        gaveUp: false,
        solved,
        solvedIn: solved ? solvedIn : null,
      },
    });
  }

  const refreshedTries = nextGuesses.length;
  const isSolved = solved;

  return NextResponse.json({
    results: nextGuesses,
    triesUsed: refreshedTries,
    isSolved,
    gaveUp: false,
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
      select: attemptSelect,
    }),
    db.gameAttempt.findUnique({
      where: {
        anonymousId_puzzleDate: {
          anonymousId,
          puzzleDate,
        },
      },
      select: attemptSelect,
    }),
  ]);

  if (!anonymousAttempt) {
    return playerAttempt;
  }

  if (anonymousAttempt.playerId === playerId) {
    if (anonymousAttempt.anonymousId) {
      return db.gameAttempt.update({
        where: {
          id: anonymousAttempt.id,
        },
        data: {
          anonymousId: null,
        },
        select: attemptSelect,
      });
    }

    return anonymousAttempt;
  }

  if (anonymousAttempt.playerId && anonymousAttempt.playerId !== playerId) {
    return playerAttempt;
  }

  if (!playerAttempt) {
    return db.gameAttempt.update({
      where: {
        id: anonymousAttempt.id,
      },
      data: {
        playerId,
        anonymousId: null,
      },
      select: attemptSelect,
    });
  }

  const merged = mergeAttemptStates(playerAttempt, anonymousAttempt);
  return db.$transaction(async (transaction) => {
    const updatedPlayerAttempt = await transaction.gameAttempt.update({
      where: {
        id: playerAttempt.id,
      },
      data: {
        guesses: toAttemptGuessesJson(merged.guesses),
        solved: merged.solved,
        gaveUp: merged.gaveUp,
        solvedIn: merged.solved ? merged.solvedIn : null,
      },
      select: attemptSelect,
    });

    await transaction.gameAttempt.delete({
      where: {
        id: anonymousAttempt.id,
      },
    });

    return updatedPlayerAttempt;
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
  const gaveUp = solved ? false : linkedSummary.gaveUp || anonymousSummary.gaveUp;

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
