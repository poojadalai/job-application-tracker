"use client";

import { useState } from "react";
import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_text,
  tableFeatures,
  useTable,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import {
  STATUSES,
  STATUS_STYLES,
  type Application,
  type Status,
} from "@/lib/applications";

// TanStack Table only sorts and slices the rows; the markup below is ours.
// Search and the status filter stay in Tracker, so this table always gets
// the already-filtered list.

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
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

export const PAGE_SIZES = [10, 20, 50] as const;
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
  // Changes when search or the status filter changes, which goes back to page 1.
  resetKey: string;
  onStatusChange: (id: string, status: Status) => void;
  onEdit: (app: Application) => void;
  onDelete: (app: Application) => void;
  deleteDisabled: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORT);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  // Reset during render rather than in an effect, so there's no extra paint
  // of the old page (https://react.dev/learn/you-might-not-need-an-effect).
  const [previousResetKey, setPreviousResetKey] = useState(resetKey);
  if (resetKey !== previousResetKey) {
    setPreviousResetKey(resetKey);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }

  // After a delete the last page can disappear; move to the new last page.
  const pageCount = Math.max(1, Math.ceil(applications.length / pagination.pageSize));
  if (pagination.pageIndex > pageCount - 1) {
    setPagination((current) => ({ ...current, pageIndex: pageCount - 1 }));
  }
  const pageIndex = Math.min(pagination.pageIndex, pageCount - 1);

  const table = useTable({
    features,
    columns,
    data: applications,
    state: { sorting, pagination: { ...pagination, pageIndex } },
    onSortingChange: (updater) => {
      setSorting(updater);
      setPagination((current) => ({ ...current, pageIndex: 0 }));
    },
    onPaginationChange: setPagination,
    enableMultiSort: false,
    enableSortingRemoval: false,
    // Data changes on every status edit; don't jump back to page 1 for those.
    autoResetPageIndex: false,
  });

  const rows = table.getRowModel().rows;
  const first = pageIndex * pagination.pageSize + 1;
  const last = first + rows.length - 1;

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
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
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

      <nav
        aria-label="Pagination"
        className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600 dark:text-zinc-400"
      >
        <span>
          {first}–{last} of {applications.length} · Page {pageIndex + 1} of {pageCount}
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2">
            Rows per page
            <select
              value={pagination.pageSize}
              onChange={(e) => setPagination({ pageIndex: 0, pageSize: Number(e.target.value) })}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size}>{size}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-md border border-zinc-300 px-3 py-1 disabled:opacity-40 dark:border-zinc-700"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-md border border-zinc-300 px-3 py-1 disabled:opacity-40 dark:border-zinc-700"
          >
            Next
          </button>
        </div>
      </nav>
    </div>
  );
}
