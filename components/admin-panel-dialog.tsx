"use client";

import { Shield } from "lucide-react";
import { AdminPanel } from "@/components/admin-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AdminPanelDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Open admin panel"
        >
          <Shield className="h-4 w-4 text-stone-700" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Admin Panel</DialogTitle>
          <DialogDescription>
            Create, edit, and delete daily puzzles.
          </DialogDescription>
        </DialogHeader>
        <AdminPanel />
      </DialogContent>
    </Dialog>
  );
}

