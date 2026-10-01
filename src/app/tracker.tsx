"use client";

import { useState, useTransition } from "react";
import {
  createApplication,
  deleteApplication,
  updateApplication,
  updateApplicationStatus,
} from "./actions";
import {
  STATUSES,
  type Application,
  type ApplicationInput,
  type Status,
} from "@/lib/applications";

const STATUS_STYLES: Record<Status, string> = {
  Wishlist: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  Applied: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  Interview:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  Offer: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  Rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

function emptyForm(): ApplicationInput {
  return {
    company: "",
    role: "",
    status: "Applied",
    appliedDate: new Date().toISOString().slice(0, 10),
    jobDescription: "",
    link: "",
    notes: "",
  };
}

export default function Tracker({
  applications,
}: {
  applications: Application[];
}) {
  const [form, setForm] = useState<ApplicationInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Status | "All">("All");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<void>, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        onSuccess?.();
      } catch {
        setError("Couldn't save your change. Please try again.");
      }
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = {
      ...form,
      company: form.company.trim(),
      role: form.role.trim(),
      link: form.link.trim(),
    };
    if (!values.company || !values.role) return;
    run(
      () =>
        editingId
          ? updateApplication(editingId, values)
          : createApplication(values),
      () => {
        setForm(emptyForm());
        setEditingId(null);
      },
    );
  }

  function startEdit(app: Application) {
    const { id, ...values } = app;
    setEditingId(id);
    setForm(values);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
  }

  function handleDelete(app: Application) {
    if (!confirm(`Delete ${app.role} at ${app.company}?`)) return;
    run(
      () => deleteApplication(app.id),
      () => {
        if (editingId === app.id) cancelEdit();
      },
    );
  }

  const query = search.trim().toLowerCase();
  const visible = applications.filter(
    (app) =>
      (filter === "All" || app.status === filter) &&
      (!query ||
        app.company.toLowerCase().includes(query) ||
        app.role.toLowerCase().includes(query)),
  );

  return (
    <div className="flex flex-col gap-8">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(filter === status ? "All" : status)}
            className={`rounded-lg border p-3 text-left transition-colors ${
              filter === status
                ? "border-foreground"
                : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
            }`}
          >
            <div className="text-2xl font-semibold">
              {applications.filter((app) => app.status === status).length}
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              {status}
            </div>
          </button>
        ))}
      </section>

      <form
        onSubmit={handleSubmit}
        className="grid gap-3 rounded-lg border border-zinc-200 p-4 sm:grid-cols-2 dark:border-zinc-800"
      >
        <h2 className="text-lg font-semibold sm:col-span-2">
          {editingId ? "Edit application" : "Add application"}
        </h2>
        <label className="flex flex-col gap-1 text-sm">
          Company *
          <input
            required
            className={inputClass}
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Role *
          <input
            required
            className={inputClass}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Status
          <select
            className={inputClass}
            value={form.status}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as Status })
            }
          >
            {STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Date applied
          <input
            type="date"
            className={inputClass}
            value={form.appliedDate}
            onChange={(e) => setForm({ ...form, appliedDate: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Job posting link
          <input
            type="url"
            placeholder="https://"
            className={inputClass}
            value={form.link}
            onChange={(e) => setForm({ ...form, link: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Job description
          <textarea
            rows={4}
            className={inputClass}
            value={form.jobDescription}
            onChange={(e) =>
              setForm({ ...form, jobDescription: e.target.value })
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Notes
          <textarea
            rows={3}
            className={inputClass}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {editingId ? "Save changes" : "Add application"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            >
              Cancel
            </button>
          )}
        </div>
        {error && (
          <p
            role="alert"
            className="text-sm text-red-700 sm:col-span-2 dark:text-red-400"
          >
            {error}
          </p>
        )}
      </form>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            {filter === "All" ? "All applications" : filter} ({visible.length})
          </h2>
          <input
            type="search"
            placeholder="Search company or role"
            className={`${inputClass} sm:w-64`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {visible.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            {applications.length === 0
              ? "No applications yet. Add your first one above."
              : "No applications match this filter."}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {visible.map((app) => (
              <li
                key={app.id}
                className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 sm:flex-row sm:items-start sm:justify-between dark:border-zinc-800"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="font-semibold">{app.role}</div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    {app.company}
                    {app.appliedDate && ` · ${app.appliedDate}`}
                  </div>
                  {app.link && (
                    <a
                      href={app.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sm text-blue-600 underline dark:text-blue-400"
                    >
                      Job posting
                    </a>
                  )}
                  {app.jobDescription && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">
                        Job description
                      </summary>
                      <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                        {app.jobDescription}
                      </p>
                    </details>
                  )}
                  {app.notes && (
                    <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                      {app.notes}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <select
                    aria-label="Status"
                    value={app.status}
                    disabled={pending}
                    onChange={(e) => {
                      const status = e.target.value as Status;
                      run(() => updateApplicationStatus(app.id, status));
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[app.status]}`}
                  >
                    {STATUSES.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => startEdit(app)}
                    className="rounded-md border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleDelete(app)}
                    className="rounded-md border border-red-300 px-3 py-1 text-xs text-red-700 dark:border-red-900 dark:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
