"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
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
import { copyTextToClipboard } from "./home-client-utils";

type AddFriendDialogProps = {
  currentFriendId: string | null;
  disabled?: boolean;
};

export function AddFriendDialog({
  currentFriendId,
  disabled = false,
}: AddFriendDialogProps) {
  const [open, setOpen] = useState(false);
  const [friendId, setFriendId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function copyFriendId() {
    if (!currentFriendId) {
      return;
    }

    const copied = await copyTextToClipboard(currentFriendId);
    if (copied) {
      toast.success("Friend ID copied.");
      return;
    }

    toast.error("Could not copy friend ID.");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const trimmedFriendId = friendId.trim().toLowerCase();
    if (!trimmedFriendId) {
      toast.error("Enter a friend ID first.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/friends/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          friendId: trimmedFriendId,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        linked?: boolean;
      };

      if (!response.ok) {
        toast.error(payload.error ?? "Could not add friend.");
        return;
      }

      if (payload.linked === false) {
        toast.message("Already linked.");
      } else {
        toast.success("Friend added.");
      }

      setFriendId("");
      setOpen(false);
    } catch {
      toast.error("Could not add friend.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Add friend"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <UserPlus className="h-4 w-4 text-stone-700" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add friend</DialogTitle>
            <DialogDescription>
              Paste your friend&apos;s ID to connect profiles.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-3" onSubmit={onSubmit}>
            <Label htmlFor="friend-id">Friend ID</Label>
            <Input
              id="friend-id"
              value={friendId}
              onChange={(event) => setFriendId(event.target.value)}
              placeholder="abcd123xy"
              maxLength={32}
              disabled={isSubmitting}
              autoComplete="off"
              autoCapitalize="none"
            />
            <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-600">
                Your friend ID
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  value={currentFriendId ?? ""}
                  readOnly
                  placeholder="Unavailable"
                  className="font-mono text-xs"
                  disabled={!currentFriendId}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!currentFriendId}
                  onClick={() => {
                    void copyFriendId();
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
