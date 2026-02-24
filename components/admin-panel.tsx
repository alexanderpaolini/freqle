"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type AdminPuzzle = {
  key: string;
  dateKey: string;
  answer: string;
  data: Record<number, number>;
};

type PuzzleFormState = {
  key: string;
  dateKey: string;
  answer: string;
  dataText: string;
};

function getTodayDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createDefaultFormState(): PuzzleFormState {
  return {
    key: "",
    dateKey: getTodayDateKey(),
    answer: "",
    dataText: '{\n  "1": 0\n}',
  };
}

export function AdminPanel() {
  const [puzzles, setPuzzles] = useState<AdminPuzzle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<PuzzleFormState>(
    createDefaultFormState(),
  );
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PuzzleFormState | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingKey, setIsDeletingKey] = useState<string | null>(null);

  const sortedPuzzles = useMemo(
    () => [...puzzles].sort((left, right) => right.dateKey.localeCompare(left.dateKey)),
    [puzzles],
  );

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

  async function createPuzzle() {
    if (isCreating) {
      return;
    }

    setIsCreating(true);

    try {
      const data = parseDataText(createForm.dataText);
      const response = await fetch("/api/admin/puzzles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: createForm.key,
          dateKey: createForm.dateKey,
          answer: createForm.answer,
          data,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        puzzle?: AdminPuzzle;
      };

      if (!response.ok) {
        toast.error(payload.error ?? "Could not create puzzle.");
        return;
      }

      toast.success("Puzzle created.");
      setCreateForm(createDefaultFormState());
      if (payload.puzzle) {
        setPuzzles((previous) => [payload.puzzle as AdminPuzzle, ...previous]);
      } else {
        await loadPuzzles();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid puzzle data.");
    } finally {
      setIsCreating(false);
    }
  }

  async function saveEdit() {
    if (!editingKey || !editForm || isSavingEdit) {
      return;
    }

    setIsSavingEdit(true);

    try {
      const data = parseDataText(editForm.dataText);
      const response = await fetch("/api/admin/puzzles", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetKey: editingKey,
          key: editForm.key,
          dateKey: editForm.dateKey,
          answer: editForm.answer,
          data,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        puzzle?: AdminPuzzle;
      };

      if (!response.ok) {
        toast.error(payload.error ?? "Could not update puzzle.");
        return;
      }

      toast.success("Puzzle updated.");
      setEditingKey(null);
      setEditForm(null);
      if (payload.puzzle) {
        setPuzzles((previous) =>
          previous.map((entry) =>
            entry.key === editingKey ? (payload.puzzle as AdminPuzzle) : entry,
          ),
        );
      } else {
        await loadPuzzles();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid puzzle data.");
    } finally {
      setIsSavingEdit(false);
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
      setPuzzles((previous) => previous.filter((entry) => entry.key !== key));
      if (editingKey === key) {
        setEditingKey(null);
        setEditForm(null);
      }
    } catch {
      toast.error("Could not delete puzzle.");
    } finally {
      setIsDeletingKey(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-300 bg-white p-4">
        <p className="text-sm font-semibold text-stone-900">Create Puzzle</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="admin-create-key">Key</Label>
            <Input
              id="admin-create-key"
              value={createForm.key}
              onChange={(event) =>
                setCreateForm((previous) => ({
                  ...previous,
                  key: event.target.value,
                }))
              }
              placeholder="puzzle-2026-02-24"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="admin-create-date">Date</Label>
            <Input
              id="admin-create-date"
              type="date"
              value={createForm.dateKey}
              onChange={(event) =>
                setCreateForm((previous) => ({
                  ...previous,
                  dateKey: event.target.value,
                }))
              }
            />
          </div>
        </div>

        <div className="mt-3 space-y-1">
          <Label htmlFor="admin-create-answer">Answer</Label>
          <Input
            id="admin-create-answer"
            value={createForm.answer}
            onChange={(event) =>
              setCreateForm((previous) => ({
                ...previous,
                answer: event.target.value,
              }))
            }
            placeholder="United States monthly inflation rate"
          />
        </div>

        <div className="mt-3 space-y-1">
          <Label htmlFor="admin-create-data">Data (JSON)</Label>
          <Textarea
            id="admin-create-data"
            rows={6}
            value={createForm.dataText}
            onChange={(event) =>
              setCreateForm((previous) => ({
                ...previous,
                dataText: event.target.value,
              }))
            }
          />
        </div>

        <Button
          type="button"
          className="mt-3"
          onClick={() => {
            void createPuzzle();
          }}
          disabled={isCreating}
        >
          {isCreating ? "Creating..." : "Create puzzle"}
        </Button>
      </div>

      <div className="rounded-xl border border-amber-300 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-stone-900">Existing Puzzles</p>
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

        {isLoading && sortedPuzzles.length === 0 ? (
          <p className="text-sm text-stone-600">Loading puzzles...</p>
        ) : sortedPuzzles.length === 0 ? (
          <p className="text-sm text-stone-600">No puzzles yet.</p>
        ) : (
          <ul className="space-y-3">
            {sortedPuzzles.map((puzzle) => (
              <li key={puzzle.key} className="rounded-lg border border-stone-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-stone-500">{puzzle.key}</p>
                    <p className="text-sm font-medium text-stone-900">{puzzle.dateKey}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingKey(puzzle.key);
                        setEditForm({
                          key: puzzle.key,
                          dateKey: puzzle.dateKey,
                          answer: puzzle.answer,
                          dataText: JSON.stringify(puzzle.data, null, 2),
                        });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={isDeletingKey === puzzle.key}
                      onClick={() => {
                        void deletePuzzle(puzzle.key);
                      }}
                    >
                      {isDeletingKey === puzzle.key ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </div>

                <p className="mt-2 text-sm text-stone-700">{puzzle.answer}</p>
                <pre className="mt-2 overflow-x-auto rounded-md bg-stone-100 p-2 text-xs text-stone-700">
                  {JSON.stringify(puzzle.data, null, 2)}
                </pre>

                {editingKey === puzzle.key && editForm ? (
                  <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor={`admin-edit-key-${puzzle.key}`}>Key</Label>
                        <Input
                          id={`admin-edit-key-${puzzle.key}`}
                          value={editForm.key}
                          onChange={(event) =>
                            setEditForm((previous) =>
                              previous
                                ? { ...previous, key: event.target.value }
                                : previous,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`admin-edit-date-${puzzle.key}`}>Date</Label>
                        <Input
                          id={`admin-edit-date-${puzzle.key}`}
                          type="date"
                          value={editForm.dateKey}
                          onChange={(event) =>
                            setEditForm((previous) =>
                              previous
                                ? { ...previous, dateKey: event.target.value }
                                : previous,
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="mt-3 space-y-1">
                      <Label htmlFor={`admin-edit-answer-${puzzle.key}`}>Answer</Label>
                      <Input
                        id={`admin-edit-answer-${puzzle.key}`}
                        value={editForm.answer}
                        onChange={(event) =>
                          setEditForm((previous) =>
                            previous
                              ? { ...previous, answer: event.target.value }
                              : previous,
                          )
                        }
                      />
                    </div>

                    <div className="mt-3 space-y-1">
                      <Label htmlFor={`admin-edit-data-${puzzle.key}`}>Data (JSON)</Label>
                      <Textarea
                        id={`admin-edit-data-${puzzle.key}`}
                        rows={6}
                        value={editForm.dataText}
                        onChange={(event) =>
                          setEditForm((previous) =>
                            previous
                              ? { ...previous, dataText: event.target.value }
                              : previous,
                          )
                        }
                      />
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          void saveEdit();
                        }}
                        disabled={isSavingEdit}
                      >
                        {isSavingEdit ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingKey(null);
                          setEditForm(null);
                        }}
                        disabled={isSavingEdit}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
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
