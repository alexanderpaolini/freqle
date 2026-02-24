import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

type LinkBody = {
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

  if (!friendExternalId) {
    return NextResponse.json(
      { error: "friendExternalId is required." },
      { status: 400 },
    );
  }

  if (friendExternalId === session.user.id) {
    return NextResponse.json({ linked: false });
  }

  const [player, friend] = await Promise.all([
    db.player.upsert({
      where: {
        externalId: session.user.id,
      },
      create: {
        externalId: session.user.id,
        displayName: session.user.name ?? null,
      },
      update: {},
    }),
    db.player.upsert({
      where: {
        externalId: friendExternalId,
      },
      create: {
        externalId: friendExternalId,
      },
      update: {},
    }),
  ]);

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
