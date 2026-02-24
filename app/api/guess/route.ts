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

type GuessBody = {
  guess?: unknown;
  dateKey?: unknown;
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const url = new URL(request.url);
  const dateKey = sanitizeDateKey(url.searchParams.get("dateKey"));

  if (!session?.user?.id) {
    return NextResponse.json({
      results: [],
      triesUsed: 0,
      isSolved: false,
      gaveUp: false,
      noTriesLeft: false,
    });
  }

  const attempt = await db.gameAttempt.findFirst({
    where: {
      puzzleDate: dateKey,
      player: {
        externalId: session.user.id,
      },
    },
    select: {
      solved: true,
      gaveUp: true,
      guesses: true,
    },
  });

  const results = attempt ? parseAttemptGuesses(attempt.guesses) : [];
  const triesUsed = results.length;
  const isSolved =
    Boolean(attempt?.solved) || results.some((entry) => entry.correct);
  const gaveUp = Boolean(attempt?.gaveUp);

  return NextResponse.json({
    results,
    triesUsed,
    isSolved,
    gaveUp,
    noTriesLeft: false,
  });
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

  if (!guess) {
    return NextResponse.json({ error: "Guess is required." }, { status: 400 });
  }

  const puzzle = getDailyPuzzleFromDateKey(dateKey);
  const correct = isCorrectGuess(puzzle, guess);

  if (!session?.user?.id) {
    if (correct) {
      return NextResponse.json({
        correct: true,
        score: 100,
        verdict: "correct",
        gaveUp: false,
        saved: false,
      });
    }

    try {
      const scoreResult = await scoreGuessWithOpenRouter({ guess, puzzle });
      return NextResponse.json({
        correct: false,
        score: scoreResult.score,
        verdict: "incorrect",
        gaveUp: false,
        saved: false,
      });
    } catch {
      return NextResponse.json(
        { error: "Unable to score guess right now. Try again." },
        { status: 502 },
      );
    }
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

  const existingResults = parseAttemptGuesses(attempt.guesses);

  if (attempt.gaveUp) {
    return NextResponse.json(
      { error: "You already gave up today's puzzle." },
      { status: 409 },
    );
  }

  if (attempt.solved || existingResults.some((entry) => entry.correct)) {
    return NextResponse.json(
      { error: "Today is already solved on this account." },
      { status: 409 },
    );
  }

  let score = 100;

  if (!correct) {
    try {
      const scoreResult = await scoreGuessWithOpenRouter({ guess, puzzle });
      score = scoreResult.score;
    } catch {
      return NextResponse.json(
        { error: "Unable to score guess right now. Try again." },
        { status: 502 },
      );
    }
  }

  const nextResults = [...existingResults, { guess, score, correct }];
  const triesUsed = nextResults.length;

  await db.gameAttempt.update({
    where: {
      id: attempt.id,
    },
    data: {
      guesses: toAttemptGuessesJson(nextResults),
      gaveUp: false,
      solved: correct ? true : attempt.solved,
      solvedIn: correct ? triesUsed : attempt.solvedIn,
    },
  });

  return NextResponse.json({
    correct,
    score,
    verdict: correct ? "correct" : "incorrect",
    triesUsed,
    noTriesLeft: false,
    gaveUp: false,
    saved: true,
  });
}

function sanitizeDateKey(input: string | null): string {
  if (!input) {
    return getDateKey();
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : getDateKey();
}
