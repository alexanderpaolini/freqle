"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Cog } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import { toast } from "sonner";
import { redirect } from "next/navigation";

const DEFAULT_DISTRIBUTION_BUCKETS = 6;
const PREVIEW_ENTRIES = [
  ["28", "1"],
  ["30", "4"],
  ["31", "7"],
] as const;
const SOLUTION_LABEL = "The number of days in each month (non leap year).";
const PENDING_SHARE_STORAGE_KEY = "freqle:pending-share-id";
const OPEN_RESULTS_AFTER_AUTH_STORAGE_KEY = "freqle:open-results-after-auth";
const SHARE_REQUEST_TIMEOUT_MS = 12000;

type GuessResult = {
  guess: string;
  score: number;
  correct: boolean;
};

type DistributionBucket = {
  tries: number;
  count: number;
};

type PuzzleStats = {
  totalSolves: number;
  average: number | null;
  median: number | null;
  distribution: DistributionBucket[];
};

type SharedSummary = {
  ownerName: string;
  tries: number;
  dateKey: string;
  gaveUp: boolean;
};

type HomeClientProps = {
  sharedLinkId: string | null;
  sharedSummary: SharedSummary | null;
};

export function HomeClient({ sharedLinkId }: HomeClientProps) {
  const { data: session, status } = useSession();
  const [guess, setGuess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingAttempts, setIsLoadingAttempts] = useState(false);
  const [isGivingUp, setIsGivingUp] = useState(false);
  const [hasLoadedLocal, setHasLoadedLocal] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [settingsName, setSettingsName] = useState("");
  const [isLoadingAccount, setIsLoadingAccount] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [generatedShareId, setGeneratedShareId] = useState<string | null>(null);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [isSolvedModalOpen, setIsSolvedModalOpen] = useState(false);
  const [stats, setStats] = useState<PuzzleStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [results, setResults] = useState<GuessResult[]>([]);
  const [hasGivenUp, setHasGivenUp] = useState(false);

  const dateKey = useMemo(getDateKey, []);
  const solvedIndex = results.findIndex((entry) => entry.correct);
  const isSolved = solvedIndex >= 0;
  const isPuzzleComplete = isSolved || hasGivenUp;
  const triesUsed = isSolved ? solvedIndex + 1 : results.length;
  const shareUrl =
    generatedShareId && typeof window !== "undefined"
      ? buildShareUrl(generatedShareId)
      : "";
  const shownUsername = accountName ?? session?.user?.name ?? "player";
  const distribution =
    stats && stats.distribution.length > 0
      ? stats.distribution
      : new Array(DEFAULT_DISTRIBUTION_BUCKETS)
          .fill(0)
          .map((_, index) => ({ tries: index + 1, count: 0 }));
  const maxDistributionCount = Math.max(
    1,
    ...distribution.map((entry) => entry.count),
  );
  const attemptsForDisplay = results
    .map((result, index) => ({ result, index }))
    .slice()
    .reverse();

  useEffect(() => {
    if (status === "authenticated") {
      setHasLoadedLocal(false);
      return;
    }

    if (status !== "unauthenticated") {
      return;
    }

    setHasLoadedLocal(false);
    const localResults = readAttemptFromStorage(dateKey);
    setResults(localResults);
    setHasGivenUp(false);
    setHasLoadedLocal(true);
  }, [dateKey, status]);

  useEffect(() => {
    if (status !== "unauthenticated" || !hasLoadedLocal) {
      return;
    }
    writeAttemptToStorage(dateKey, results);
  }, [dateKey, hasLoadedLocal, results, status]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutHandle = window.setTimeout(() => {
      controller.abort();
    }, SHARE_REQUEST_TIMEOUT_MS);

    const loadStats = async () => {
      setIsLoadingStats(true);
      try {
        const response = await fetch(
          `/api/stats?dateKey=${encodeURIComponent(dateKey)}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const payload = (await response.json()) as {
          totalSolves?: number;
          average?: number | null;
          median?: number | null;
          distribution?: DistributionBucket[];
        };

        if (!response.ok) {
          return;
        }

        setStats({
          totalSolves:
            typeof payload.totalSolves === "number" ? payload.totalSolves : 0,
          average: typeof payload.average === "number" ? payload.average : null,
          median: typeof payload.median === "number" ? payload.median : null,
          distribution: Array.isArray(payload.distribution)
            ? payload.distribution
            : [],
        });
      } catch (caught) {
        if (
          caught &&
          typeof caught === "object" &&
          "name" in caught &&
          caught.name === "AbortError"
        ) {
          return;
        }
      } finally {
        window.clearTimeout(timeoutHandle);
        setIsLoadingStats(false);
      }
    };

    void loadStats();

    return () => {
      controller.abort();
      window.clearTimeout(timeoutHandle);
    };
  }, [dateKey, isSolvedModalOpen]);

  useEffect(() => {
    if (isPuzzleComplete) {
      return;
    }

    setIsSolvedModalOpen(false);
    setGeneratedShareId(null);
    setIsGeneratingShare(false);
  }, [isPuzzleComplete]);

  useEffect(() => {
    if (
      !isSolvedModalOpen ||
      !isPuzzleComplete ||
      status !== "authenticated" ||
      generatedShareId ||
      isGeneratingShare
    ) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    let timeoutHandle: number | null = null;

    const autoGenerateShareId = async () => {
      try {
        timeoutHandle = window.setTimeout(() => {
          controller.abort();
        }, SHARE_REQUEST_TIMEOUT_MS);

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

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { shareId?: string };
        if (!cancelled && payload.shareId) {
          setGeneratedShareId(payload.shareId);
        }
      } catch {
        // Silent pre-generation.
      } finally {
        if (timeoutHandle !== null) {
          window.clearTimeout(timeoutHandle);
        }
      }
    };

    void autoGenerateShareId();

    return () => {
      cancelled = true;
      controller.abort();
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [
    dateKey,
    generatedShareId,
    isGeneratingShare,
    hasGivenUp,
    isSolved,
    isPuzzleComplete,
    isSolvedModalOpen,
    triesUsed,
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

    window.sessionStorage.removeItem(OPEN_RESULTS_AFTER_AUTH_STORAGE_KEY);
    if (isSolved) {
      setIsSolvedModalOpen(true);
    }
  }, [isSolved, status]);

  useEffect(() => {
    if (status !== "authenticated") {
      setAccountName(null);
      setSettingsName("");
      setIsSettingsOpen(false);
      setIsLoadingAccount(false);
      setHasGivenUp(false);
      setIsGivingUp(false);
      setGeneratedShareId(null);
      setIsGeneratingShare(false);
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

        const fallbackName = session?.user?.name ?? "player";
        const loadedName =
          typeof payload.displayName === "string" && payload.displayName.trim()
            ? payload.displayName.trim()
            : fallbackName;

        setAccountName(loadedName);
        setSettingsName(loadedName);
      } catch (caught) {
        if (
          caught &&
          typeof caught === "object" &&
          "name" in caught &&
          caught.name === "AbortError"
        ) {
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
  }, [session?.user?.name, status]);

  useEffect(() => {
    if (status !== "authenticated") {
      setIsLoadingAttempts(false);
      setHasGivenUp(false);
      setIsGivingUp(false);
      return;
    }

    const controller = new AbortController();
    const loadAttempts = async () => {
      setIsLoadingAttempts(true);

      try {
        const localResults = readAttemptFromStorage(dateKey);
        if (localResults.length > 0) {
          const syncResponse = await fetch("/api/guess/sync", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              dateKey,
              guesses: localResults.map((entry) => entry.guess),
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
        };

        if (!response.ok) {
          toast.error(payload.error ?? "Could not load saved attempts.");
          return;
        }

        setResults(Array.isArray(payload.results) ? payload.results : []);
        setHasGivenUp(payload.gaveUp === true);
      } catch (caught) {
        if (
          caught &&
          typeof caught === "object" &&
          "name" in caught &&
          caught.name === "AbortError"
        ) {
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

  useEffect(() => {
    if (
      status !== "authenticated" ||
      !session?.user?.id ||
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

        window.location = "/";
      } catch {
        // Ignore and retry next session refresh.
      }
    };

    void linkFromShare();
  }, [session?.user?.id, status]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !guess.trim() ||
      isSubmitting ||
      isGivingUp ||
      isLoadingAttempts ||
      isSolved ||
      hasGivenUp
    ) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/guess", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          guess: guess.trim(),
          dateKey,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        score?: number;
        correct?: boolean;
      };

      if (!response.ok) {
        toast.error(payload.error ?? "Could not evaluate your guess.");
        return;
      }

      setResults((previous) => [
        ...previous,
        {
          guess: guess.trim(),
          score: typeof payload.score === "number" ? payload.score : 0,
          correct: Boolean(payload.correct),
        },
      ]);
      setGuess("");
      if (payload.correct) {
        setIsSolvedModalOpen(true);
      }
    } catch {
      toast.error("Request failed. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function giveUp() {
    if (
      status !== "authenticated" ||
      isSubmitting ||
      isGivingUp ||
      isSolved ||
      hasGivenUp
    ) {
      return;
    }

    const confirmed = window.confirm(
      "Give up for today? This will reveal the answer for this account.",
    );
    if (!confirmed) {
      return;
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
      };
      if (!response.ok) {
        toast.error(payload.error ?? "Could not give up right now.");
        return;
      }

      setHasGivenUp(payload.gaveUp === true);
      setIsSolvedModalOpen(false);
      setGeneratedShareId(null);
    } catch {
      toast.error("Could not give up right now.");
    } finally {
      setIsGivingUp(false);
    }
  }

  async function shareSolvedResult() {
    const shareId = await ensureShareId();
    if (!shareId || typeof window === "undefined") {
      return;
    }

    const nextShareUrl = buildShareUrl(shareId);
    const copied = await copyTextToClipboard(nextShareUrl);
    if (copied) {
      toast.success("Copied to clipboard");
    } else {
      toast.error("Unable to copy link right now.");
    }
  }

  function signInToShare() {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(OPEN_RESULTS_AFTER_AUTH_STORAGE_KEY, "1");
    }
    void signIn("discord");
  }

  async function ensureShareId(options?: { silent?: boolean }) {
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

    setIsGeneratingShare(true);
    const controller = new AbortController();
    const timeoutHandle = window.setTimeout(() => {
      controller.abort();
    }, SHARE_REQUEST_TIMEOUT_MS);

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
    }
  }

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

      clearFreqleLocalState();
      setResults([]);
      setHasGivenUp(false);
      setIsGivingUp(false);
      setAccountName(null);
      setSettingsName("");
      setIsSettingsOpen(false);
      setGeneratedShareId(null);
      await signOut({ callbackUrl: "/" });
    } catch {
      toast.error("Could not delete account.");
    } finally {
      setIsDeletingAccount(false);
    }
  }

  async function signOutAndClearLocalData() {
    clearFreqleLocalState();
    setResults([]);
    setGuess("");
    setHasGivenUp(false);
    setIsGivingUp(false);
    setGeneratedShareId(null);
    setIsSolvedModalOpen(false);
    await signOut({ callbackUrl: "/" });
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fef6e7,_#f8efe2_45%,_#efe5d6)] px-4 py-8 text-stone-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <section className="rounded-3xl border border-stone-300/70 bg-[#fffdf7] p-6 shadow-[0_18px_50px_-28px_rgba(31,29,26,0.45)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">
                Daily Hashmap Puzzle
              </p>
              <h1 className="text-4xl font-semibold tracking-tight">freqle</h1>
            </div>
            <div className="flex items-center gap-2">
              {status === "authenticated" ? (
                <>
                  <p className="text-sm text-stone-600">@{shownUsername}</p>
                  <button
                    type="button"
                    onClick={() => {
                      void signOutAndClearLocalData();
                    }}
                    className="rounded-full border border-stone-400 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-100"
                  >
                    Sign out
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsSettingsOpen((value) => !value)}
                      aria-label="Open settings"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-400 bg-white hover:bg-stone-100"
                    >
                      <Cog className="h-4 w-4 text-stone-700" />
                    </button>

                    {isSettingsOpen ? (
                      <div className="absolute right-0 top-12 z-20 w-72 rounded-2xl border border-stone-300 bg-white p-4 shadow-xl">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-semibold">
                            Account Settings
                          </p>
                          <button
                            type="button"
                            onClick={() => setIsSettingsOpen(false)}
                            className="rounded-full border border-stone-300 px-2 py-0.5 text-xs hover:bg-stone-100"
                          >
                            Close
                          </button>
                        </div>

                        <form
                          onSubmit={saveSettings}
                          className="flex flex-col gap-2"
                        >
                          <label
                            htmlFor="settings-username"
                            className="text-xs text-stone-500"
                          >
                            Username
                          </label>
                          <input
                            id="settings-username"
                            value={settingsName}
                            onChange={(event) =>
                              setSettingsName(event.target.value)
                            }
                            maxLength={40}
                            disabled={
                              isLoadingAccount ||
                              isSavingSettings ||
                              isDeletingAccount
                            }
                            className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none ring-stone-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-stone-100"
                          />
                          <button
                            type="submit"
                            disabled={
                              isLoadingAccount ||
                              isSavingSettings ||
                              isDeletingAccount
                            }
                            className="mt-1 rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
                          >
                            {isSavingSettings ? "Saving..." : "Save username"}
                          </button>
                        </form>

                        <button
                          type="button"
                          onClick={deleteAccount}
                          disabled={isDeletingAccount || isSavingSettings}
                          className="mt-3 w-full rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeletingAccount
                            ? "Deleting..."
                            : "Delete account and all data"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => signIn("discord")}
                  className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700"
                >
                  Sign in
                </button>
              )}
            </div>
          </div>

          {status !== "authenticated" ? (
            <p className="mt-3 text-sm text-stone-600">
              Log in to save your results!
            </p>
          ) : null}

          <div className="mt-5 rounded-2xl border border-stone-300 bg-stone-950 p-4 text-stone-100">
            <pre className="mt-2 overflow-x-auto font-mono text-lg leading-relaxed">
              {PREVIEW_ENTRIES.map(
                ([key, value]) => `${key.padStart(2, " ")}: ${value}\n`,
              )}
            </pre>
          </div>

          <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
            <textarea
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              placeholder="guess goes here"
              disabled={
                isLoadingAttempts || isSolved || hasGivenUp || isGivingUp
              }
              className="min-h-24 w-full rounded-2xl border border-stone-300 bg-white p-3 text-base outline-none ring-stone-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-stone-100"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">
                {triesUsed} {triesUsed === 1 ? "attempt" : "attempts"} used
              </p>
              {isSolved || hasGivenUp ? (
                <button
                  type="button"
                  onClick={() => setIsSolvedModalOpen(true)}
                  className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700"
                >
                  Results
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  {status === "authenticated" && !hasGivenUp ? (
                    <button
                      type="button"
                      onClick={giveUp}
                      disabled={
                        isLoadingAttempts ||
                        isSubmitting ||
                        isGivingUp ||
                        hasGivenUp
                      }
                      className="rounded-full border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isGivingUp ? "Giving up..." : "Give up"}
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    disabled={
                      isLoadingAttempts ||
                      isSubmitting ||
                      isGivingUp ||
                      hasGivenUp ||
                      !guess.trim()
                    }
                    className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
                  >
                    {isSubmitting ? "Checking..." : "Submit Guess"}
                  </button>
                </div>
              )}
            </div>
          </form>

          {hasGivenUp ? (
            <div className="mt-5 rounded-lg bg-red-100 px-3 py-2 text-sm text-amber-900">
              <p>You gave up. Today&apos;s answer was: </p>
              <p className="font-bold">{SOLUTION_LABEL}</p>
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-stone-300/70 bg-[#fffdf7] p-6">
          <h2 className="text-xl font-semibold">Attempts</h2>
          {status === "authenticated" && isLoadingAttempts ? (
            <p className="mt-3 text-sm text-stone-600">
              Loading saved attempts...
            </p>
          ) : results.length === 0 ? (
            <p className="mt-3 text-sm text-stone-600">No guesses yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {attemptsForDisplay.map(({ result, index }) => (
                <li
                  key={`${result.guess}-${index}`}
                  className="rounded-xl border border-stone-300 bg-white p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{result.guess}</p>
                    <p
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${
                        result.correct
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {result.correct ? "Correct" : "Incorrect"}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-stone-600">
                    Closeness score:{" "}
                    <span className="font-semibold">{result.score}</span>/100
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {isSolvedModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-8">
          <div
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            onClick={() => setIsSolvedModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-xl rounded-3xl border border-stone-300 bg-[#fffdf7] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-stone-500">
                  Daily Result
                </p>
                {hasGivenUp ? (
                  <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                    Gave up after {triesUsed}{" "}
                    {triesUsed === 1 ? "attempt" : "attempts"}
                  </h2>
                ) : (
                  <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                    Solved in {triesUsed}{" "}
                    {triesUsed === 1 ? "attempts" : "attempt"}
                  </h2>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsSolvedModalOpen(false)}
                className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium hover:bg-stone-100"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-xl border border-stone-300 bg-white px-3 py-2">
                <p className="text-xs text-stone-500">Total Solves</p>
                <p className="mt-1 text-lg font-semibold">
                  {stats?.totalSolves ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-stone-300 bg-white px-3 py-2">
                <p className="text-xs text-stone-500">Average</p>
                <p className="mt-1 text-lg font-semibold">
                  {stats?.average ?? "-"}
                </p>
              </div>
              <div className="rounded-xl border border-stone-300 bg-white px-3 py-2">
                <p className="text-xs text-stone-500">Median</p>
                <p className="mt-1 text-lg font-semibold">
                  {stats?.median ?? "-"}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-stone-300 bg-white p-4">
              <p className="text-sm font-semibold">Distribution</p>
              {isLoadingStats ? (
                <p className="mt-2 text-sm text-stone-500">Loading chart...</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {distribution.map((bucket) => (
                    <li
                      key={bucket.tries}
                      className="grid grid-cols-[32px_1fr_40px] items-center gap-2 text-sm"
                    >
                      <span className="font-mono text-stone-500">
                        {bucket.tries}
                      </span>
                      <div className="h-5 overflow-hidden rounded-full bg-stone-200">
                        <div
                          className="h-full rounded-full bg-stone-800 transition-[width] duration-300"
                          style={{
                            width: `${(bucket.count / maxDistributionCount) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-right font-mono text-stone-600">
                        {bucket.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {status === "authenticated" ? (
                <button
                  type="button"
                  onClick={shareSolvedResult}
                  disabled={isGeneratingShare}
                  className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isGeneratingShare ? "Sharing..." : "Share"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={signInToShare}
                  className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700"
                >
                  Sign in to Share
                </button>
              )}
              {shareUrl ? (
                <p className="min-w-0 flex-1 break-all font-mono text-xs text-stone-600">
                  {shareUrl}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function getDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildShareUrl(shareId: string) {
  const url = new URL("/", window.location.origin);
  url.searchParams.set("share", shareId);
  return url.toString();
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fallback to legacy copy path below.
    }
  }

  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

function getAttemptStorageKey(dateKey: string) {
  return `freqle:attempt:${dateKey}`;
}

function readAttemptFromStorage(dateKey: string): GuessResult[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(getAttemptStorageKey(dateKey));
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (entry): entry is { guess: string; score: number; correct: boolean } =>
        typeof entry === "object" &&
        entry !== null &&
        "guess" in entry &&
        typeof entry.guess === "string" &&
        "score" in entry &&
        typeof entry.score === "number" &&
        "correct" in entry &&
        typeof entry.correct === "boolean",
    );
  } catch {
    return [];
  }
}

function writeAttemptToStorage(dateKey: string, results: GuessResult[]) {
  if (typeof window === "undefined") {
    return;
  }

  if (results.length === 0) {
    window.localStorage.removeItem(getAttemptStorageKey(dateKey));
    return;
  }

  window.localStorage.setItem(
    getAttemptStorageKey(dateKey),
    JSON.stringify(results),
  );
}

function clearAttemptFromStorage(dateKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getAttemptStorageKey(dateKey));
}

function clearFreqleLocalState() {
  if (typeof window === "undefined") {
    return;
  }

  const keysToDelete: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && key.startsWith("freqle:")) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    window.localStorage.removeItem(key);
  }

  const sessionKeysToDelete: string[] = [];
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (key && key.startsWith("freqle:")) {
      sessionKeysToDelete.push(key);
    }
  }

  for (const key of sessionKeysToDelete) {
    window.sessionStorage.removeItem(key);
  }
}

function isAbortError(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === "object" &&
    "name" in value &&
    value.name === "AbortError",
  );
}
