import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SettingsPopoverProps = {
  settingsName: string;
  isLoadingAccount: boolean;
  isSavingSettings: boolean;
  isDeletingAccount: boolean;
  onClose: () => void;
  onSettingsNameChange: (value: string) => void;
  onSaveSettings: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteAccount: () => void;
};

export function SettingsPopover({
  settingsName,
  isLoadingAccount,
  isSavingSettings,
  isDeletingAccount,
  onClose,
  onSettingsNameChange,
  onSaveSettings,
  onDeleteAccount,
}: SettingsPopoverProps) {
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Account Settings</p>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <form onSubmit={onSaveSettings} className="flex flex-col gap-2">
        <Label htmlFor="settings-username">Username</Label>
        <Input
          id="settings-username"
          value={settingsName}
          onChange={(event) => onSettingsNameChange(event.target.value)}
          maxLength={40}
          disabled={isLoadingAccount || isSavingSettings || isDeletingAccount}
        />
        <Button
          type="submit"
          disabled={isLoadingAccount || isSavingSettings || isDeletingAccount}
          className="mt-1"
        >
          {isSavingSettings ? "Saving..." : "Save username"}
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
