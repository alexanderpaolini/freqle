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
              "- be more lenient than not on scoring",
              "- hint: one short nudge for the next guess",
              "- The hint must never include the exact answer, accepted alternate answers, or obvious paraphrases.",
              "- The hint should be vaguely directional (category, scale, trend, or relation), not a giveaway.",
              "Return JSON with this exact schema and no extra fields:",
              '{"score": number, "verdict": "correct" | "incorrect", "hint": string }',
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

  console.log(parsed);

  if (
    !parsed ||
    typeof parsed.score !== "number" ||
    (parsed.verdict !== "correct" && parsed.verdict !== "incorrect")
  ) {
    throw new Error("Malformed OpenRouter JSON payload");
  }

  const verdict = parsed.verdict;
  const score =
    verdict === "correct" ? 100 : clamp(Math.round(parsed.score), 0, 99);
  const hint =
    typeof parsed.hint === "string"
      ? parsed.hint.trim()
      : typeof parsed.reason === "string"
        ? parsed.reason.trim()
        : "";

  if (!hint) {
    throw new Error("Malformed OpenRouter JSON payload");
  }

  return { score, verdict, reason: hint };
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
  hint?: unknown;
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
    return parsed as {
      score?: number;
      verdict?: unknown;
      hint?: unknown;
      reason?: unknown;
    };
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
