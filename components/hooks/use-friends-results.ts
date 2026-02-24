"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { FriendResult } from "@/components/types";
import { isAbortError, REQUEST_TIMEOUT_MS } from "@/components/home-client-utils";

type SessionStatus = "authenticated" | "loading" | "unauthenticated";

type UseFriendsResultsOptions = {
  dateKey: string;
  status: SessionStatus;
  isOpen: boolean;
};

export function useFriendsResults({
  dateKey,
  status,
  isOpen,
}: UseFriendsResultsOptions) {
  const [friendsResults, setFriendsResults] = useState<FriendResult[]>([]);
  const [isLoadingFriendsResults, setIsLoadingFriendsResults] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || !isOpen) {
      return;
    }

    const controller = new AbortController();
    const timeoutHandle = window.setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    const loadFriendsResults = async () => {
      setIsLoadingFriendsResults(true);

      try {
        const response = await fetch(
          `/api/friends/results?dateKey=${encodeURIComponent(dateKey)}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const payload = (await response.json()) as {
          error?: string;
          friends?: FriendResult[];
        };

        if (!response.ok) {
          toast.error(payload.error ?? "Could not load friend results.");
          return;
        }

        setFriendsResults(Array.isArray(payload.friends) ? payload.friends : []);
      } catch (caught) {
        if (isAbortError(caught)) {
          return;
        }

        toast.error("Could not load friend results.");
      } finally {
        window.clearTimeout(timeoutHandle);
        setIsLoadingFriendsResults(false);
      }
    };

    void loadFriendsResults();

    return () => {
      controller.abort();
      window.clearTimeout(timeoutHandle);
    };
  }, [dateKey, isOpen, status]);

  return {
    friendsResults,
    isLoadingFriendsResults,
  };
}
