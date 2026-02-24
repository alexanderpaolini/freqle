import { db } from "@/lib/db";

export type Puzzle = {
  id: string;
  preview: Record<number, number>;
  solutionLabel: string;
  answer: string;
  acceptedAnswers: string[];
};

const puzzleSelect = {
  id: true,
  preview: true,
  solutionLabel: true,
  answer: true,
  acceptedAnswers: true,
} as const;

export function getDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function getDailyPuzzle(date = new Date()): Promise<Puzzle | null> {
  return getDailyPuzzleFromDateKey(getDateKey(date));
}

export async function getDailyPuzzleFromDateKey(
  dateKey?: string,
): Promise<Puzzle | null> {
  const normalizedDateKey = sanitizeDateKey(dateKey) ?? getDateKey();

  const exact = await db.dailyPuzzle.findUnique({
    where: {
      dateKey: normalizedDateKey,
    },
    select: {
      puzzle: {
        select: puzzleSelect,
      },
    },
  });

  return parsePuzzle(exact?.puzzle);
}

export async function getRequiredPuzzleFromDateKey(
  dateKey?: string,
): Promise<Puzzle> {
  const puzzle = await getDailyPuzzleFromDateKey(dateKey);
  if (puzzle) {
    return puzzle;
  }

  throw new Error(
    "No puzzles are configured in the database. Run `pnpm puzzle:upsert-day -- --date YYYY-MM-DD --preset month-day-counts` first.",
  );
}

export function getPuzzlePreviewEntries(
  puzzle: Puzzle,
): Array<{ key: string; value: string }> {
  return Object.entries(puzzle.preview)
    .map(([key, value]) => ({
      numericKey: Number(key),
      key: String(key),
      value: String(value),
    }))
    .sort((left, right) => left.numericKey - right.numericKey)
    .map(({ key, value }) => ({ key, value }));
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeDateKey(input?: string): string | null {
  if (!input) {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : null;
}

function parsePuzzle(
  value:
    | {
        id: string;
        preview: unknown;
        solutionLabel: string;
        answer: string;
        acceptedAnswers: string[];
      }
    | null
    | undefined,
): Puzzle | null {
  if (!value) {
    return null;
  }

  const preview = parsePreview(value.preview);
  if (!preview) {
    return null;
  }

  const id = value.id.trim();
  const solutionLabel = value.solutionLabel.trim();
  const answer = value.answer.trim();
  if (!id || !solutionLabel || !answer) {
    return null;
  }

  const acceptedAnswers = Array.isArray(value.acceptedAnswers)
    ? value.acceptedAnswers
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

  return {
    id,
    preview,
    solutionLabel,
    answer,
    acceptedAnswers,
  };
}

function parsePreview(value: unknown): Record<number, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return null;
  }

  const preview: Record<number, number> = {};
  for (const [rawKey, rawCount] of entries) {
    const key = Number(rawKey);
    if (!Number.isFinite(key) || !Number.isInteger(key)) {
      return null;
    }

    if (
      typeof rawCount !== "number" ||
      !Number.isFinite(rawCount) ||
      !Number.isInteger(rawCount) ||
      rawCount < 0
    ) {
      return null;
    }

    preview[key] = rawCount;
  }

  return preview;
}
