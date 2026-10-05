import { STATUSES, type Status } from "@/lib/applications";

export type StageCount = { status: Status; count: number; share: number };

export type Stats = {
  total: number;
  thisWeek: number;
  responses: number;
  // null when there are no applications, so the UI never shows NaN or a
  // misleading 0%.
  responseRate: number | null;
  byStage: StageCount[];
};

// Monday 00:00 UTC up to (not including) the next Monday. appliedDate is a
// date-only column and the server doesn't know the user's timezone, so the
// week is defined on UTC calendar dates.
export function weekRange(now: Date): { start: Date; end: Date } {
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  const start = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysSinceMonday,
    ),
  );
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { start, end };
}

// A "response" is any application that has moved past Applied, including
// rejections: the company still replied.
export function computeStats(
  counts: Partial<Record<Status, number>>,
  thisWeek: number,
): Stats {
  const total = STATUSES.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
  const responses = total - (counts.Applied ?? 0);
  return {
    total,
    thisWeek,
    responses,
    responseRate: total === 0 ? null : responses / total,
    byStage: STATUSES.map((status) => {
      const count = counts[status] ?? 0;
      return { status, count, share: total === 0 ? 0 : count / total };
    }),
  };
}

export function formatPercent(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}
