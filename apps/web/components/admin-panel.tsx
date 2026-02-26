"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminPuzzleCalendar } from "@/components/admin-puzzle-calendar";
import { AdminPuzzleEditorDialog } from "@/components/admin-puzzle-editor-dialog";
import { Button } from "@/components/ui/button";

type AdminPuzzle = {
  key: string;
  dateKey: string;
  subject: string;
  answer: string;
  data: Record<number, number>;
};

type SavePuzzleValues = {
  targetKey?: string;
  key: string;
  dateKey: string;
  subject: string;
  answer: string;
  dataText: string;
};

type AdminSuggestion = {
  id: string;
  dateKey: string;
  puzzleId: string | null;
  text: string;
  createdAt: string;
  playerName: string | null;
  playerExternalId: string | null;
};

export function AdminPanel() {
  const [puzzles, setPuzzles] = useState<AdminPuzzle[]>([]);
  const [suggestions, setSuggestions] = useState<AdminSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingKey, setIsDeletingKey] = useState<string | null>(null);
  const [isDeletingSuggestionId, setIsDeletingSuggestionId] = useState<string | null>(
    null,
  );
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState<string>(getTodayDateKey());
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const puzzleDateKeys = useMemo(
    () => new Set(puzzles.map((puzzle) => puzzle.dateKey)),
    [puzzles],
  );

  const puzzleByDateKey = useMemo(
    () =>
      new Map(
        puzzles.map((puzzle) => [puzzle.dateKey, puzzle] as const),
      ),
    [puzzles],
  );

  const selectedPuzzle = puzzleByDateKey.get(selectedDateKey) ?? null;

  const puzzleCountInViewMonth = useMemo(() => {
    const prefix = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, "0")}-`;
    return puzzles.filter((puzzle) => puzzle.dateKey.startsWith(prefix)).length;
  }, [puzzles, viewMonth]);

  useEffect(() => {
    void loadPuzzles();
    void loadSuggestions();
  }, []);

  async function loadPuzzles() {
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/puzzles", {
        method: "GET",
        cache: "no-store",
      });

      const payload = (await response.json()) as {
        error?: string;
        puzzles?: AdminPuzzle[];
      };

      if (!response.ok) {
        toast.error(payload.error ?? "Could not load puzzles.");
        return;
      }

      setPuzzles(Array.isArray(payload.puzzles) ? payload.puzzles : []);
    } catch {
      toast.error("Could not load puzzles.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSuggestions() {
    setIsLoadingSuggestions(true);

    try {
      const response = await fetch("/api/admin/suggestions", {
        method: "GET",
        cache: "no-store",
      });

      const payload = (await response.json()) as {
        error?: string;
        suggestions?: AdminSuggestion[];
      };

      if (!response.ok) {
        toast.error(payload.error ?? "Could not load suggestions.");
        return;
      }

      setSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []);
    } catch {
      toast.error("Could not load suggestions.");
    } finally {
      setIsLoadingSuggestions(false);
    }
  }

  async function savePuzzle(values: SavePuzzleValues) {
    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const data = parseDataText(values.dataText);
      const isUpdate = Boolean(values.targetKey);
      const response = await fetch("/api/admin/puzzles", {
        method: isUpdate ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(isUpdate ? { targetKey: values.targetKey } : {}),
          key: values.key,
          dateKey: values.dateKey,
          subject: values.subject,
          answer: values.answer,
          data,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        toast.error(payload.error ?? "Could not save puzzle.");
        return;
      }

      toast.success(isUpdate ? "Puzzle updated." : "Puzzle created.");
      await loadPuzzles();
      setIsEditorOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid puzzle data.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deletePuzzle(key: string) {
    if (isDeletingKey) {
      return;
    }

    const confirmed = window.confirm(`Delete puzzle "${key}"?`);
    if (!confirmed) {
      return;
    }

    setIsDeletingKey(key);

    try {
      const response = await fetch("/api/admin/puzzles", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key }),
      });

      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        toast.error(payload.error ?? "Could not delete puzzle.");
        return;
      }

      toast.success("Puzzle deleted.");
      await loadPuzzles();
      setIsEditorOpen(false);
    } catch {
      toast.error("Could not delete puzzle.");
    } finally {
      setIsDeletingKey(null);
    }
  }

  async function deleteSuggestion(id: string) {
    if (isDeletingSuggestionId) {
      return;
    }

    const confirmed = window.confirm("Delete this suggestion?");
    if (!confirmed) {
      return;
    }

    setIsDeletingSuggestionId(id);

    try {
      const response = await fetch("/api/admin/suggestions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        toast.error(payload.error ?? "Could not delete suggestion.");
        return;
      }

      setSuggestions((previous) =>
        previous.filter((suggestion) => suggestion.id !== id),
      );
      toast.success("Suggestion deleted.");
    } catch {
      toast.error("Could not delete suggestion.");
    } finally {
      setIsDeletingSuggestionId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
        <div className="flex h-full flex-col rounded-xl border border-warning-border bg-warning-muted/60 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Puzzle Calendar</p>
              <p className="text-xs text-muted-foreground">
                Select any day to open that puzzle in an edit/delete dialog.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void loadPuzzles();
              }}
              disabled={isLoading}
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          <div className="flex-1">
            <AdminPuzzleCalendar
              month={viewMonth}
              puzzleDateKeys={puzzleDateKeys}
              onMonthChange={setViewMonth}
              onSelectDate={(dateKey) => {
                setSelectedDateKey(dateKey);
                setIsEditorOpen(true);
              }}
            />
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {puzzleCountInViewMonth} puzzle{puzzleCountInViewMonth === 1 ? "" : "s"} in this
            month.
          </p>
        </div>

        <div className="flex h-full flex-col rounded-xl border border-warning-border bg-warning-muted/60 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Puzzle Suggestions</p>
              <p className="text-xs text-muted-foreground">
                Review player suggestions and delete low-quality entries.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void loadSuggestions();
              }}
              disabled={isLoadingSuggestions}
            >
              {isLoadingSuggestions ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoadingSuggestions && suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading suggestions...</p>
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No suggestions yet.</p>
            ) : (
              <ul className="space-y-3">
                {suggestions.map((suggestion) => (
                  <li
                    key={suggestion.id}
                    className="rounded-md border border-border bg-background/70 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        {suggestion.dateKey}{" "}
                        {suggestion.puzzleId
                          ? `(linked: ${suggestion.puzzleId})`
                          : "(unlinked)"}
                      </p>
                      <Button
                        type="button"
                        variant="destructive"
                        size="xs"
                        onClick={() => {
                          void deleteSuggestion(suggestion.id);
                        }}
                        disabled={isDeletingSuggestionId === suggestion.id}
                      >
                        {isDeletingSuggestionId === suggestion.id
                          ? "Deleting..."
                          : "Delete"}
                      </Button>
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                      {suggestion.text}
                    </p>

                    <p className="mt-2 text-xs text-muted-foreground">
                      by {suggestion.playerName ?? suggestion.playerExternalId ?? "anonymous"} on{" "}
                      {formatTimestamp(suggestion.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <AdminPuzzleEditorDialog
        open={isEditorOpen}
        dateKey={selectedDateKey}
        puzzle={selectedPuzzle}
        isSaving={isSaving}
        isDeleting={Boolean(selectedPuzzle && isDeletingKey === selectedPuzzle.key)}
        onOpenChange={setIsEditorOpen}
        onSave={(values) => {
          void savePuzzle(values);
        }}
        onDelete={(key) => {
          void deletePuzzle(key);
        }}
      />
    </div>
  );
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function parseDataText(value: string): Record<number, number> {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Data must be a JSON object.");
  }

  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length === 0) {
    throw new Error("Data must include at least one entry.");
  }

  const normalized: Record<number, number> = {};
  for (const [rawKey, rawValue] of entries) {
    const key = Number(rawKey);
    const count = Number(rawValue);

    if (!Number.isFinite(key) || !Number.isInteger(key)) {
      throw new Error("Data keys must be integers.");
    }

    if (!Number.isFinite(count) || !Number.isInteger(count) || count < 0) {
      throw new Error("Data values must be non-negative integers.");
    }

    normalized[key] = count;
  }

  return normalized;
}
