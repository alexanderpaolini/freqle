"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import {
  buildShareUrl,
  copyTextToClipboard,
  isAbortError,
  OPEN_RESULTS_AFTER_AUTH_STORAGE_KEY,
  PENDING_SHARE_STORAGE_KEY,
  REQUEST_TIMEOUT_MS,
} from "../home-client-utils";

type SessionStatus = "authenticated" | "loading" | "unauthenticated";

type UseShareFlowOptions = {
  dateKey: string;
  status: SessionStatus;
  sessionUserId?: string;
  sharedLinkId: string | null;
  isSolved: boolean;
  hasGivenUp: boolean;
  triesUsed: number;
  isPuzzleComplete: boolean;
  isSolvedModalOpen: boolean;
  onOpenResultsAfterAuth: () => void;
};

export function useShareFlow({
  dateKey,
  status,
  sessionUserId,
  sharedLinkId,
  isSolved,
  hasGivenUp,
  triesUsed,
  isPuzzleComplete,
  isSolvedModalOpen,
  onOpenResultsAfterAuth,
}: UseShareFlowOptions) {
  const [generatedShareId, setGeneratedShareId] = useState<string | null>(null);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);

  const autoShareRequestedRef = useRef(false);
  const shareRequestRef = useRef<Promise<string | null> | null>(null);

  const shareUrl = useMemo(
    () =>
      generatedShareId && typeof window !== "undefined"
        ? buildShareUrl(generatedShareId)
        : "",
    [generatedShareId],
  );

  const clearShareState = useCallback(() => {
    autoShareRequestedRef.current = false;
    shareRequestRef.current = null;
    setGeneratedShareId(null);
    setIsGeneratingShare(false);
  }, []);

  const ensureShareId = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;

      if (generatedShareId) {
        return generatedShareId;
      }

      if (status !== "authenticated") {
        if (!silent) {
          toast.error("Sign in to generate a share link.");
        }
        return null;
      }

      if (shareRequestRef.current) {
        return shareRequestRef.current;
      }

      const requestPromise = (async () => {
        setIsGeneratingShare(true);
        const controller = new AbortController();
        const timeoutHandle = window.setTimeout(() => {
          controller.abort();
        }, REQUEST_TIMEOUT_MS);

        try {
          const response = await fetch("/api/share", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            cache: "no-store",
            signal: controller.signal,
            body: JSON.stringify({
              dateKey,
              localSolved: isSolved,
              localGaveUp: hasGivenUp,
              localTries: triesUsed,
            }),
          });

          const payload = (await response.json()) as {
            error?: string;
            shareId?: string;
          };

          if (!response.ok) {
            if (!silent) {
              toast.error(payload.error ?? "Could not generate a share link.");
            }
            return null;
          }

          if (!payload.shareId) {
            if (!silent) {
              toast.error("Could not generate a share link.");
            }
            return null;
          }

          setGeneratedShareId(payload.shareId);
          return payload.shareId;
        } catch (caught) {
          if (!silent) {
            if (isAbortError(caught)) {
              toast.error("Share generation timed out. Try again.");
            } else {
              toast.error("Could not generate a share link.");
            }
          }
          return null;
        } finally {
          window.clearTimeout(timeoutHandle);
          setIsGeneratingShare(false);
          shareRequestRef.current = null;
        }
      })();

      shareRequestRef.current = requestPromise;
      return requestPromise;
    },
    [dateKey, generatedShareId, hasGivenUp, isSolved, status, triesUsed],
  );

  useEffect(() => {
    if (
      !isSolvedModalOpen ||
      !isPuzzleComplete ||
      status !== "authenticated"
    ) {
      autoShareRequestedRef.current = false;
      return;
    }

    if (
      generatedShareId ||
      isGeneratingShare ||
      autoShareRequestedRef.current
    ) {
      return;
    }

    autoShareRequestedRef.current = true;
    void ensureShareId({ silent: true });
  }, [
    ensureShareId,
    generatedShareId,
    isGeneratingShare,
    isPuzzleComplete,
    isSolvedModalOpen,
    status,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (sharedLinkId) {
      window.sessionStorage.setItem(PENDING_SHARE_STORAGE_KEY, sharedLinkId);
    }
  }, [sharedLinkId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (status !== "authenticated") {
      return;
    }

    const shouldOpenResults = window.sessionStorage.getItem(
      OPEN_RESULTS_AFTER_AUTH_STORAGE_KEY,
    );
    if (!shouldOpenResults) {
      return;
    }

    if (!isPuzzleComplete) {
      return;
    }

    window.sessionStorage.removeItem(OPEN_RESULTS_AFTER_AUTH_STORAGE_KEY);
    onOpenResultsAfterAuth();
  }, [isPuzzleComplete, onOpenResultsAfterAuth, status]);

  useEffect(() => {
    if (
      status !== "authenticated" ||
      !sessionUserId ||
      typeof window === "undefined"
    ) {
      return;
    }

    const pendingShareId = window.sessionStorage.getItem(
      PENDING_SHARE_STORAGE_KEY,
    );
    if (!pendingShareId) {
      return;
    }

    const linkFromShare = async () => {
      try {
        const response = await fetch("/api/share/link", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            shareId: pendingShareId,
          }),
        });

        if (response.status === 400 || response.status === 404) {
          window.sessionStorage.removeItem(PENDING_SHARE_STORAGE_KEY);
          return;
        }

        if (!response.ok) {
          return;
        }

        window.sessionStorage.removeItem(PENDING_SHARE_STORAGE_KEY);
        toast.success("Friend link saved.");
      } catch {
        // Ignore and retry next session refresh.
      }
    };

    void linkFromShare();
  }, [sessionUserId, status]);

  useEffect(() => {
    if (isPuzzleComplete) {
      return;
    }

    clearShareState();
  }, [clearShareState, isPuzzleComplete]);

  async function shareSolvedResult() {
    if (typeof window === "undefined") {
      return;
    }

    if (!generatedShareId) {
      if (!isGeneratingShare) {
        toast.error("Preparing share link. Try again in a moment.");
        void ensureShareId();
      }
      return;
    }

    const nextShareUrl = buildShareUrl(generatedShareId);

    const copied = await copyTextToClipboard(nextShareUrl);
    if (copied) {
      toast.success("Copied to clipboard");
      return;
    }

    const shareId = await ensureShareId();
    if (!shareId) {
      return;
    }

    const retryCopied = await copyTextToClipboard(buildShareUrl(shareId));
    if (retryCopied) {
      toast.success("Copied to clipboard");
      return;
    }

    toast.error("Unable to copy link right now.");
  }

  function signInToShare() {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(OPEN_RESULTS_AFTER_AUTH_STORAGE_KEY, "1");
    }

    void signIn("discord");
  }

  return {
    isGeneratingShare,
    shareUrl,
    shareSolvedResult,
    signInToShare,
    clearShareState,
  };
}
