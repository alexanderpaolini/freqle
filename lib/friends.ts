import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const FRIEND_ID_LENGTH = 9;
const FRIEND_ID_PATTERN = /^[a-z0-9]{9}$/;
const FRIEND_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const MAX_GENERATION_ATTEMPTS = 16;

export function normalizeFriendId(input?: string | null): string | null {
  if (!input) {
    return null;
  }

  const normalized = input.trim().toLowerCase();
  return FRIEND_ID_PATTERN.test(normalized) ? normalized : null;
}

export async function ensurePlayerFriendId(playerId: string): Promise<string> {
  const existing = await db.player.findUnique({
    where: {
      id: playerId,
    },
    select: {
      friendCode: true,
    },
  });

  if (!existing) {
    throw new Error("Player not found.");
  }

  if (existing.friendCode) {
    return existing.friendCode;
  }

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = generateFriendId();

    try {
      const updated = await db.player.update({
        where: {
          id: playerId,
        },
        data: {
          friendCode: candidate,
        },
        select: {
          friendCode: true,
        },
      });

      if (updated.friendCode) {
        return updated.friendCode;
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Failed to generate a unique friend ID.");
}

function generateFriendId(length = FRIEND_ID_LENGTH): string {
  let id = "";
  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * FRIEND_ID_ALPHABET.length);
    id += FRIEND_ID_ALPHABET[randomIndex];
  }

  return id;
}
