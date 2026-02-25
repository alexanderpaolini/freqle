"use client";

import { FormEvent, type ComponentProps, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const MAX_SUGGESTION_LENGTH = 600;

type SuggestDialogProps = {
  triggerLabel?: string;
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  triggerClassName?: string;
};

export function SuggestDialog({
  triggerLabel = "Suggest",
  triggerVariant = "outline",
  triggerClassName,
}: SuggestDialogProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const remaining = useMemo(
    () => MAX_SUGGESTION_LENGTH - value.trim().length,
    [value],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      toast.error("Enter a suggestion first.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: trimmed,
          dateKey: getDateKey(),
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(payload.error ?? "Could not save suggestion.");
        return;
      }

      toast.success("Suggestion saved.");
      setValue("");
      setOpen(false);
    } catch {
      toast.error("Could not save suggestion.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Suggest a puzzle</DialogTitle>
            <DialogDescription>
              Suggest a future hashmap puzzle. Include the preview and what it
              represents.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-3" onSubmit={onSubmit}>
            <Textarea
              value={value}
              onChange={(event) => setValue(event.target.value)}
              maxLength={MAX_SUGGESTION_LENGTH}
              placeholder={"number of days in each month"}
              disabled={isSubmitting}
              className="min-h-32"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
                {remaining} chars left
              </p>
              <Button
                type="submit"
                disabled={isSubmitting || value.trim().length < 6}
              >
                {isSubmitting ? "Saving..." : "Save Suggestion"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function getDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
