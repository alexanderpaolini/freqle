import type { FormEvent } from "react";
import { Shield } from "lucide-react";
import Link from "next/link";
import { AddFriendDialog } from "./add-friend-dialog";
import { SettingsDialog } from "./settings-dialog";
import { Button } from "@/components/ui/button";

type AuthHeaderProps = {
  status: "authenticated" | "loading" | "unauthenticated";
  shownUsername: string;
  isAdmin: boolean;
  isSettingsOpen: boolean;
  settingsName: string;
  displayHints: boolean;
  friendId: string | null;
  isLoadingAccount: boolean;
  isSavingSettings: boolean;
  isDeletingAccount: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onSettingsOpenChange: (open: boolean) => void;
  onSettingsNameChange: (value: string) => void;
  onDisplayHintsChange: (value: boolean) => void;
  onSaveSettings: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteAccount: () => void;
};

export function AuthHeader({
  status,
  shownUsername,
  isAdmin,
  isSettingsOpen,
  settingsName,
  displayHints,
  friendId,
  isLoadingAccount,
  isSavingSettings,
  isDeletingAccount,
  onSignIn,
  onSignOut,
  onSettingsOpenChange,
  onSettingsNameChange,
  onDisplayHintsChange,
  onSaveSettings,
  onDeleteAccount,
}: AuthHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">
          Daily Hashmap Puzzle
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">freqle</h1>
      </div>

      <div className="flex items-center gap-2">
        {status === "authenticated" ? (
          <>
            <p className="text-sm text-stone-600">@{shownUsername}</p>
            <AddFriendDialog
              currentFriendId={friendId}
              disabled={isLoadingAccount || isDeletingAccount}
            />

            {isAdmin ? (
              <Button asChild type="button" variant="outline" size="icon">
                <Link href="/admin" aria-label="Open admin page">
                  <Shield className="h-4 w-4 text-stone-700" />
                </Link>
              </Button>
            ) : null}

            <SettingsDialog
              open={isSettingsOpen}
              settingsName={settingsName}
              displayHints={displayHints}
              isLoadingAccount={isLoadingAccount}
              isSavingSettings={isSavingSettings}
              isDeletingAccount={isDeletingAccount}
              onOpenChange={onSettingsOpenChange}
              onSettingsNameChange={onSettingsNameChange}
              onDisplayHintsChange={onDisplayHintsChange}
              onSaveSettings={onSaveSettings}
              onDeleteAccount={onDeleteAccount}
            />

            <Button type="button" variant="outline" onClick={onSignOut}>
              Sign out
            </Button>
          </>
        ) : (
          <Button type="button" onClick={onSignIn}>
            Sign in
          </Button>
        )}
      </div>
    </div>
  );
}
