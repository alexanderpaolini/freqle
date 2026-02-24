"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AdminPuzzleCalendarProps = {
  month: Date;
  puzzleDateKeys: Set<string>;
  onMonthChange: (nextMonth: Date) => void;
  onSelectDate: (dateKey: string) => void;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AdminPuzzleCalendar({
  month,
  puzzleDateKeys,
  onMonthChange,
  onSelectDate,
}: AdminPuzzleCalendarProps) {
  const todayDateKey = createDateKeyFromDate(new Date());
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();

  const cells: Array<{ day: number; dateKey: string } | null> = [
    ...new Array(firstWeekday).fill(null),
    ...Array.from({ length: dayCount }, (_, index) => {
      const day = index + 1;
      return {
        day,
        dateKey: createDateKey(year, monthIndex, day),
      };
    }),
  ];

  return (
    <div className="rounded-xl border border-amber-300 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Previous month"
          onClick={() => {
            onMonthChange(new Date(year, monthIndex - 1, 1));
          }}
        >
          <ChevronLeft className="h-4 w-4 text-stone-700" />
        </Button>

        <p className="text-sm font-semibold text-stone-900">
          {month.toLocaleString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </p>

        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Next month"
          onClick={() => {
            onMonthChange(new Date(year, monthIndex + 1, 1));
          }}
        >
          <ChevronRight className="h-4 w-4 text-stone-700" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-stone-500">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((cell, index) => {
          if (!cell) {
            return <div key={`empty-${index}`} className="h-9" />;
          }

          const hasPuzzle = puzzleDateKeys.has(cell.dateKey);
          const isToday = cell.dateKey === todayDateKey;

          return (
            <Button
              key={cell.dateKey}
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-9 px-0",
                hasPuzzle && "border-amber-500 bg-amber-100 text-amber-900 hover:bg-amber-200",
                isToday && "border-stone-900 ring-2 ring-stone-900/35",
              )}
              onClick={() => {
                onSelectDate(cell.dateKey);
              }}
            >
              {cell.day}
            </Button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-stone-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm border border-stone-900 bg-white" />
          Today
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm border border-amber-500 bg-amber-100" />
          Has puzzle
        </span>
      </div>
    </div>
  );
}

function createDateKey(year: number, monthIndex: number, day: number): string {
  const month = String(monthIndex + 1).padStart(2, "0");
  const dayOfMonth = String(day).padStart(2, "0");
  return `${year}-${month}-${dayOfMonth}`;
}

function createDateKeyFromDate(date: Date): string {
  return createDateKey(date.getFullYear(), date.getMonth(), date.getDate());
}
