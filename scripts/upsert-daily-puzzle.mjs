#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma-client/index.js";

const HELP_TEXT = `Usage:
  pnpm puzzle:upsert-day -- --date YYYY-MM-DD --file ./puzzle.json
  pnpm puzzle:upsert-day -- --date YYYY-MM-DD --json '{"key":"...","subject":"...","answer":"...","data":{"1":2}}'

Optional overrides:
  --key <puzzle-key>
  --subject <subject>
  --answer <canonical answer>
  --data '<json object>'
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
  const puzzle = normalizePuzzle(parsedPuzzle, dateKey);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    fail("DATABASE_URL is required.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const upsertedPuzzle = await prisma.puzzle.upsert({
      where: {
        dateKey,
      },
      create: {
        key: puzzle.key,
        dateKey,
        subject: puzzle.subject,
        answer: puzzle.answer,
        data: puzzle.data,
      },
      update: {
        key: puzzle.key,
        subject: puzzle.subject,
        answer: puzzle.answer,
        data: puzzle.data,
      },
      select: {
        key: true,
        dateKey: true,
      },
    });

    console.log(
      `Assigned puzzle "${upsertedPuzzle.key}" to ${upsertedPuzzle.dateKey}.`,
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

  if (args.key) {
    merged.key = args.key;
  }

  if (args.answer) {
    merged.answer = args.answer;
  }

  if (args.subject) {
    merged.subject = args.subject;
  }

  if (args.data) {
    merged.data = parseJson(args.data, "--data");
  }

  return merged;
}

function normalizePuzzle(input, dateKey) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("Puzzle must be an object.");
  }

  const key = typeof input.key === "string" ? input.key.trim() : "";
  if (!key) {
    fail("Puzzle key is required.");
  }

  const answer = typeof input.answer === "string" ? input.answer.trim() : "";
  if (!answer) {
    fail("Puzzle answer is required.");
  }

  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  if (!subject) {
    fail("Puzzle subject is required.");
  }

  const data = normalizeData(input.data);

  return {
    key,
    dateKey,
    subject,
    answer,
    data,
  };
}

function normalizeData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    fail("Puzzle data must be a JSON object of number keys to number counts.");
  }

  const entries = Object.entries(data);
  if (entries.length === 0) {
    fail("Puzzle data cannot be empty.");
  }

  const normalized = {};
  for (const [rawKey, rawValue] of entries) {
    const key = Number(rawKey);
    const value = Number(rawValue);

    if (!Number.isFinite(key) || !Number.isInteger(key)) {
      fail(`Invalid data key "${rawKey}". Keys must be integers.`);
    }

    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
      fail(
        `Invalid data value for key "${rawKey}". Values must be non-negative integers.`,
      );
    }

    normalized[key] = value;
  }

  return normalized;
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
    if (!key) {
      continue;
    }

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
