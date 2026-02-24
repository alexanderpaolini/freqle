"use client";

import { useMemo, useEffect, useState } from "react";
import type { DistributionBucket, PuzzleStats } from "../types";
import {
  DEFAULT_DISTRIBUTION_BUCKETS,
  isAbortError,
  REQUEST_TIMEOUT_MS,
} from "../home-client-utils";

type UsePuzzleStatsOptions = {
  dateKey: string;
  refreshToken: unknown;
};

export function usePuzzleStats({ dateKey, refreshToken }: UsePuzzleStatsOptions) {
  const [stats, setStats] = useState<PuzzleStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutHandle = window.setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    const loadStats = async () => {
      setIsLoadingStats(true);

      try {
        const response = await fetch(
          `/api/stats?dateKey=${encodeURIComponent(dateKey)}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const payload = (await response.json()) as {
          totalSolves?: number;
          average?: number | null;
          median?: number | null;
          distribution?: DistributionBucket[];
        };

        if (!response.ok) {
          return;
        }

        setStats({
          totalSolves:
            typeof payload.totalSolves === "number" ? payload.totalSolves : 0,
          average: typeof payload.average === "number" ? payload.average : null,
          median: typeof payload.median === "number" ? payload.median : null,
          distribution: Array.isArray(payload.distribution)
            ? payload.distribution
            : [],
        });
      } catch (caught) {
        if (isAbortError(caught)) {
          return;
        }
      } finally {
        window.clearTimeout(timeoutHandle);
        setIsLoadingStats(false);
      }
    };

    void loadStats();

    return () => {
      controller.abort();
      window.clearTimeout(timeoutHandle);
    };
  }, [dateKey, refreshToken]);

  const distribution = useMemo(
    () =>
      stats && stats.distribution.length > 0
        ? stats.distribution
        : new Array(DEFAULT_DISTRIBUTION_BUCKETS)
            .fill(0)
            .map((_, index) => ({ tries: index + 1, count: 0 })),
    [stats],
  );

  const maxDistributionCount = useMemo(
    () => Math.max(1, ...distribution.map((entry) => entry.count)),
    [distribution],
  );

  return {
    stats,
    isLoadingStats,
    distribution,
    maxDistributionCount,
  };
}
