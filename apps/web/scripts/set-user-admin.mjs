#!/usr/bin/env node

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma-client/index.js";

const HELP_TEXT = `Usage:
  pnpm user:set-admin -- --id <player-id>
  pnpm user:set-admin -- --external-id <provider-user-id>
  pnpm user:set-admin -- --friend-id <friend-code>

Options:
  --id <value>            Match Player.id
  --external-id <value>   Match Player.externalId
  --friend-id <value>     Match Player.friendCode
  --unset                 Set isAdmin=false instead of true
  --help                  Show this help text
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const selector = getSelector(args);
  const setAdmin = !Boolean(args.unset);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    fail("DATABASE_URL is required.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const updated = await prisma.player.update({
      where: selector.where,
      data: {
        isAdmin: setAdmin,
      },
      select: {
        id: true,
        externalId: true,
        friendCode: true,
        displayName: true,
        isAdmin: true,
      },
    });

    console.log(
      `${setAdmin ? "Granted" : "Revoked"} admin for player ${updated.id}.`,
    );
    console.log(
      JSON.stringify(
        {
          id: updated.id,
          externalId: updated.externalId,
          friendCode: updated.friendCode,
          displayName: updated.displayName,
          isAdmin: updated.isAdmin,
          matchedBy: selector.label,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      fail(`No player found for ${selector.label}.`);
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

function getSelector(args) {
  const id = asNonEmptyString(args.id);
  const externalId = asNonEmptyString(args["external-id"]);
  const friendId = asNonEmptyString(args["friend-id"]);

  const selectors = [
    id
      ? {
          label: `id "${id}"`,
          where: { id },
        }
      : null,
    externalId
      ? {
          label: `external-id "${externalId}"`,
          where: { externalId },
        }
      : null,
    friendId
      ? {
          label: `friend-id "${friendId}"`,
          where: { friendCode: friendId },
        }
      : null,
  ].filter(Boolean);

  if (selectors.length !== 1) {
    fail(
      "Provide exactly one selector: --id, --external-id, or --friend-id.\n\n" +
        HELP_TEXT,
    );
  }

  return selectors[0];
}

function asNonEmptyString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
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

function isPrismaErrorCode(error, code) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === code,
  );
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

void main();

