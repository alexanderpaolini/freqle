import type { Metadata } from "next";
import { PageClient } from "@/components/page-client";
import { db } from "@/lib/db";
import {
  getDailyPuzzle,
  getDateKey,
  getPuzzlePreviewEntries,
} from "@/lib/puzzles";
import { normalizeShareCode } from "@/lib/share";

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
  const solvedPrefix = sharedSummary.dateKey === getDateKey() ? "today's " : "";
  const title = sharedSummary.gaveUp
    ? sharedSummary.tries > 0
      ? `${sharedSummary.ownerName} gave up on freqle after ${sharedSummary.tries} ${attemptsLabel}`
      : `${sharedSummary.ownerName} gave up on freqle`
    : `${sharedSummary.ownerName} solved ${solvedPrefix}freqle in ${sharedSummary.tries} tries`;
  const description = sharedSummary.gaveUp
    ? "Can you solve it?"
    : "Can you beat that score?";
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
  const dailyPuzzle = await getDailyPuzzle();
  if (!dailyPuzzle) {
    const exampleCommand = `pnpm puzzle:upsert-day -- --date ${getDateKey()} --json '{"key":"puzzle-${getDateKey()}","answer":"Example answer","data":{"1":3,"2":8}}'`;

    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fef6e7,#f8efe2_45%,#efe5d6)] px-4 py-8 text-stone-900">
        <div className="mx-auto w-full max-w-3xl rounded-xl border border-stone-300 bg-white p-6">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-stone-500">
            freqle setup
          </p>
          <h1 className="mt-2 text-2xl font-semibold">No puzzle configured yet</h1>
          <p className="mt-3 text-sm text-stone-700">
            Run <code>{exampleCommand}</code> and refresh.
          </p>
        </div>
      </main>
    );
  }
  const puzzlePreviewEntries = getPuzzlePreviewEntries(dailyPuzzle);

  return (
    <PageClient
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
