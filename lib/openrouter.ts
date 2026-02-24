import type { Puzzle } from "@/lib/puzzles";

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

export async function scoreGuessWithOpenRouter({
  guess,
  puzzle,
}: ScoreGuessParams): Promise<GuessJudgment> {
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
        temperature: 0,
        max_tokens: 180,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a strict puzzle judge. Return valid JSON only.",
          },
          {
            role: "user",
            content: [
              "Determine whether the guess matches the intended dataset.",
              `Canonical answer: "${puzzle.answer}"`,
              `Accepted alternate answers: ${puzzle.acceptedAnswers.join(", ")}`,
              `User guess: "${guess}"`,
              "Rules:",
              "- score: integer between 0 and 100.",
              '- verdict: "correct" if it matches; otherwise "incorrect".',
              '- If verdict is "correct", score must be >=90.',
              "- reason: one short sentence explaining the judgment.",
              "- be more lenient than not",
              "Return JSON with this exact schema and no extra fields:",
              '{"score": number, "verdict": "correct" | "incorrect", "reason": string }',
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

  if (
    !parsed ||
    typeof parsed.score !== "number" ||
    (parsed.verdict !== "correct" && parsed.verdict !== "incorrect") ||
    typeof parsed.reason !== "string"
  ) {
    throw new Error("Malformed OpenRouter JSON payload");
  }

  const verdict = parsed.verdict;
  const score =
    verdict === "correct" ? 100 : clamp(Math.round(parsed.score), 0, 99);
  const reason = parsed.reason.trim();

  if (!reason) {
    throw new Error("Malformed OpenRouter JSON payload");
  }

  return { score, verdict, reason };
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

function parseJsonObject(text: string): {
  score?: number;
  verdict?: unknown;
  reason?: unknown;
} | null {
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
    console.log(parsed);
    return parsed as { score?: number };
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
