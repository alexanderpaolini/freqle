"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { GuessResult } from "../types";
import {
  clearAnonymousIdFromStorage,
  clearAttemptFromStorage,
  getOrCreateAnonymousId,
  isAbortError,
  readAnonymousIdFromStorage,
  readAttemptFromStorage,
  writeAttemptToStorage,
} from "../home-client-utils";

type SessionStatus = "authenticated" | "loading" | "unauthenticated";

type UseGameAttemptsOptions = {
  dateKey: string;
  status: SessionStatus;
};

export function useGameAttempts({ dateKey, status }: UseGameAttemptsOptions) {
  const [guess, setGuess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingAttempts, setIsLoadingAttempts] = useState(false);
  const [isGivingUp, setIsGivingUp] = useState(false);
  const [hasLoadedLocal, setHasLoadedLocal] = useState(false);
  const [results, setResults] = useState<GuessResult[]>([]);
  const [hasGivenUp, setHasGivenUp] = useState(false);
  const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null);

  const solvedIndex = results.findIndex((entry) => entry.correct);
  const isSolved = solvedIndex >= 0;
  const isPuzzleComplete = isSolved || hasGivenUp;
  const triesUsed = isSolved ? solvedIndex + 1 : results.length;
  const attemptsForDisplay = useMemo(
    () => results.map((result, index) => ({ result, index })).slice().reverse(),
    [results],
  );

  useEffect(() => {
    if (status === "authenticated") {
      setHasLoadedLocal(false);
      return;
    }

    if (status !== "unauthenticated") {
      return;
    }

    setHasLoadedLocal(false);
    getOrCreateAnonymousId();
    const localResults = readAttemptFromStorage(dateKey);
    setResults(localResults);
    setHasGivenUp(false);
    setRevealedAnswer(null);
    setHasLoadedLocal(true);
  }, [dateKey, status]);

  useEffect(() => {
    if (status !== "unauthenticated" || !hasLoadedLocal) {
      return;
    }

    writeAttemptToStorage(dateKey, results);
  }, [dateKey, hasLoadedLocal, results, status]);

  useEffect(() => {
    if (status !== "authenticated") {
      setIsLoadingAttempts(false);
      setIsSubmitting(false);
      setHasGivenUp(false);
      setRevealedAnswer(null);
      setIsGivingUp(false);
      return;
    }

    const controller = new AbortController();

    const loadAttempts = async () => {
      setIsLoadingAttempts(true);

      try {
        const localResults = readAttemptFromStorage(dateKey);
        const anonymousId = readAnonymousIdFromStorage();

        if (localResults.length > 0 || anonymousId) {
          const syncResponse = await fetch("/api/guess/sync", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              dateKey,
              guesses: localResults.map((entry) => entry.guess),
              anonymousId,
            }),
            signal: controller.signal,
          });

          if (!syncResponse.ok) {
            const syncPayload = (await syncResponse.json()) as {
              error?: string;
            };
            toast.error(syncPayload.error ?? "Could not sync local attempts.");
          } else {
            clearAttemptFromStorage(dateKey);
            clearAnonymousIdFromStorage();
          }
        }

        const response = await fetch(
          `/api/guess?dateKey=${encodeURIComponent(dateKey)}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const payload = (await response.json()) as {
          error?: string;
          results?: GuessResult[];
          gaveUp?: boolean;
          revealedAnswer?: string | null;
        };

        if (!response.ok) {
          toast.error(payload.error ?? "Could not load saved attempts.");
          return;
        }

        const nextGaveUp = payload.gaveUp === true;
        setResults(Array.isArray(payload.results) ? payload.results : []);
        setHasGivenUp(nextGaveUp);
        setRevealedAnswer(
          nextGaveUp && typeof payload.revealedAnswer === "string"
            ? payload.revealedAnswer
            : null,
        );
      } catch (caught) {
        if (isAbortError(caught)) {
          return;
        }
        toast.error("Could not load saved attempts.");
      } finally {
        setIsLoadingAttempts(false);
      }
    };

    void loadAttempts();

    return () => {
      controller.abort();
    };
  }, [dateKey, status]);

  async function submitGuess(): Promise<boolean> {
    const trimmedGuess = guess.trim();
    if (
      !trimmedGuess ||
      isSubmitting ||
      isGivingUp ||
      isLoadingAttempts ||
      isSolved ||
      hasGivenUp
    ) {
      return false;
    }

    setIsSubmitting(true);

    try {
      const anonymousId =
        status === "authenticated" ? null : getOrCreateAnonymousId();
      if (status !== "authenticated" && !anonymousId) {
        toast.error("Could not initialize anonymous session.");
        return false;
      }

      const response = await fetch("/api/guess", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          guess: trimmedGuess,
          dateKey,
          anonymousId,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        score?: number;
        correct?: boolean;
        reason?: string;
      };

      if (!response.ok) {
        toast.error(payload.error ?? "Could not evaluate your guess.");
        return false;
      }

      const solved = Boolean(payload.correct);
      setResults((previous) => [
        ...previous,
        {
          guess: trimmedGuess,
          score: typeof payload.score === "number" ? payload.score : 0,
          correct: solved,
          reason: typeof payload.reason === "string" ? payload.reason : "",
        },
      ]);
      setGuess("");
      return solved;
    } catch {
      toast.error("Request failed. Try again.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function giveUp(): Promise<boolean> {
    if (
      status !== "authenticated" ||
      isSubmitting ||
      isGivingUp ||
      isSolved ||
      hasGivenUp
    ) {
      return false;
    }

    const confirmed = window.confirm(
      "Give up for today? This will reveal the answer for this account.",
    );
    if (!confirmed) {
      return false;
    }

    setIsGivingUp(true);

    try {
      const response = await fetch("/api/guess/give-up", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateKey,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        gaveUp?: boolean;
        revealedAnswer?: string | null;
      };

      if (!response.ok) {
        toast.error(payload.error ?? "Could not give up right now.");
        return false;
      }

      setHasGivenUp(payload.gaveUp === true);
      setRevealedAnswer(
        typeof payload.revealedAnswer === "string" ? payload.revealedAnswer : null,
      );
      return true;
    } catch {
      toast.error("Could not give up right now.");
      return false;
    } finally {
      setIsGivingUp(false);
    }
  }

  function resetGameplayState() {
    setResults([]);
    setGuess("");
    setIsSubmitting(false);
    setIsLoadingAttempts(false);
    setHasGivenUp(false);
    setRevealedAnswer(null);
    setIsGivingUp(false);
  }

  return {
    guess,
    setGuess,
    isSubmitting,
    isLoadingAttempts,
    isGivingUp,
    results,
    hasGivenUp,
    revealedAnswer,
    isSolved,
    isPuzzleComplete,
    triesUsed,
    attemptsForDisplay,
    submitGuess,
    giveUp,
    resetGameplayState,
  };
}
