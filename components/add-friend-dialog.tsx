"use client";

import type { FormEvent } from "react";
import { useState } from "react";
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

type AddFriendDialogProps = {
  disabled?: boolean;
};

export function AddFriendDialog({ disabled = false }: AddFriendDialogProps) {
  const [open, setOpen] = useState(false);
  const [friendId, setFriendId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        Add Friend
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
