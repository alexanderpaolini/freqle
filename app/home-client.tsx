"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { toast } from "sonner";
import { AttemptsSection } from "./components/home/attempts-section";
import { GamePanel } from "./components/home/game-panel";
import { HowToDialog } from "./components/home/how-to-dialog";
import { ResultsModal } from "./components/home/results-modal";
import { SuggestDialog } from "./components/home/suggest-dialog";
import type {
  DistributionBucket,
  GuessResult,
  PuzzlePreviewEntry,
  PuzzleStats,
} from "./components/home/types";

const DEFAULT_DISTRIBUTION_BUCKETS = 6;
const PENDING_SHARE_STORAGE_KEY = "freqle:pending-share-id";
const OPEN_RESULTS_AFTER_AUTH_STORAGE_KEY = "freqle:open-results-after-auth";
const ANONYMOUS_ID_STORAGE_KEY = "freqle:anonymous-id";
const SHARE_REQUEST_TIMEOUT_MS = 12000;

type HomeClientProps = {
  sharedLinkId: string | null;
  puzzlePreviewEntries: PuzzlePreviewEntry[];
};

export function HomeClient({
  sharedLinkId,
  puzzlePreviewEntries,
}: HomeClientProps) {
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
  const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null);
  const autoShareRequestedRef = useRef(false);
  const shareRequestRef = useRef<Promise<string | null> | null>(null);

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
        if (isAbortError(caught)) {
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

    autoShareRequestedRef.current = false;
    shareRequestRef.current = null;
    setIsSolvedModalOpen(false);
    setGeneratedShareId(null);
    setIsGeneratingShare(false);
  }, [isPuzzleComplete]);

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
    setIsSolvedModalOpen(true);
  }, [isPuzzleComplete, status]);

  useEffect(() => {
    if (status !== "authenticated") {
      setAccountName(null);
      setSettingsName("");
      setIsSettingsOpen(false);
      setIsLoadingAccount(false);
      setHasGivenUp(false);
      setRevealedAnswer(null);
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
  }, [session?.user?.name, status]);

  useEffect(() => {
    if (status !== "authenticated") {
      setIsLoadingAttempts(false);
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
        toast.success("Friend link saved.");
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
      const anonymousId =
        status === "authenticated" ? null : getOrCreateAnonymousId();
      if (status !== "authenticated" && !anonymousId) {
        toast.error("Could not initialize anonymous session.");
        return;
      }

      const response = await fetch("/api/guess", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          guess: guess.trim(),
          dateKey,
          anonymousId,
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
        revealedAnswer?: string | null;
      };
      if (!response.ok) {
        toast.error(payload.error ?? "Could not give up right now.");
        return;
      }

      setHasGivenUp(payload.gaveUp === true);
      setRevealedAnswer(
        typeof payload.revealedAnswer === "string"
          ? payload.revealedAnswer
          : null,
      );
      setIsSolvedModalOpen(false);
      setGeneratedShareId(null);
    } catch {
      toast.error("Could not give up right now.");
    } finally {
      setIsGivingUp(false);
    }
  }

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
      setRevealedAnswer(null);
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
    setRevealedAnswer(null);
    setIsGivingUp(false);
    setGeneratedShareId(null);
    setIsSolvedModalOpen(false);
    await signOut({ callbackUrl: "/" });
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fef6e7,#f8efe2_45%,#efe5d6)] px-4 py-8 text-stone-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <GamePanel
          status={status}
          shownUsername={shownUsername}
          isSettingsOpen={isSettingsOpen}
          settingsName={settingsName}
          isLoadingAccount={isLoadingAccount}
          isSavingSettings={isSavingSettings}
          isDeletingAccount={isDeletingAccount}
          previewEntries={puzzlePreviewEntries}
          guess={guess}
          triesUsed={triesUsed}
          isLoadingAttempts={isLoadingAttempts}
          isSubmitting={isSubmitting}
          isGivingUp={isGivingUp}
          isSolved={isSolved}
          hasGivenUp={hasGivenUp}
          revealedAnswer={revealedAnswer}
          onSignIn={() => {
            void signIn("discord");
          }}
          onSignOut={() => {
            void signOutAndClearLocalData();
          }}
          onSettingsOpenChange={setIsSettingsOpen}
          onSettingsNameChange={setSettingsName}
          onSaveSettings={saveSettings}
          onDeleteAccount={deleteAccount}
          onGuessChange={setGuess}
          onSubmitGuess={onSubmit}
          onGiveUp={giveUp}
          onOpenResults={() => setIsSolvedModalOpen(true)}
        />

        <AttemptsSection
          status={status}
          isLoadingAttempts={isLoadingAttempts}
          attempts={attemptsForDisplay}
        />

        <footer className="flex items-center justify-center gap-1 border-t border-stone-300/60 pt-3">
          <HowToDialog
            triggerLabel="how to play"
            triggerVariant="ghost"
            triggerClassName="h-8 px-2 font-mono text-xs uppercase tracking-[0.12em] text-stone-600"
          />
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-stone-400">
            |
          </span>
          <SuggestDialog
            triggerLabel="suggest a puzzle"
            triggerVariant="ghost"
            triggerClassName="h-8 px-2 font-mono text-xs uppercase tracking-[0.12em] text-stone-600"
          />
        </footer>
      </div>

      <ResultsModal
        isOpen={isSolvedModalOpen}
        hasGivenUp={hasGivenUp}
        triesUsed={triesUsed}
        stats={stats}
        isLoadingStats={isLoadingStats}
        distribution={distribution}
        maxDistributionCount={maxDistributionCount}
        status={status}
        isGeneratingShare={isGeneratingShare}
        shareUrl={shareUrl}
        onClose={() => setIsSolvedModalOpen(false)}
        onShare={() => {
          void shareSolvedResult();
        }}
        onSignInToShare={signInToShare}
      />
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
      // Fallback paths below.
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

function readAnonymousIdFromStorage(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(ANONYMOUS_ID_STORAGE_KEY);
  if (!value) {
    return null;
  }

  return value.trim() || null;
}

function getOrCreateAnonymousId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const existing = readAnonymousIdFromStorage();
  if (existing) {
    return existing;
  }

  const nextId = createAnonymousId();
  window.localStorage.setItem(ANONYMOUS_ID_STORAGE_KEY, nextId);
  return nextId;
}

function clearAnonymousIdFromStorage() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ANONYMOUS_ID_STORAGE_KEY);
}

function createAnonymousId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
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
