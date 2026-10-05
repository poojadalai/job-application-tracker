import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Status } from "@/lib/applications";
import { getStats } from "@/lib/data";
import { formatPercent } from "@/lib/stats";
import SiteHeader from "../site-header";

export const metadata: Metadata = {
  title: "Stats · Job Application Tracker",
};

const BAR_COLORS: Record<Status, string> = {
  Applied: "bg-blue-500",
  Screening: "bg-violet-500",
  Interview: "bg-amber-500",
  Offer: "bg-green-500",
  Rejected: "bg-red-500",
};

export default async function StatsPage() {
  const session = await auth();
  const user = session?.user;
  // The sign-in screen lives on the home page.
  if (!user?.id) redirect("/");

  const stats = await getStats();
  const summary = [
    {
      label: "This week",
      value: String(stats.thisWeek),
      hint: "Applied since Monday (UTC)",
    },
    {
      label: "Response rate",
      value: formatPercent(stats.responseRate),
      hint:
        stats.total === 0
          ? "No applications yet"
          : `${stats.responses} of ${stats.total} moved past Applied, rejections included`,
    },
    {
      label: "Total applications",
      value: String(stats.total),
      hint: "All time",
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 font-sans">
      <SiteHeader user={user} current="/stats" />

      <ul aria-label="Summary" className="grid gap-3 sm:grid-cols-3">
        {summary.map(({ label, value, hint }) => (
          <li
            key={label}
            className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {label}
            </span>
            <span className="text-3xl font-semibold">{value}</span>
            <span className="text-xs text-zinc-500">{hint}</span>
          </li>
        ))}
      </ul>

      <section aria-labelledby="by-stage" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="by-stage" className="text-lg font-semibold">
            Applications by current stage
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Where each application is now. An application rejected after an
            interview counts only as Rejected.
          </p>
        </div>
        {stats.total === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No applications yet.{" "}
            <Link href="/" className="text-blue-600 underline dark:text-blue-400">
              Add your first one on the board
            </Link>
            .
          </p>
        ) : (
          <ul aria-labelledby="by-stage" className="flex flex-col gap-3">
            {stats.byStage.map(({ status, count, share }) => (
              <li
                key={status}
                className="grid grid-cols-[6rem_1fr_auto] items-center gap-3 text-sm"
              >
                <span className="font-medium">{status}</span>
                {/* The text next to the bar carries the numbers, so the bar
                    itself is hidden from screen readers. */}
                <div
                  aria-hidden="true"
                  className="h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
                >
                  <div
                    className={`h-full rounded-full ${BAR_COLORS[status]}`}
                    style={{ width: `${share * 100}%` }}
                  />
                </div>
                <span className="tabular-nums text-zinc-700 dark:text-zinc-300">
                  {count} ({formatPercent(share)})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
