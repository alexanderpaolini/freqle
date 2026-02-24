import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeShareCode } from "@/lib/share";

type LinkShareBody = {
  shareId?: unknown;
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "You must be signed in to link from a share URL." },
      { status: 401 },
    );
  }

  let body: LinkShareBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const shareId = normalizeShareCode(
    typeof body.shareId === "string" ? body.shareId : null,
  );

  if (!shareId) {
    return NextResponse.json(
      { error: "shareId is required." },
      { status: 400 },
    );
  }

  const shareAttempt = await db.gameAttempt.findUnique({
    where: {
      shareCode: shareId,
    },
    include: {
      player: {
        select: {
          id: true,
          externalId: true,
        },
      },
    },
  });

  if (!shareAttempt) {
    return NextResponse.json(
      { error: "Share link not found." },
      { status: 404 },
    );
  }

  if (shareAttempt.player.externalId === session.user.id) {
    return NextResponse.json({ linked: false });
  }

  const currentPlayer = await db.player.upsert({
    where: {
      externalId: session.user.id,
    },
    create: {
      externalId: session.user.id,
      displayName: session.user.name ?? null,
    },
    update: {},
  });

  await db.friendship.createMany({
    data: [
      {
        playerId: currentPlayer.id,
        friendId: shareAttempt.player.id,
      },
      {
        playerId: shareAttempt.player.id,
        friendId: currentPlayer.id,
      },
    ],
    skipDuplicates: true,
  });

  return NextResponse.json({ linked: true });
}
