"use client";

import { type ComponentProps, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type HowToDialogProps = {
  triggerLabel?: string;
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  triggerClassName?: string;
};

export function HowToDialog({
  triggerLabel = "How To",
  triggerVariant = "outline",
  triggerClassName,
}: HowToDialogProps) {
  const [open, setOpen] = useState(false);

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
            <DialogTitle>How to play</DialogTitle>
            <DialogDescription>
              You are shown a hashmap preview and must infer what data it
              represents.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm text-stone-700">
            <section className="rounded-md border border-stone-200 bg-stone-50 p-3">
              <pre className="mt-2 font-mono text-xs leading-6">
                {`28: 1
30: 4
31: 7`}
              </pre>
            </section>

            <section className="space-y-2">
              <p>
                This means there are 1 item with value 28, 4 items with value
                30, and 7 items with value 31.
              </p>
              <p>
                A valid guess would be:{" "}
                <span className="font-semibold text-stone-900">
                  Number of days in each month
                </span>
                .
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
