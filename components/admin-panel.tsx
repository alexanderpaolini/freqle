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

export function AdminPanel() {
  const [puzzles, setPuzzles] = useState<AdminPuzzle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingKey, setIsDeletingKey] = useState<string | null>(null);
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

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-stone-900">Puzzle Calendar</p>
            <p className="text-xs text-stone-600">
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

        <AdminPuzzleCalendar
          month={viewMonth}
          puzzleDateKeys={puzzleDateKeys}
          onMonthChange={setViewMonth}
          onSelectDate={(dateKey) => {
            setSelectedDateKey(dateKey);
            setIsEditorOpen(true);
          }}
        />

        <p className="mt-3 text-xs text-stone-600">
          {puzzleCountInViewMonth} puzzle{puzzleCountInViewMonth === 1 ? "" : "s"} in this
          month.
        </p>
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
