import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { parseAttemptGuesses, toAttemptGuessesJson } from "@/lib/attempts";
import { db } from "@/lib/db";
import { scoreGuessWithOpenRouter } from "@/lib/openrouter";
import {
  getDailyPuzzleFromDateKey,
  getDateKey,
  isCorrectGuess,
} from "@/lib/puzzles";

type SyncBody = {
  dateKey?: unknown;
  guesses?: unknown;
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
      guesses: toAttemptGuessesJson([]),
    },
    update: {},
    select: {
      id: true,
      solved: true,
      gaveUp: true,
      solvedIn: true,
      guesses: true,
    },
  });

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

    const correct = isCorrectGuess(puzzle, guess);
    let score = 100;

    if (!correct) {
      try {
        const scoreResult = await scoreGuessWithOpenRouter({ guess, puzzle });
        score = scoreResult.score;
      } catch {
        return NextResponse.json(
          { error: "Unable to sync local guesses right now. Try again." },
          { status: 502 },
        );
      }
    }

    nextGuesses.push({ guess, score, correct });
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
