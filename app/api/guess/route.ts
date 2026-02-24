import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { parseAttemptGuesses, toAttemptGuessesJson } from "@/lib/attempts";
import { db } from "@/lib/db";
import { scoreGuessWithOpenRouter } from "@/lib/openrouter";
import { getDailyPuzzleFromDateKey, getDateKey } from "@/lib/puzzles";

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
      revealedAnswer: null,
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
  const puzzle = getDailyPuzzleFromDateKey(dateKey);

  return NextResponse.json({
    results,
    triesUsed,
    isSolved,
    gaveUp,
    revealedAnswer: gaveUp ? puzzle.solutionLabel : null,
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
  if (!session?.user?.id) {
    try {
      const judgment = await scoreGuessWithOpenRouter({ guess, puzzle });
      const correct = judgment.verdict === "correct";
      return NextResponse.json({
        correct,
        score: judgment.score,
        verdict: judgment.verdict,
        reason: judgment.reason,
        gaveUp: false,
        saved: false,
      });
    } catch {
      return NextResponse.json(
        { error: "Unable to judge guess right now. Try again." },
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
      { error: "You already solved today's puzzle." },
      { status: 409 },
    );
  }

  let judgment: Awaited<ReturnType<typeof scoreGuessWithOpenRouter>>;
  try {
    judgment = await scoreGuessWithOpenRouter({ guess, puzzle });
  } catch {
    return NextResponse.json(
      { error: "Unable to judge guess right now. Try again." },
      { status: 502 },
    );
  }

  const correct = judgment.verdict === "correct";
  const nextResults = [
    ...existingResults,
    {
      guess,
      score: judgment.score,
      verdict: judgment.verdict,
      reason: judgment.reason,
      correct,
    },
  ];
  const triesUsed = nextResults.length;

  await db.gameAttempt.update({
    where: {
      id: attempt.id,
    },
    data: {
      guesses: toAttemptGuessesJson(nextResults),
      gaveUp: false,
      solved: correct,
      solvedIn: correct ? triesUsed : null,
    },
  });

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

function sanitizeDateKey(input: string | null): string {
  if (!input) {
    return getDateKey();
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : getDateKey();
}
