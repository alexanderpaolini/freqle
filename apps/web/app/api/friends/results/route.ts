import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDateKey } from "@/lib/puzzles";

type FriendResultStatus = "solved" | "gave_up" | "in_progress" | "pending";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const dateKey = sanitizeDateKey(url.searchParams.get("dateKey"));

  const player = await db.player.upsert({
    where: {
      externalId: session.user.id,
    },
    create: {
      externalId: session.user.id,
      displayName: session.user.name ?? null,
    },
    update: {},
    select: {
      id: true,
    },
  });

  const links = await db.friendship.findMany({
    where: {
      playerId: player.id,
    },
    select: {
      friend: {
        select: {
          id: true,
          externalId: true,
          friendCode: true,
          displayName: true,
          attempts: {
            where: {
              puzzleDate: dateKey,
            },
            take: 1,
            select: {
              solved: true,
              gaveUp: true,
              solvedIn: true,
              _count: {
                select: {
                  guesses: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const deduped = new Map<
    string,
    {
      friendId: string;
      displayName: string;
      status: FriendResultStatus;
      tries: number;
    }
  >();

  for (const link of links) {
    const friend = link.friend;
    const attempt = friend.attempts[0];
    const tries = attempt ? (attempt.solvedIn ?? attempt._count.guesses) : 0;

    let status: FriendResultStatus = "pending";
    if (attempt) {
      if (attempt.gaveUp) {
        status = "gave_up";
      } else if (attempt.solved) {
        status = "solved";
      } else if (tries > 0) {
        status = "in_progress";
      }
    }

    deduped.set(friend.id, {
      friendId: friend.friendCode ?? friend.externalId,
      displayName: friend.displayName?.trim() || "friend",
      status,
      tries,
    });
  }

  const statusOrder: Record<FriendResultStatus, number> = {
    solved: 0,
    gave_up: 1,
    in_progress: 2,
    pending: 3,
  };

  const friends = Array.from(deduped.values()).sort((left, right) => {
    const statusDiff = statusOrder[left.status] - statusOrder[right.status];
    if (statusDiff !== 0) {
      return statusDiff;
    }

    return left.displayName.localeCompare(right.displayName);
  });

  return NextResponse.json({
    dateKey,
    friends,
  });
}

function sanitizeDateKey(input: string | null): string {
  if (!input) {
    return getDateKey();
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : getDateKey();
}
