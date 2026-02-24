import type { Metadata } from "next";
import { db } from "@/lib/db";
import {
  getDailyPuzzle,
  getDateKey,
  getPuzzlePreviewEntries,
} from "@/lib/puzzles";
import { normalizeShareCode } from "@/lib/share";
import { HomeClient } from "./home-client";

type HomePageProps = {
  searchParams: Promise<{
    share?: string;
  }>;
};

type SharedSummary = {
  ownerName: string;
  tries: number;
  dateKey: string;
  gaveUp: boolean;
};

const FALLBACK_SITE_URL = "http://localhost:3000";
export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: HomePageProps): Promise<Metadata> {
  const params = await searchParams;
  const shareId = normalizeShareCode(params.share);

  if (!shareId) {
    return {};
  }

  const sharedSummary = await getSharedSummary(shareId);
  if (!sharedSummary) {
    return {};
  }

  const attemptsLabel = sharedSummary.tries === 1 ? "attempt" : "attempts";
  const title = sharedSummary.gaveUp
    ? sharedSummary.tries > 0
      ? `${sharedSummary.ownerName} gave up on freqle after ${sharedSummary.tries} ${attemptsLabel}`
      : `${sharedSummary.ownerName} gave up on freqle`
    : `${sharedSummary.ownerName} solved ${sharedSummary.dateKey == getDateKey() ? "todays" : ""} freqle in ${sharedSummary.tries} tries`;
  const description = sharedSummary.gaveUp
    ? `Can you solve it?`
    : `Can you beat that score?`;
  const siteUrl = process.env.NEXTAUTH_URL ?? FALLBACK_SITE_URL;
  const url = `${siteUrl}/?share=${shareId}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function Page({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const shareId = normalizeShareCode(params.share);
  const puzzlePreviewEntries = getPuzzlePreviewEntries(getDailyPuzzle());

  return (
    <HomeClient
      sharedLinkId={shareId}
      puzzlePreviewEntries={puzzlePreviewEntries}
    />
  );
}

async function getSharedSummary(
  shareId: string,
): Promise<SharedSummary | null> {
  const sharedAttempt = await db.gameAttempt.findUnique({
    where: {
      shareCode: shareId,
    },
    include: {
      _count: {
        select: {
          guesses: true,
        },
      },
      player: {
        select: {
          displayName: true,
        },
      },
    },
  });

  if (!sharedAttempt) {
    return null;
  }

  const tries = sharedAttempt.solvedIn ?? sharedAttempt._count.guesses;
  if (tries < 1 && !sharedAttempt.gaveUp) {
    return null;
  }

  return {
    ownerName: sharedAttempt.player?.displayName ?? "A player",
    tries,
    dateKey: sharedAttempt.puzzleDate,
    gaveUp: sharedAttempt.gaveUp,
  };
}
