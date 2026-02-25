"use client";

import { type FormEvent } from "react";
import { Lightbulb, LightbulbOff, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SettingsPopoverProps = {
  settingsName: string;
  displayHints: boolean;
  isLoadingAccount: boolean;
  isSavingSettings: boolean;
  isDeletingAccount: boolean;
  onSettingsNameChange: (value: string) => void;
  onDisplayHintsChange: (value: boolean) => void;
  onSaveSettings: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteAccount: () => void;
};

export function SettingsPopover({
  settingsName,
  displayHints,
  isLoadingAccount,
  isSavingSettings,
  isDeletingAccount,
  onSettingsNameChange,
  onDisplayHintsChange,
  onSaveSettings,
  onDeleteAccount,
}: SettingsPopoverProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const isThemeReady = typeof resolvedTheme === "string";
  const isDarkTheme = resolvedTheme !== "light";

  return (
    <div>
      <form onSubmit={onSaveSettings} className="flex flex-col gap-2">
        <Label htmlFor="settings-username">Username</Label>
        <Input
          id="settings-username"
          value={settingsName}
          onChange={(event) => onSettingsNameChange(event.target.value)}
          maxLength={40}
          disabled={isLoadingAccount || isSavingSettings || isDeletingAccount}
        />
        <div className="mt-1 flex items-center gap-2">
          <div className="group relative">
            <Button
              id="settings-display-hints"
              type="button"
              size="icon-sm"
              variant={displayHints ? "default" : "outline"}
              aria-label="Toggle display hints"
              aria-pressed={displayHints}
              onClick={() => onDisplayHintsChange(!displayHints)}
              disabled={isLoadingAccount || isSavingSettings || isDeletingAccount}
            >
              {displayHints ? (
                <Lightbulb className="h-4 w-4" />
              ) : (
                <LightbulbOff className="h-4 w-4" />
              )}
            </Button>
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded-md border border-border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              Display hints
            </span>
          </div>
          <div className="group relative">
            <Button
              id="settings-dark-theme"
              type="button"
              size="icon-sm"
              variant={isThemeReady && isDarkTheme ? "default" : "outline"}
              aria-label="Toggle dark theme"
              aria-pressed={isThemeReady ? isDarkTheme : true}
              onClick={() => setTheme(isDarkTheme ? "light" : "dark")}
              disabled={
                !isThemeReady ||
                isLoadingAccount ||
                isSavingSettings ||
                isDeletingAccount
              }
            >
              {isThemeReady && isDarkTheme ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </Button>
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded-md border border-border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              Dark theme
            </span>
          </div>
        </div>
        <Button
          type="submit"
          disabled={isLoadingAccount || isSavingSettings || isDeletingAccount}
          className="mt-1"
        >
          {isSavingSettings ? "Saving..." : "Save settings"}
        </Button>
      </form>

      <Button
        type="button"
        variant="destructive"
        onClick={onDeleteAccount}
        disabled={isDeletingAccount || isSavingSettings}
        className="mt-3 w-full"
      >
        {isDeletingAccount ? "Deleting..." : "Delete account and all data"}
      </Button>
    </div>
  );
}
