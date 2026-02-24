import type { FormEvent } from "react";
import { Cog } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  onSettingsOpenChange: (open: boolean) => void;
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
  onSettingsOpenChange,
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
            <Button type="button" variant="outline" onClick={onSignOut}>
              Sign out
            </Button>

            <DropdownMenu
              open={isSettingsOpen}
              onOpenChange={onSettingsOpenChange}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Open settings"
                >
                  <Cog className="h-4 w-4 text-stone-700" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 p-0">
                <SettingsPopover
                  settingsName={settingsName}
                  isLoadingAccount={isLoadingAccount}
                  isSavingSettings={isSavingSettings}
                  isDeletingAccount={isDeletingAccount}
                  onClose={() => onSettingsOpenChange(false)}
                  onSettingsNameChange={onSettingsNameChange}
                  onSaveSettings={onSaveSettings}
                  onDeleteAccount={onDeleteAccount}
                />
              </DropdownMenuContent>
            </DropdownMenu>
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
