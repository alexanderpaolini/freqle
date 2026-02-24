import type { FormEvent } from "react";

type SettingsPopoverProps = {
  isOpen: boolean;
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
  isOpen,
  settingsName,
  isLoadingAccount,
  isSavingSettings,
  isDeletingAccount,
  onClose,
  onSettingsNameChange,
  onSaveSettings,
  onDeleteAccount,
}: SettingsPopoverProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute right-0 top-12 z-20 w-72 rounded-2xl border border-stone-300 bg-white p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Account Settings</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-stone-300 px-2 py-0.5 text-xs hover:bg-stone-100"
        >
          Close
        </button>
      </div>

      <form onSubmit={onSaveSettings} className="flex flex-col gap-2">
        <label htmlFor="settings-username" className="text-xs text-stone-500">
          Username
        </label>
        <input
          id="settings-username"
          value={settingsName}
          onChange={(event) => onSettingsNameChange(event.target.value)}
          maxLength={40}
          disabled={isLoadingAccount || isSavingSettings || isDeletingAccount}
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none ring-stone-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-stone-100"
        />
        <button
          type="submit"
          disabled={isLoadingAccount || isSavingSettings || isDeletingAccount}
          className="mt-1 rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {isSavingSettings ? "Saving..." : "Save username"}
        </button>
      </form>

      <button
        type="button"
        onClick={onDeleteAccount}
        disabled={isDeletingAccount || isSavingSettings}
        className="mt-3 w-full rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isDeletingAccount ? "Deleting..." : "Delete account and all data"}
      </button>
    </div>
  );
}
