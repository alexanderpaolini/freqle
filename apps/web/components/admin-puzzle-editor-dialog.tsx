"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type AdminPuzzle = {
  key: string;
  dateKey: string;
  subject: string;
  answer: string;
  data: Record<number, number>;
};

type PuzzleEditorValues = {
  targetKey?: string;
  key: string;
  dateKey: string;
  subject: string;
  answer: string;
  dataText: string;
};

type AdminPuzzleEditorDialogProps = {
  open: boolean;
  dateKey: string | null;
  puzzle: AdminPuzzle | null;
  isSaving: boolean;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: PuzzleEditorValues) => void;
  onDelete: (key: string) => void;
};

export function AdminPuzzleEditorDialog({
  open,
  dateKey,
  puzzle,
  isSaving,
  isDeleting,
  onOpenChange,
  onSave,
  onDelete,
}: AdminPuzzleEditorDialogProps) {
  if (!dateKey) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {puzzle ? "Edit puzzle" : "Create puzzle"} for {dateKey}
          </DialogTitle>
          <DialogDescription>
            {puzzle
              ? "Update this day’s puzzle, or delete it."
              : "No puzzle exists for this day yet. Create one now."}
          </DialogDescription>
        </DialogHeader>

        <PuzzleEditorFields
          key={`${dateKey}-${puzzle?.key ?? "new"}-${open ? "open" : "closed"}`}
          dateKey={dateKey}
          puzzle={puzzle}
          isSaving={isSaving}
          isDeleting={isDeleting}
          onSave={onSave}
          onDelete={onDelete}
        />
      </DialogContent>
    </Dialog>
  );
}

type PuzzleEditorFieldsProps = {
  dateKey: string;
  puzzle: AdminPuzzle | null;
  isSaving: boolean;
  isDeleting: boolean;
  onSave: (values: PuzzleEditorValues) => void;
  onDelete: (key: string) => void;
};

function PuzzleEditorFields({
  dateKey,
  puzzle,
  isSaving,
  isDeleting,
  onSave,
  onDelete,
}: PuzzleEditorFieldsProps) {
  const [key, setKey] = useState(() => puzzle?.key ?? `puzzle-${dateKey}`);
  const [subject, setSubject] = useState(
    () => puzzle?.subject ?? "example-subject",
  );
  const [answer, setAnswer] = useState(() => puzzle?.answer ?? "");
  const [dataText, setDataText] = useState(() =>
    puzzle ? JSON.stringify(puzzle.data, null, 2) : '{\n  "1": 0\n}',
  );

  const isEditing = Boolean(puzzle);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="admin-dialog-key">Key</Label>
        <Input
          id="admin-dialog-key"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          disabled={isSaving || isDeleting}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="admin-dialog-answer">Answer</Label>
        <Input
          id="admin-dialog-answer"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          disabled={isSaving || isDeleting}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="admin-dialog-subject">Subject</Label>
        <Input
          id="admin-dialog-subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          disabled={isSaving || isDeleting}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="admin-dialog-data">Data (JSON)</Label>
        <Textarea
          id="admin-dialog-data"
          rows={8}
          value={dataText}
          onChange={(event) => setDataText(event.target.value)}
          disabled={isSaving || isDeleting}
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {isEditing && puzzle ? (
          <Button
            type="button"
            variant="destructive"
            disabled={isDeleting || isSaving}
            onClick={() => {
              onDelete(puzzle.key);
            }}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={isSaving || isDeleting}
          onClick={() => {
            onSave({
              targetKey: puzzle?.key,
              key,
              dateKey,
              subject,
              answer,
              dataText,
            });
          }}
        >
          {isSaving
            ? isEditing
              ? "Saving..."
              : "Creating..."
            : isEditing
              ? "Save"
              : "Create"}
        </Button>
      </div>
    </div>
  );
}
