import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDailyPuzzleFromDateKey, getDateKey } from "@/lib/puzzles";

type GiveUpBody = {
  dateKey?: unknown;
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "You must be signed in to give up." },
      { status: 401 },
    );
  }

  let body: GiveUpBody = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const dateKey = sanitizeDateKey(
    typeof body.dateKey === "string" ? body.dateKey : null,
  );
  const puzzle = getDailyPuzzleFromDateKey(dateKey);

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

  const existingAttempt = await db.gameAttempt.findUnique({
    where: {
      playerId_puzzleDate: {
        playerId: player.id,
        puzzleDate: dateKey,
      },
    },
    select: {
      solved: true,
      gaveUp: true,
    },
  });

  if (existingAttempt?.solved) {
    return NextResponse.json(
      { error: "Today's puzzle is already solved." },
      { status: 409 },
    );
  }

  if (existingAttempt?.gaveUp) {
    return NextResponse.json({
      gaveUp: true,
      isSolved: false,
      revealedAnswer: puzzle.solutionLabel,
    });
  }

  if (existingAttempt) {
    await db.gameAttempt.update({
      where: {
        playerId_puzzleDate: {
          playerId: player.id,
          puzzleDate: dateKey,
        },
      },
      data: {
        gaveUp: true,
        solved: false,
        solvedIn: null,
      },
    });
  } else {
    await db.gameAttempt.create({
      data: {
        playerId: player.id,
        puzzleDate: dateKey,
        gaveUp: true,
        solved: false,
        solvedIn: null,
      },
    });
  }

  return NextResponse.json({
    gaveUp: true,
    isSolved: false,
    revealedAnswer: puzzle.solutionLabel,
  });
}

function sanitizeDateKey(input: string | null): string {
  if (!input) {
    return getDateKey();
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : getDateKey();
}
