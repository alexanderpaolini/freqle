"use client";

import type { FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { AttemptsSection } from "@/components/attempts-section";
import { HomeFooter } from "@/components/footer";
import { GamePanel } from "@/components/game-panel";
import {
  clearFreqleLocalState,
  getDateKey,
} from "@/components/home-client-utils";
import { useAccountSettings } from "@/components/hooks/use-account-settings";
import { useGameAttempts } from "@/components/hooks/use-game-attempts";
import { usePuzzleStats } from "@/components/hooks/use-puzzle-stats";
import { useShareFlow } from "@/components/hooks/use-share-flow";
import { ResultsModal } from "@/components/results-modal";
import type { PuzzlePreviewEntry } from "@/components/types";

type PageClientProps = {
  sharedLinkId: string | null;
  puzzlePreviewEntries: PuzzlePreviewEntry[];
};

export function PageClient({
  sharedLinkId,
  puzzlePreviewEntries,
}: PageClientProps) {
  const { data: session, status } = useSession();
  const [isSolvedModalOpen, setIsSolvedModalOpen] = useState(false);

  const dateKey = useMemo(() => getDateKey(), []);

  const {
    guess,
    setGuess,
    isSubmitting,
    isLoadingAttempts,
    isGivingUp,
    hasGivenUp,
    revealedAnswer,
    isSolved,
    isPuzzleComplete,
    triesUsed,
    attemptsForDisplay,
    submitGuess,
    giveUp,
    resetGameplayState,
  } = useGameAttempts({
    dateKey,
    status,
  });

  const {
    isGeneratingShare,
    shareUrl,
    shareSolvedResult,
    signInToShare,
    clearShareState,
  } = useShareFlow({
    dateKey,
    status,
    sessionUserId: session?.user?.id,
    sharedLinkId,
    isSolved,
    hasGivenUp,
    triesUsed,
    isPuzzleComplete,
    isSolvedModalOpen,
    onOpenResultsAfterAuth: () => setIsSolvedModalOpen(true),
  });

  const signOutAndClearLocalData = useCallback(async () => {
    clearFreqleLocalState();
    resetGameplayState();
    clearShareState();
    setIsSolvedModalOpen(false);
    await signOut({ callbackUrl: "/" });
  }, [clearShareState, resetGameplayState]);

  const {
    shownUsername,
    friendId,
    isSettingsOpen,
    setIsSettingsOpen,
    settingsName,
    setSettingsName,
    isLoadingAccount,
    isSavingSettings,
    isDeletingAccount,
    saveSettings,
    deleteAccount,
  } = useAccountSettings({
    status,
    fallbackName: session?.user?.name ?? "player",
    onAccountDeleted: async () => {
      clearFreqleLocalState();
      resetGameplayState();
      clearShareState();
      setIsSolvedModalOpen(false);
      await signOut({ callbackUrl: "/" });
    },
  });

  const { stats, isLoadingStats, distribution, maxDistributionCount } =
    usePuzzleStats({
      dateKey,
      refreshToken: isSolvedModalOpen,
    });

  function onSubmitGuess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void (async () => {
      const solved = await submitGuess();
      if (solved) {
        setIsSolvedModalOpen(true);
      }
    })();
  }

  function onGiveUp() {
    void (async () => {
      const didGiveUp = await giveUp();
      if (didGiveUp) {
        setIsSolvedModalOpen(false);
        clearShareState();
      }
    })();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fef6e7,#f8efe2_45%,#efe5d6)] px-4 py-8 text-stone-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <GamePanel
          status={status}
          shownUsername={shownUsername}
          isSettingsOpen={isSettingsOpen}
          settingsName={settingsName}
          friendId={friendId}
          isLoadingAccount={isLoadingAccount}
          isSavingSettings={isSavingSettings}
          isDeletingAccount={isDeletingAccount}
          previewEntries={puzzlePreviewEntries}
          guess={guess}
          triesUsed={triesUsed}
          isLoadingAttempts={isLoadingAttempts}
          isSubmitting={isSubmitting}
          isGivingUp={isGivingUp}
          isSolved={isSolved}
          hasGivenUp={hasGivenUp}
          revealedAnswer={revealedAnswer}
          onSignIn={() => {
            void signIn("discord");
          }}
          onSignOut={() => {
            void signOutAndClearLocalData();
          }}
          onSettingsOpenChange={setIsSettingsOpen}
          onSettingsNameChange={setSettingsName}
          onSaveSettings={(event) => {
            void saveSettings(event);
          }}
          onDeleteAccount={() => {
            void deleteAccount();
          }}
          onGuessChange={setGuess}
          onSubmitGuess={onSubmitGuess}
          onGiveUp={onGiveUp}
          onOpenResults={() => setIsSolvedModalOpen(true)}
        />

        <AttemptsSection
          status={status}
          isLoadingAttempts={isLoadingAttempts}
          attempts={attemptsForDisplay}
        />

        <HomeFooter />
      </div>

      <ResultsModal
        isOpen={isSolvedModalOpen}
        hasGivenUp={hasGivenUp}
        triesUsed={triesUsed}
        stats={stats}
        isLoadingStats={isLoadingStats}
        distribution={distribution}
        maxDistributionCount={maxDistributionCount}
        status={status}
        isGeneratingShare={isGeneratingShare}
        shareUrl={shareUrl}
        onClose={() => setIsSolvedModalOpen(false)}
        onShare={() => {
          void shareSolvedResult();
        }}
        onSignInToShare={signInToShare}
      />
    </main>
  );
}
