import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDailyPuzzleFromDateKey, getDateKey } from "@/lib/puzzles";

type CreateSuggestionBody = {
  text?: unknown;
  dateKey?: unknown;
};

const MIN_SUGGESTION_LENGTH = 6;
const MAX_SUGGESTION_LENGTH = 600;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  let body: CreateSuggestionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const dateKey = sanitizeDateKey(
    typeof body.dateKey === "string" ? body.dateKey : null,
  );

  if (text.length < MIN_SUGGESTION_LENGTH) {
    return NextResponse.json(
      { error: `Suggestion must be at least ${MIN_SUGGESTION_LENGTH} characters.` },
      { status: 400 },
    );
  }

  if (text.length > MAX_SUGGESTION_LENGTH) {
    return NextResponse.json(
      { error: `Suggestion must be ${MAX_SUGGESTION_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }

  let playerId: string | null = null;
  if (session?.user?.id) {
    const player = await db.player.upsert({
      where: {
        externalId: session.user.id,
      },
      create: {
        externalId: session.user.id,
        displayName: session.user.name ?? null,
      },
      update: {},
      select: {
        id: true,
      },
    });
    playerId = player.id;
  }

  const puzzleId = getDailyPuzzleFromDateKey(dateKey).id;
  await db.suggestion.create({
    data: {
      playerId,
      dateKey,
      puzzleId,
      text,
    },
  });

  return NextResponse.json({ saved: true });
}

function sanitizeDateKey(input: string | null): string {
  if (!input) {
    return getDateKey();
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : getDateKey();
}
