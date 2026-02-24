"use client";

import type { FormEvent } from "react";
import { Cog } from "lucide-react";
import { SettingsPopover } from "./settings-popover";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type SettingsDialogProps = {
  open: boolean;
  settingsName: string;
  displayHints: boolean;
  isLoadingAccount: boolean;
  isSavingSettings: boolean;
  isDeletingAccount: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsNameChange: (value: string) => void;
  onDisplayHintsChange: (value: boolean) => void;
  onSaveSettings: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteAccount: () => void;
};

export function SettingsDialog({
  open,
  settingsName,
  displayHints,
  isLoadingAccount,
  isSavingSettings,
  isDeletingAccount,
  onOpenChange,
  onSettingsNameChange,
  onDisplayHintsChange,
  onSaveSettings,
  onDeleteAccount,
}: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label="Open settings">
          <Cog className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Update your profile, appearance, and friend code settings.
          </DialogDescription>
        </DialogHeader>
        <SettingsPopover
          settingsName={settingsName}
          displayHints={displayHints}
          isLoadingAccount={isLoadingAccount}
          isSavingSettings={isSavingSettings}
          isDeletingAccount={isDeletingAccount}
          onSettingsNameChange={onSettingsNameChange}
          onDisplayHintsChange={onDisplayHintsChange}
          onSaveSettings={onSaveSettings}
          onDeleteAccount={onDeleteAccount}
        />
      </DialogContent>
    </Dialog>
  );
}
