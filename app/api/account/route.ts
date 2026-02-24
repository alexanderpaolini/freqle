import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensurePlayerFriendId } from "@/lib/friends";

type UpdateAccountBody = {
  displayName?: unknown;
};

const MAX_USERNAME_LENGTH = 40;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
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

  const friendId = player.friendCode ?? (await ensurePlayerFriendId(player.id));

  return NextResponse.json({
    displayName: player.displayName ?? session.user.name ?? "player",
    friendId,
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: UpdateAccountBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const displayName =
    typeof body.displayName === "string" ? body.displayName.trim() : "";

  if (!displayName) {
    return NextResponse.json(
      { error: "Username cannot be empty." },
      { status: 400 },
    );
  }

  if (displayName.length > MAX_USERNAME_LENGTH) {
    return NextResponse.json(
      { error: `Username must be ${MAX_USERNAME_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }

  const player = await db.player.upsert({
    where: {
      externalId: session.user.id,
    },
    create: {
      externalId: session.user.id,
      displayName,
    },
    update: {
      displayName,
    },
  });

  const friendId = player.friendCode ?? (await ensurePlayerFriendId(player.id));

  return NextResponse.json({
    displayName: player.displayName ?? displayName,
    friendId,
  });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await db.player.deleteMany({
    where: {
      externalId: session.user.id,
    },
  });

  return NextResponse.json({ deleted: true });
}
