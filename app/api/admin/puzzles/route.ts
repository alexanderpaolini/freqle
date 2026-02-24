import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { parsePuzzleData } from "@/lib/puzzles";

type PuzzleWriteBody = {
  key?: unknown;
  dateKey?: unknown;
  answer?: unknown;
  data?: unknown;
};

type PuzzleUpdateBody = PuzzleWriteBody & {
  targetKey?: unknown;
};

type PuzzleDeleteBody = {
  key?: unknown;
};

const KEY_PATTERN = /^[a-zA-Z0-9_-]{1,120}$/;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) {
    return auth.response;
  }

  const rows = await db.puzzle.findMany({
    orderBy: {
      dateKey: "desc",
    },
    select: {
      key: true,
      dateKey: true,
      answer: true,
      data: true,
    },
  });

  const puzzles = rows
    .map((row) => {
      const data = parsePuzzleData(row.data);
      if (!data) {
        return null;
      }

      return {
        key: row.key,
        dateKey: row.dateKey,
        answer: row.answer,
        data,
      };
    })
    .filter((entry): entry is { key: string; dateKey: string; answer: string; data: Record<number, number> } => entry !== null);

  return NextResponse.json({ puzzles });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) {
    return auth.response;
  }

  let body: PuzzleWriteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = parsePuzzleWriteBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const created = await db.puzzle.create({
      data: parsed.value,
      select: {
        key: true,
        dateKey: true,
        answer: true,
        data: true,
      },
    });

    return NextResponse.json({
      puzzle: {
        key: created.key,
        dateKey: created.dateKey,
        answer: created.answer,
        data: parsePuzzleData(created.data) ?? parsed.value.data,
      },
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      return NextResponse.json(
        { error: "Puzzle key or date already exists." },
        { status: 409 },
      );
    }

    throw error;
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) {
    return auth.response;
  }

  let body: PuzzleUpdateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const targetKey = normalizeKey(body.targetKey);
  if (!targetKey) {
    return NextResponse.json({ error: "targetKey is required." }, { status: 400 });
  }

  const parsed = parsePuzzleWriteBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const updated = await db.puzzle.update({
      where: {
        key: targetKey,
      },
      data: parsed.value,
      select: {
        key: true,
        dateKey: true,
        answer: true,
        data: true,
      },
    });

    return NextResponse.json({
      puzzle: {
        key: updated.key,
        dateKey: updated.dateKey,
        answer: updated.answer,
        data: parsePuzzleData(updated.data) ?? parsed.value.data,
      },
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      return NextResponse.json({ error: "Puzzle not found." }, { status: 404 });
    }

    if (isPrismaErrorCode(error, "P2002")) {
      return NextResponse.json(
        { error: "Puzzle key or date already exists." },
        { status: 409 },
      );
    }

    throw error;
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) {
    return auth.response;
  }

  let body: PuzzleDeleteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const key = normalizeKey(body.key);
  if (!key) {
    return NextResponse.json({ error: "key is required." }, { status: 400 });
  }

  try {
    await db.puzzle.delete({
      where: {
        key,
      },
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      return NextResponse.json({ error: "Puzzle not found." }, { status: 404 });
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

function parsePuzzleWriteBody(
  body: PuzzleWriteBody,
):
  | {
      value: {
        key: string;
        dateKey: string;
        answer: string;
        data: Record<number, number>;
      };
    }
  | { error: string } {
  const key = normalizeKey(body.key);
  if (!key) {
    return { error: "key is required and may only contain letters, numbers, _ and -." };
  }

  const dateKey = normalizeDateKey(body.dateKey);
  if (!dateKey) {
    return { error: "dateKey is required (YYYY-MM-DD)." };
  }

  const answer = normalizeAnswer(body.answer);
  if (!answer) {
    return { error: "answer is required." };
  }

  const data = parsePuzzleData(body.data);
  if (!data) {
    return {
      error:
        "data must be a non-empty JSON object where keys are integers and values are non-negative integers.",
    };
  }

  return {
    value: {
      key,
      dateKey,
      answer,
      data,
    },
  };
}

function normalizeKey(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized || !KEY_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeDateKey(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!DATE_KEY_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeAnswer(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function isPrismaErrorCode(error: unknown, code: string): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === code,
  );
}
