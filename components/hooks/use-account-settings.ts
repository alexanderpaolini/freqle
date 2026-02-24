"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { isAbortError } from "../home-client-utils";

type SessionStatus = "authenticated" | "loading" | "unauthenticated";

type UseAccountSettingsOptions = {
  status: SessionStatus;
  fallbackName: string;
  onAccountDeleted?: () => Promise<void> | void;
};

export function useAccountSettings({
  status,
  fallbackName,
  onAccountDeleted,
}: UseAccountSettingsOptions) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [settingsName, setSettingsName] = useState("");
  const [isLoadingAccount, setIsLoadingAccount] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const shownUsername = useMemo(
    () => accountName ?? fallbackName,
    [accountName, fallbackName],
  );

  useEffect(() => {
    if (status !== "authenticated") {
      setAccountName(null);
      setSettingsName("");
      setIsSettingsOpen(false);
      setIsLoadingAccount(false);
      setIsSavingSettings(false);
      setIsDeletingAccount(false);
      return;
    }

    const controller = new AbortController();

    const loadAccount = async () => {
      setIsLoadingAccount(true);

      try {
        const response = await fetch("/api/account", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const payload = (await response.json()) as {
          error?: string;
          displayName?: string;
        };

        if (!response.ok) {
          toast.error(payload.error ?? "Could not load account settings.");
          return;
        }

        const loadedName =
          typeof payload.displayName === "string" && payload.displayName.trim()
            ? payload.displayName.trim()
            : fallbackName;

        setAccountName(loadedName);
        setSettingsName(loadedName);
      } catch (caught) {
        if (isAbortError(caught)) {
          return;
        }
        toast.error("Could not load account settings.");
      } finally {
        setIsLoadingAccount(false);
      }
    };

    void loadAccount();

    return () => {
      controller.abort();
    };
  }, [fallbackName, status]);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (status !== "authenticated" || isSavingSettings) {
      return;
    }

    const trimmedName = settingsName.trim();
    if (!trimmedName) {
      toast.error("Username cannot be empty.");
      return;
    }

    setIsSavingSettings(true);

    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: trimmedName,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        displayName?: string;
      };

      if (!response.ok) {
        toast.error(payload.error ?? "Could not update username.");
        return;
      }

      const nextName =
        typeof payload.displayName === "string" && payload.displayName.trim()
          ? payload.displayName.trim()
          : trimmedName;

      setAccountName(nextName);
      setSettingsName(nextName);
      toast.success("Username updated.");
      setIsSettingsOpen(false);
    } catch {
      toast.error("Could not update username.");
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function deleteAccount() {
    if (status !== "authenticated" || isDeletingAccount) {
      return;
    }

    const confirmed = window.confirm(
      "Delete your account and all related guesses/friend data?",
    );
    if (!confirmed) {
      return;
    }

    setIsDeletingAccount(true);

    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(payload.error ?? "Could not delete account.");
        return;
      }

      setAccountName(null);
      setSettingsName("");
      setIsSettingsOpen(false);

      if (onAccountDeleted) {
        await onAccountDeleted();
      }
    } catch {
      toast.error("Could not delete account.");
    } finally {
      setIsDeletingAccount(false);
    }
  }

  return {
    shownUsername,
    isSettingsOpen,
    setIsSettingsOpen,
    settingsName,
    setSettingsName,
    isLoadingAccount,
    isSavingSettings,
    isDeletingAccount,
    saveSettings,
    deleteAccount,
  };
}
