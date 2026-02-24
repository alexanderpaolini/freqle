import type { FormEvent } from "react";
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
        <label
          htmlFor="settings-display-hints"
          className="mt-1 flex items-center gap-2 text-sm text-stone-700"
        >
          <input
            id="settings-display-hints"
            type="checkbox"
            checked={displayHints}
            onChange={(event) => onDisplayHintsChange(event.target.checked)}
            disabled={isLoadingAccount || isSavingSettings || isDeletingAccount}
            className="h-4 w-4 rounded border-stone-300"
          />
          Display hints
        </label>
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
