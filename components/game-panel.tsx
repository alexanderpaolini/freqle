import type { FormEvent } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AuthHeader } from "./auth-header";
import { GiveUpBanner } from "./give-up-banner";
import { GuessForm } from "./guess-form";
import { PuzzlePreview } from "./puzzle-preview";
import type { PuzzlePreviewEntry } from "./types";

type GamePanelProps = {
  status: "authenticated" | "loading" | "unauthenticated";
  shownUsername: string;
  isSettingsOpen: boolean;
  settingsName: string;
  friendId: string | null;
  isLoadingAccount: boolean;
  isSavingSettings: boolean;
  isDeletingAccount: boolean;
  previewEntries: PuzzlePreviewEntry[];
  guess: string;
  triesUsed: number;
  isLoadingAttempts: boolean;
  isSubmitting: boolean;
  isGivingUp: boolean;
  isSolved: boolean;
  hasGivenUp: boolean;
  revealedAnswer: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onSettingsOpenChange: (open: boolean) => void;
  onSettingsNameChange: (value: string) => void;
  onSaveSettings: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteAccount: () => void;
  onGuessChange: (value: string) => void;
  onSubmitGuess: (event: FormEvent<HTMLFormElement>) => void;
  onGiveUp: () => void;
  onOpenResults: () => void;
};

export function GamePanel({
  status,
  shownUsername,
  isSettingsOpen,
  settingsName,
  friendId,
  isLoadingAccount,
  isSavingSettings,
  isDeletingAccount,
  previewEntries,
  guess,
  triesUsed,
  isLoadingAttempts,
  isSubmitting,
  isGivingUp,
  isSolved,
  hasGivenUp,
  revealedAnswer,
  onSignIn,
  onSignOut,
  onSettingsOpenChange,
  onSettingsNameChange,
  onSaveSettings,
  onDeleteAccount,
  onGuessChange,
  onSubmitGuess,
  onGiveUp,
  onOpenResults,
}: GamePanelProps) {
  return (
    <Card className="shadow-[0_18px_50px_-28px_rgba(31,29,26,0.45)]">
      <CardContent className="p-6">
        <AuthHeader
          status={status}
          shownUsername={shownUsername}
          isSettingsOpen={isSettingsOpen}
          settingsName={settingsName}
          friendId={friendId}
          isLoadingAccount={isLoadingAccount}
          isSavingSettings={isSavingSettings}
          isDeletingAccount={isDeletingAccount}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
          onSettingsOpenChange={onSettingsOpenChange}
          onSettingsNameChange={onSettingsNameChange}
          onSaveSettings={onSaveSettings}
          onDeleteAccount={onDeleteAccount}
        />

        {status !== "authenticated" ? (
          <p className="mt-3 text-sm text-stone-600">Log in to save your results!</p>
        ) : null}

        <PuzzlePreview entries={previewEntries} />

        <GuessForm
          status={status}
          guess={guess}
          triesUsed={triesUsed}
          isLoadingAttempts={isLoadingAttempts}
          isSubmitting={isSubmitting}
          isGivingUp={isGivingUp}
          isSolved={isSolved}
          hasGivenUp={hasGivenUp}
          onGuessChange={onGuessChange}
          onSubmit={onSubmitGuess}
          onGiveUp={onGiveUp}
          onOpenResults={onOpenResults}
        />

        <GiveUpBanner revealedAnswer={revealedAnswer} />
      </CardContent>
    </Card>
  );
}
