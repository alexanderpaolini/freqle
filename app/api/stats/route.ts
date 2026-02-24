import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDateKey } from "@/lib/puzzles";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dateKey = sanitizeDateKey(url.searchParams.get("dateKey"));

  const resolvedAssignment = await resolvePuzzleAssignment(dateKey);
  if (!resolvedAssignment) {
    return NextResponse.json({
      dateKey,
      totalSolves: 0,
      average: null,
      median: null,
      distribution: buildDistribution([]),
    });
  }

  const puzzleDates = await db.dailyPuzzle.findMany({
    where: {
      puzzleId: resolvedAssignment.puzzleId,
    },
    select: {
      dateKey: true,
    },
  });

  const solvedAttempts = await db.gameAttempt.findMany({
    where: {
      solved: true,
      solvedIn: {
        not: null,
      },
      puzzleDate: {
        in: puzzleDates.map((entry) => entry.dateKey),
      },
    },
    select: {
      solvedIn: true,
    },
  });

  const solvedInValues = solvedAttempts
    .map((entry) => entry.solvedIn)
    .filter((value): value is number => typeof value === "number")
    .filter((value) => value >= 1);

  return NextResponse.json({
    dateKey,
    totalSolves: solvedInValues.length,
    average: computeAverage(solvedInValues),
    median: computeMedian(solvedInValues),
    distribution: buildDistribution(solvedInValues),
  });
}

function sanitizeDateKey(input: string | null): string {
  if (!input) {
    return getDateKey();
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : getDateKey();
}

async function resolvePuzzleAssignment(dateKey: string): Promise<{
  dateKey: string;
  puzzleId: string;
} | null> {
  return db.dailyPuzzle.findUnique({
    where: {
      dateKey,
    },
    select: {
      dateKey: true,
      puzzleId: true,
    },
  });
}

function buildDistribution(values: number[]) {
  const maxTries = values.length > 0 ? Math.max(...values) : 6;
  const distribution = new Array(maxTries).fill(0);

  for (const value of values) {
    distribution[value - 1] += 1;
  }

  return distribution.map((count, index) => ({
    tries: index + 1,
    count,
  }));
}

function computeAverage(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sum = values.reduce((accumulator, value) => accumulator + value, 0);
  return Number((sum / values.length).toFixed(2));
}

function computeMedian(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(2));
}
