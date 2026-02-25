import "server-only";

import { normalizeText, type Puzzle } from "@/lib/puzzles";

export type JudgeVerdict = "correct" | "incorrect";

export type GuessJudgment = {
  score: number;
  verdict: JudgeVerdict;
  reason: string;
};

type ScoreGuessParams = {
  guess: string;
  puzzle: Puzzle;
};

type CosineApiPayload = {
  cosine_similarity?: unknown;
};

const DEFAULT_COSINE_API_BASE_URL = "http://localhost:8000";
const DEFAULT_CORRECT_THRESHOLD = 0.85;
const DEFAULT_COSINE_API_TIMEOUT_MS = 5000;

export async function scoreGuessWithCosineApi({
  guess,
  puzzle,
}: ScoreGuessParams): Promise<GuessJudgment> {
  const baseUrl =
    process.env.COSINE_API_BASE_URL?.trim() ?? DEFAULT_COSINE_API_BASE_URL;
  const endpoint = process.env.COSINE_API_ENDPOINT?.trim() ?? "/cosine_similarity";
  const threshold = parseThreshold(process.env.COSINE_CORRECT_THRESHOLD);
  const timeoutMs = parseTimeoutMs(process.env.COSINE_API_TIMEOUT_MS);
  const url = buildUrl(baseUrl, endpoint);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text1: guess,
        text2: puzzle.answer,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error(`Cosine API request timed out after ${timeoutMs}ms`);
    }

    throw error;
  }

  if (!response.ok) {
    throw new Error(`Cosine API request failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const similarity = parseSimilarity(payload);
  if (similarity === null) {
    throw new Error("Malformed cosine similarity payload");
  }

  const rawScore = clamp(Math.round(similarity * 100), 0, 100);
  const exactMatch = normalizeText(guess) === normalizeText(puzzle.answer);
  const verdict: JudgeVerdict =
    exactMatch || similarity >= threshold ? "correct" : "incorrect";
  const score = verdict === "correct" ? 100 : Math.min(rawScore, 99);

  return {
    score,
    verdict,
    reason: buildHint(score, verdict),
  };
}

function parseSimilarity(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const value = (payload as CosineApiPayload).cosine_similarity;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function parseThreshold(rawThreshold: string | undefined): number {
  if (!rawThreshold) {
    return DEFAULT_CORRECT_THRESHOLD;
  }

  const parsed = Number(rawThreshold);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_CORRECT_THRESHOLD;
  }

  return clamp(parsed, -1, 1);
}

function parseTimeoutMs(rawTimeoutMs: string | undefined): number {
  if (!rawTimeoutMs) {
    return DEFAULT_COSINE_API_TIMEOUT_MS;
  }

  const parsed = Number(rawTimeoutMs);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_COSINE_API_TIMEOUT_MS;
  }

  return Math.round(parsed);
}

function buildUrl(baseUrl: string, endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) {
    return endpoint;
  }

  return new URL(endpoint, ensureTrailingSlash(baseUrl)).toString();
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function buildHint(score: number, verdict: JudgeVerdict): string {
  if (verdict === "correct") {
    return "That matches the intended dataset.";
  }

  if (score >= 80) {
    return "Very close. Be a bit more specific.";
  }

  if (score >= 65) {
    return "Close. Focus on the exact metric, region, or timeframe.";
  }

  if (score >= 45) {
    return "Partially related. Try a tighter interpretation of the dataset.";
  }

  return "Not close yet. Try a different domain or measurement.";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
