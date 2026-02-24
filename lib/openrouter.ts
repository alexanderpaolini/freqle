import type { Puzzle } from "@/lib/puzzles";

export type GuessScore = {
  score: number;
};

type ScoreGuessParams = {
  guess: string;
  puzzle: Puzzle;
};

export async function scoreGuessWithOpenRouter({
  guess,
  puzzle,
}: ScoreGuessParams): Promise<GuessScore> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(process.env.OPENROUTER_SITE_URL
          ? { "HTTP-Referer": process.env.OPENROUTER_SITE_URL }
          : {}),
        ...(process.env.OPENROUTER_APP_NAME
          ? { "X-Title": process.env.OPENROUTER_APP_NAME }
          : {}),
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 80,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You score semantic similarity between a puzzle answer and user guess. Return valid JSON only.",
          },
          {
            role: "user",
            content: [
              "Score this guess from 0-100.",
              `Correct answer: "${puzzle.answer}"`,
              `User guess: "${guess}"`,
              "Return JSON with this exact schema:",
              '{"score": number}',
            ].join("\n"),
          },
        ],
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`OpenRouter request failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const content = extractContent(payload);
  const parsed = parseJsonObject(content);

  if (!parsed || typeof parsed.score !== "number") {
    throw new Error("Malformed OpenRouter JSON payload");
  }

  return { score: clamp(Math.round(parsed.score), 0, 99) };
}

function extractContent(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const choices = (
    payload as { choices?: Array<{ message?: { content?: unknown } }> }
  ).choices;
  const content = choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "object" && part && "text" in part
          ? String((part as { text?: unknown }).text ?? "")
          : "",
      )
      .join("\n")
      .trim();
  }

  return "";
}

function parseJsonObject(text: string): { score?: number } | null {
  if (!text.trim()) {
    return null;
  }

  const sanitized = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed: unknown = JSON.parse(sanitized);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed as { score?: number };
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
