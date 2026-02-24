import type { FormEvent } from "react";
import { Cog } from "lucide-react";
import { SettingsPopover } from "./settings-popover";

type AuthHeaderProps = {
  status: "authenticated" | "loading" | "unauthenticated";
  shownUsername: string;
  isSettingsOpen: boolean;
  settingsName: string;
  isLoadingAccount: boolean;
  isSavingSettings: boolean;
  isDeletingAccount: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onToggleSettings: () => void;
  onCloseSettings: () => void;
  onSettingsNameChange: (value: string) => void;
  onSaveSettings: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteAccount: () => void;
};

export function AuthHeader({
  status,
  shownUsername,
  isSettingsOpen,
  settingsName,
  isLoadingAccount,
  isSavingSettings,
  isDeletingAccount,
  onSignIn,
  onSignOut,
  onToggleSettings,
  onCloseSettings,
  onSettingsNameChange,
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
            <button
              type="button"
              onClick={onSignOut}
              className="rounded-full border border-stone-400 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-100"
            >
              Sign out
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={onToggleSettings}
                aria-label="Open settings"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-400 bg-white hover:bg-stone-100"
              >
                <Cog className="h-4 w-4 text-stone-700" />
              </button>

              <SettingsPopover
                isOpen={isSettingsOpen}
                settingsName={settingsName}
                isLoadingAccount={isLoadingAccount}
                isSavingSettings={isSavingSettings}
                isDeletingAccount={isDeletingAccount}
                onClose={onCloseSettings}
                onSettingsNameChange={onSettingsNameChange}
                onSaveSettings={onSaveSettings}
                onDeleteAccount={onDeleteAccount}
              />
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={onSignIn}
            className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700"
          >
            Sign in
          </button>
        )}
      </div>
    </div>
  );
}
