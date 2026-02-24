import type { GuessResult } from "./types";

export const DEFAULT_DISTRIBUTION_BUCKETS = 6;
export const PENDING_SHARE_STORAGE_KEY = "freqle:pending-share-id";
export const OPEN_RESULTS_AFTER_AUTH_STORAGE_KEY =
  "freqle:open-results-after-auth";
export const ANONYMOUS_ID_STORAGE_KEY = "freqle:anonymous-id";
export const REQUEST_TIMEOUT_MS = 12000;

export function getDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildShareUrl(shareId: string) {
  const url = new URL("/", window.location.origin);
  url.searchParams.set("share", shareId);
  return url.toString();
}

export async function copyTextToClipboard(value: string): Promise<boolean> {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fallback path below.
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

export function readAnonymousIdFromStorage(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(ANONYMOUS_ID_STORAGE_KEY);
  if (!value) {
    return null;
  }

  return value.trim() || null;
}

export function getOrCreateAnonymousId(): string | null {
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

export function clearAnonymousIdFromStorage() {
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

export function readAttemptFromStorage(dateKey: string): GuessResult[] {
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

    return parsed
      .filter(
        (entry): entry is GuessResult =>
          typeof entry === "object" &&
          entry !== null &&
          "guess" in entry &&
          typeof entry.guess === "string" &&
          "score" in entry &&
          typeof entry.score === "number" &&
          "correct" in entry &&
          typeof entry.correct === "boolean" &&
          (!("reason" in entry) || typeof entry.reason === "string"),
      )
      .map((entry) => ({
        ...entry,
        reason: typeof entry.reason === "string" ? entry.reason : "",
      }));
  } catch {
    return [];
  }
}

export function writeAttemptToStorage(dateKey: string, results: GuessResult[]) {
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

export function clearAttemptFromStorage(dateKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getAttemptStorageKey(dateKey));
}

export function clearFreqleLocalState() {
  if (typeof window === "undefined") {
    return;
  }

  const localKeys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && key.startsWith("freqle:")) {
      localKeys.push(key);
    }
  }

  for (const key of localKeys) {
    window.localStorage.removeItem(key);
  }

  const sessionKeys: string[] = [];
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (key && key.startsWith("freqle:")) {
      sessionKeys.push(key);
    }
  }

  for (const key of sessionKeys) {
    window.sessionStorage.removeItem(key);
  }
}

export function isAbortError(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      "name" in value &&
      value.name === "AbortError",
  );
}
