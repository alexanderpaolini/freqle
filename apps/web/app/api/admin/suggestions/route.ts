import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

type SuggestionDeleteBody = {
  id?: unknown;
};

export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) {
    return auth.response;
  }

  const rows = await db.suggestion.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 300,
    select: {
      id: true,
      dateKey: true,
      puzzleId: true,
      text: true,
      createdAt: true,
      player: {
        select: {
          displayName: true,
          externalId: true,
        },
      },
    },
  });

  const suggestions = rows.map((row) => ({
    id: row.id,
    dateKey: row.dateKey,
    puzzleId: row.puzzleId,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
    playerName: row.player?.displayName ?? null,
    playerExternalId: row.player?.externalId ?? null,
  }));

  return NextResponse.json({ suggestions });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) {
    return auth.response;
  }

  let body: SuggestionDeleteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const id = normalizeSuggestionId(body.id);
  if (!id) {
    return NextResponse.json(
      { error: "id is required." },
      { status: 400 },
    );
  }

  try {
    await db.suggestion.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      return NextResponse.json(
        { error: "Suggestion not found." },
        { status: 404 },
      );
    }

    throw error;
  }
}

async function requireAdmin():
  Promise<{ playerId: string } | { response: NextResponse }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
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
    select: {
      id: true,
      isAdmin: true,
    },
  });

  if (!player.isAdmin) {
    return {
      response: NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      ),
    };
  }

  return { playerId: player.id };
}

function normalizeSuggestionId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > 120) {
    return null;
  }

  return normalized;
}

function isPrismaErrorCode(error: unknown, code: string): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}
