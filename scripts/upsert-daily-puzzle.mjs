#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma-client/index.js";

const HELP_TEXT = `Usage:
  pnpm puzzle:upsert-day -- --date YYYY-MM-DD --file ./puzzle.json
  pnpm puzzle:upsert-day -- --date YYYY-MM-DD --json '{"id":"...","preview":{"1":2},"solutionLabel":"...","answer":"...","acceptedAnswers":["..."]}'

Optional overrides:
  --id <puzzle-id>
  --label <solution label>
  --answer <canonical answer>
  --preview '<json object>'
  --accepted '<json array>' or 'alt one,alt two'
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const dateKey = parseDateKey(args.date);
  if (!dateKey) {
    fail("Missing or invalid --date (expected YYYY-MM-DD).\n\n" + HELP_TEXT);
  }

  const parsedPuzzle = resolvePuzzleInput(args);
  const puzzle = normalizePuzzle(parsedPuzzle);

  const connectionString = process.env.DATABASE_URL;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const upsertedPuzzle = await prisma.puzzle.upsert({
      where: {
        id: puzzle.id,
      },
      create: {
        id: puzzle.id,
        preview: puzzle.preview,
        solutionLabel: puzzle.solutionLabel,
        answer: puzzle.answer,
        acceptedAnswers: puzzle.acceptedAnswers,
      },
      update: {
        preview: puzzle.preview,
        solutionLabel: puzzle.solutionLabel,
        answer: puzzle.answer,
        acceptedAnswers: puzzle.acceptedAnswers,
      },
      select: {
        id: true,
      },
    });

    const assignment = await prisma.dailyPuzzle.upsert({
      where: {
        dateKey,
      },
      create: {
        dateKey,
        puzzleId: upsertedPuzzle.id,
      },
      update: {
        puzzleId: upsertedPuzzle.id,
      },
      select: {
        dateKey: true,
        puzzleId: true,
      },
    });

    console.log(
      `Assigned puzzle "${assignment.puzzleId}" to ${assignment.dateKey}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

function resolvePuzzleInput(args) {
  const pieces = [];

  if (args.file) {
    const filePath = path.resolve(process.cwd(), args.file);
    if (!fs.existsSync(filePath)) {
      fail(`--file not found: ${filePath}`);
    }

    const raw = fs.readFileSync(filePath, "utf8");
    pieces.push(parseJson(raw, "--file content"));
  }

  if (args.json) {
    pieces.push(parseJson(args.json, "--json"));
  }

  if (pieces.length === 0) {
    fail("Provide at least one puzzle source: --file, or --json.");
  }

  const merged = Object.assign({}, ...pieces);

  if (args.id) {
    merged.id = args.id;
  }

  if (args.label) {
    merged.solutionLabel = args.label;
  }

  if (args.answer) {
    merged.answer = args.answer;
  }

  if (args.preview) {
    merged.preview = parseJson(args.preview, "--preview");
  }

  if (args.accepted) {
    merged.acceptedAnswers = parseAcceptedAnswers(args.accepted);
  }

  return merged;
}

function normalizePuzzle(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("Puzzle must be an object.");
  }

  const id = typeof input.id === "string" ? input.id.trim() : "";
  if (!id) {
    fail("Puzzle id is required.");
  }

  const solutionLabel =
    typeof input.solutionLabel === "string" ? input.solutionLabel.trim() : "";
  if (!solutionLabel) {
    fail("Puzzle solutionLabel is required.");
  }

  const answer = typeof input.answer === "string" ? input.answer.trim() : "";
  if (!answer) {
    fail("Puzzle answer is required.");
  }

  const preview = normalizePreview(input.preview);

  const acceptedAnswers = Array.isArray(input.acceptedAnswers)
    ? input.acceptedAnswers
        .filter((entry) => typeof entry === "string")
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

function normalizePreview(preview) {
  if (!preview || typeof preview !== "object" || Array.isArray(preview)) {
    fail(
      "Puzzle preview must be a JSON object of number keys to number counts.",
    );
  }

  const entries = Object.entries(preview);
  if (entries.length === 0) {
    fail("Puzzle preview cannot be empty.");
  }

  const normalized = {};
  for (const [rawKey, rawValue] of entries) {
    const key = Number(rawKey);
    const value = Number(rawValue);

    if (!Number.isFinite(key) || !Number.isInteger(key)) {
      fail(`Invalid preview key \"${rawKey}\". Keys must be integers.`);
    }

    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
      fail(
        `Invalid preview count for key \"${rawKey}\". Counts must be non-negative integers.`,
      );
    }

    normalized[key] = value;
  }

  return normalized;
}

function parseAcceptedAnswers(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    const parsed = parseJson(trimmed, "--accepted");
    if (!Array.isArray(parsed)) {
      fail("--accepted JSON value must be an array of strings.");
    }

    return parsed
      .filter((entry) => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return trimmed
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseDateKey(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const nextToken = argv[index + 1];
    if (nextToken && !nextToken.startsWith("--")) {
      parsed[key] = nextToken;
      index += 1;
    } else {
      parsed[key] = true;
    }
  }

  return parsed;
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch {
    fail(`Invalid JSON provided for ${label}.`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

void main();
