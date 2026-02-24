import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { parseAttemptGuesses } from "@/lib/attempts";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDateKey } from "@/lib/puzzles";
import { generateShareCode, normalizeShareCode } from "@/lib/share";

type CreateShareBody = {
  dateKey?: unknown;
  localSolved?: unknown;
  localTries?: unknown;
};

const MAX_CREATE_ATTEMPTS = 8;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "You must be signed in to create a share link." },
      { status: 401 },
    );
  }

  let body: CreateShareBody = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const dateKey = sanitizeDateKey(
    typeof body.dateKey === "string" ? body.dateKey : null,
  );
  const localSolved = body.localSolved === true;
  const localTries = normalizeLocalTries(body.localTries);

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

  let attempt = await db.gameAttempt.findUnique({
    where: {
      playerId_puzzleDate: {
        playerId: player.id,
        puzzleDate: dateKey,
      },
    },
    select: {
      id: true,
      solved: true,
      gaveUp: true,
      solvedIn: true,
      guesses: true,
      shareCode: true,
    },
  });

  if (!attempt || (!attempt.solved && !attempt.gaveUp)) {
    if (!localSolved || !localTries) {
      return NextResponse.json(
        { error: "Solve today's puzzle before generating a share link." },
        { status: 400 },
      );
    }

    attempt = await db.gameAttempt.upsert({
      where: {
        playerId_puzzleDate: {
          playerId: player.id,
          puzzleDate: dateKey,
        },
      },
      create: {
        playerId: player.id,
        puzzleDate: dateKey,
        gaveUp: false,
        solved: true,
        solvedIn: localTries,
      },
      update: {
        gaveUp: false,
        solved: true,
        solvedIn: localTries,
      },
      select: {
        id: true,
        solved: true,
        gaveUp: true,
        solvedIn: true,
        guesses: true,
        shareCode: true,
      },
    });
  }

  const guessedEntries = parseAttemptGuesses(attempt.guesses);
  const tries = attempt.solvedIn ?? guessedEntries.length;
  if (tries < 1) {
    return NextResponse.json(
      { error: "Solve today's puzzle before generating a share link." },
      { status: 400 },
    );
  }

  let shareCode = normalizeShareCode(attempt.shareCode);
  if (!shareCode) {
    shareCode = await assignShareCode(attempt.id);
    if (!shareCode) {
      return NextResponse.json(
        { error: "Could not generate a unique share link. Try again." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ shareId: shareCode, tries, dateKey });
}

function sanitizeDateKey(input: string | null): string {
  if (!input) {
    return getDateKey();
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : getDateKey();
}

function normalizeLocalTries(input: unknown): number | null {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return null;
  }

  const value = Math.floor(input);
  return value >= 1 && value <= 10_000 ? value : null;
}

async function assignShareCode(attemptId: string): Promise<string | null> {
  for (let index = 0; index < MAX_CREATE_ATTEMPTS; index += 1) {
    const code = generateShareCode();

    try {
      const updated = await db.gameAttempt.update({
        where: {
          id: attemptId,
        },
        data: {
          shareCode: code,
        },
      });
      return normalizeShareCode(updated.shareCode);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }

  return null;
}
