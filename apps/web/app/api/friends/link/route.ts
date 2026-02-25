import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensurePlayerFriendId, normalizeFriendId } from "@/lib/friends";

type LinkBody = {
  friendId?: unknown;
  friendExternalId?: unknown;
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "You must be signed in to link friends." },
      { status: 401 },
    );
  }

  let body: LinkBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const friendExternalId =
    typeof body.friendExternalId === "string"
      ? body.friendExternalId.trim()
      : "";
  const friendId = normalizeFriendId(
    typeof body.friendId === "string" ? body.friendId : null,
  );

  if (!friendExternalId && !friendId) {
    return NextResponse.json(
      { error: "friendId is required." },
      { status: 400 },
    );
  }

  if (friendExternalId && friendExternalId === session.user.id) {
    return NextResponse.json({ linked: false });
  }

  const player = await db.player.upsert({
    where: {
      externalId: session.user.id,
    },
    create: {
      externalId: session.user.id,
      displayName: session.user.name ?? null,
    },
    update: {},
  });

  if (!player.friendCode) {
    await ensurePlayerFriendId(player.id);
  }

  const friend = friendId
    ? await db.player.findUnique({
        where: {
          friendCode: friendId,
        },
      })
    : await db.player.upsert({
        where: {
          externalId: friendExternalId,
        },
        create: {
          externalId: friendExternalId,
        },
        update: {},
      });

  if (!friend) {
    return NextResponse.json(
      { error: "Friend ID not found." },
      { status: 404 },
    );
  }

  if (friend.id === player.id) {
    return NextResponse.json({ linked: false });
  }

  await db.friendship.createMany({
    data: [
      {
        playerId: player.id,
        friendId: friend.id,
      },
      {
        playerId: friend.id,
        friendId: player.id,
      },
    ],
    skipDuplicates: true,
  });

  return NextResponse.json({ linked: true });
}
