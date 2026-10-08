"use client";

import { useState } from "react";
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_text,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";
import {
  STATUSES,
  STATUS_STYLES,
  type Application,
  type Status,
} from "@/lib/applications";
import { useScreenFit } from "@/lib/use-screen-fit";

// TanStack Table sorts the rows; the markup below is ours. Search and the
// status filter stay in Tracker, so this table always gets the already-
// filtered list. Like the board, it shows as many rows as fit on screen and
// a "Show more" button right below them.

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text },
});

const helper = createColumnHelper<typeof features, Application>();

// Module scope keeps the columns stable between renders, as TanStack requires.
const columns = helper.columns([
  helper.accessor("company", { header: "Company", sortFn: "text" }),
  helper.accessor("role", { header: "Role", sortFn: "text" }),
  // Pipeline order (Applied → Rejected), not alphabetical.
  helper.accessor((app) => STATUSES.indexOf(app.status), {
    id: "status",
    header: "Status",
    // Number columns sort descending on the first click by default; start
    // with Applied instead.
    sortDescFirst: false,
  }),
  helper.accessor((app) => app.appliedDate || undefined, {
    id: "appliedDate",
    header: "Date applied",
    sortFn: "text", // ISO dates sort correctly as text
    sortDescFirst: true,
    sortUndefined: "last",
  }),
]);

// Rows shown before the screen is measured (and in tests without layout).
export const TABLE_PAGE_SIZE = 20;
const DEFAULT_SORT: SortingState = [{ id: "appliedDate", desc: true }];

export default function ApplicationTable({
  applications,
  resetKey,
  onStatusChange,
  onEdit,
  onDelete,
  deleteDisabled,
}: {
  applications: Application[];
  // Changes when search or the status filter changes, which shows the first rows again.
  resetKey: string;
  onStatusChange: (id: string, status: Status) => void;
  onEdit: (app: Application) => void;
  onDelete: (app: Application) => void;
  deleteDisabled: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORT);
  const [bodyRef, pageSize] = useScreenFit<HTMLTableSectionElement>({
    fallback: TABLE_PAGE_SIZE,
    isEmpty: applications.length === 0,
  });
  const [pages, setPages] = useState(1);

  // Back to the first screenful when search or the filter changes. Done
  // during render rather than in an effect, so the old rows never paint
  // (https://react.dev/learn/you-might-not-need-an-effect).
  const [previousResetKey, setPreviousResetKey] = useState(resetKey);
  if (resetKey !== previousResetKey) {
    setPreviousResetKey(resetKey);
    setPages(1);
  }

  const table = useTable({
    features,
    columns,
    data: applications,
    state: { sorting },
    onSortingChange: (updater) => {
      setSorting(updater);
      setPages(1);
    },
    enableMultiSort: false,
    enableSortingRemoval: false,
  });

  // Status edits change the data but keep however many rows are shown.
  const sortedRows = table.getRowModel().rows;
  const rows = sortedRows.slice(0, pageSize * pages);
  const nextCount = Math.min(sortedRows.length - rows.length, pageSize);

  return (
    <div className="flex flex-col gap-3">
      {/* Scrolls sideways on narrow screens instead of breaking the layout. */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
            <tr>
              {table.getHeaderGroups()[0].headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={
                      sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"
                    }
                    className="px-3 py-2 font-medium"
                  >
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      <table.FlexRender header={header} />
                      <span aria-hidden="true" className="w-3">
                        {sorted === "asc" ? "▲" : sorted === "desc" ? "▼" : ""}
                      </span>
                    </button>
                  </th>
                );
              })}
              <th scope="col" className="px-3 py-2 font-medium">
                Next step
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody ref={bodyRef} className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map(({ original: app }) => (
              <tr key={app.id} className="align-top">
                <td className="px-3 py-2 font-medium wrap-anywhere">
                  {app.link ? (
                    <a
                      href={app.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-zinc-300 underline-offset-2 hover:decoration-current dark:decoration-zinc-600"
                    >
                      {app.company}
                    </a>
                  ) : (
                    app.company
                  )}
                </td>
                <td className="px-3 py-2 wrap-anywhere">{app.role}</td>
                <td className="px-3 py-2">
                  <select
                    aria-label="Status"
                    value={app.status}
                    onChange={(e) => onStatusChange(app.id, e.target.value as Status)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[app.status]}`}
                  >
                    {STATUSES.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                  {app.appliedDate || "—"}
                </td>
                <td className="max-w-56 px-3 py-2 text-zinc-700 wrap-anywhere dark:text-zinc-300">
                  {app.nextStep || "—"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(app)}
                      className="rounded-md border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={deleteDisabled}
                      onClick={() => onDelete(app)}
                      className="rounded-md border border-red-300 px-3 py-1 text-xs text-red-700 dark:border-red-900 dark:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600 dark:text-zinc-400">
        <span>
          Showing {rows.length} of {applications.length}
        </span>
        {nextCount > 0 && (
          <button
            type="button"
            onClick={() => setPages((current) => current + 1)}
            aria-label={`Show ${nextCount} more applications`}
            className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Show {nextCount} more
          </button>
        )}
      </div>
    </div>
  );
}
