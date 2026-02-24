import type { FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copyTextToClipboard } from "./home-client-utils";

type SettingsPopoverProps = {
  settingsName: string;
  friendId: string | null;
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
  friendId,
  isLoadingAccount,
  isSavingSettings,
  isDeletingAccount,
  onClose,
  onSettingsNameChange,
  onSaveSettings,
  onDeleteAccount,
}: SettingsPopoverProps) {
  async function copyFriendId() {
    if (!friendId) {
      return;
    }

    const copied = await copyTextToClipboard(friendId);
    if (copied) {
      toast.success("Friend ID copied.");
      return;
    }

    toast.error("Could not copy friend ID.");
  }

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

      <div className="mt-3 rounded-md border border-stone-200 bg-stone-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-600">
          Your friend ID
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Input
            value={friendId ?? ""}
            readOnly
            placeholder={isLoadingAccount ? "Loading..." : "Unavailable"}
            className="font-mono text-xs"
            disabled={isLoadingAccount}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!friendId || isLoadingAccount}
            onClick={() => {
              void copyFriendId();
            }}
          >
            Copy
          </Button>
        </div>
      </div>

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
