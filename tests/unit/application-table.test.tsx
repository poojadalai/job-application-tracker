import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ApplicationTable from "@/app/application-table";
import type { Application } from "@/lib/applications";

const pad = (n: number) => String(n).padStart(2, "0");

function make(i: number, overrides: Partial<Application> = {}): Application {
  return {
    id: `a${i}`,
    company: `Company ${pad(i)}`,
    role: "Developer",
    status: "Applied",
    appliedDate: `2026-09-${pad(i)}`,
    jobDescription: "",
    nextStep: "",
    link: "",
    notes: "",
    ...overrides,
  };
}

const many = (count: number) => Array.from({ length: count }, (_, i) => make(i + 1));

function renderTable(applications: Application[], resetKey = "All|") {
  const props = {
    onStatusChange: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    deleteDisabled: false,
  };
  const view = render(
    <ApplicationTable applications={applications} resetKey={resetKey} {...props} />,
  );
  const rerender = (next: Application[], key = resetKey) =>
    view.rerender(<ApplicationTable applications={next} resetKey={key} {...props} />);
  return { ...props, rerender };
}

const bodyRows = () => screen.getAllByRole("row").slice(1);
const companies = () =>
  bodyRows().map((row) => within(row).getAllByRole("cell")[0].textContent);
const shownText = () => screen.getByText(/^Showing/);
const showMore = (count: number) =>
  screen.getByRole("button", { name: `Show ${count} more applications` });
const header = (name: string) => screen.getByRole("columnheader", { name: new RegExp(name) });

describe("ApplicationTable sorting", () => {
  it("shows the newest applied first by default, with undated ones last", () => {
    renderTable([make(1), make(2, { appliedDate: "" }), make(3)]);

    expect(companies()).toEqual(["Company 03", "Company 01", "Company 02"]);
    expect(header("Date applied")).toHaveAttribute("aria-sort", "descending");
  });

  it("sorts by company, then reverses on a second click", async () => {
    const user = userEvent.setup();
    renderTable([
      make(1, { company: "Globex" }),
      make(2, { company: "acme" }),
      make(3, { company: "Initech" }),
    ]);

    await user.click(screen.getByRole("button", { name: "Company" }));
    expect(companies()).toEqual(["acme", "Globex", "Initech"]);
    expect(header("Company")).toHaveAttribute("aria-sort", "ascending");
    expect(header("Date applied")).toHaveAttribute("aria-sort", "none");

    await user.click(screen.getByRole("button", { name: "Company" }));
    expect(companies()).toEqual(["Initech", "Globex", "acme"]);
  });

  it("sorts status in pipeline order, not alphabetically", async () => {
    const user = userEvent.setup();
    renderTable([
      make(1, { company: "Offer Co", status: "Offer" }),
      make(2, { company: "Applied Co", status: "Applied" }),
      make(3, { company: "Interview Co", status: "Interview" }),
    ]);

    await user.click(screen.getByRole("button", { name: "Status" }));
    expect(companies()).toEqual(["Applied Co", "Interview Co", "Offer Co"]);
  });
});

describe("ApplicationTable Show more", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows 20 rows before the screen is measured, then the rest on Show more", async () => {
    const user = userEvent.setup();
    renderTable(many(25));

    expect(bodyRows()).toHaveLength(20);
    expect(shownText()).toHaveTextContent("Showing 20 of 25");

    await user.click(showMore(5));
    expect(bodyRows()).toHaveLength(25);
    expect(shownText()).toHaveTextContent("Showing 25 of 25");
    expect(screen.queryByRole("button", { name: /Show d+ more/ })).not.toBeInTheDocument();
  });

  it("shows as many rows as fit on screen, then a screenful more per click", async () => {
    // jsdom has no layout, so fake one: 50px rows, the table body starting
    // 300px down, in jsdom's default 768px-high window.
    // 768 - 300 - 88 (button and padding) = 380px, so 7 rows of 50px fit.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element,
    ) {
      return { top: this.tagName === "TBODY" ? 300 : 0, height: this.tagName === "TR" ? 50 : 0 } as DOMRect;
    });
    const user = userEvent.setup();
    renderTable(many(25));

    expect(bodyRows()).toHaveLength(7);
    await user.click(showMore(7));
    expect(bodyRows()).toHaveLength(14);
  });

  it("has no Show more button when everything fits", () => {
    renderTable(many(5));
    expect(shownText()).toHaveTextContent("Showing 5 of 5");
    expect(screen.queryByRole("button", { name: /Show d+ more/ })).not.toBeInTheDocument();
  });

  it("goes back to the first rows when sorting changes", async () => {
    const user = userEvent.setup();
    renderTable(many(25));

    await user.click(showMore(5));
    await user.click(screen.getByRole("button", { name: "Company" }));

    expect(bodyRows()).toHaveLength(20);
  });

  it("keeps the rows shown when a status changes, but resets when search or filter changes", async () => {
    const user = userEvent.setup();
    const apps = many(25);
    const { rerender } = renderTable(apps);
    await user.click(showMore(5));

    rerender(apps.map((app) => (app.id === "a1" ? { ...app, status: "Offer" } : app)));
    expect(bodyRows()).toHaveLength(25);

    rerender(apps, "All|acme");
    expect(bodyRows()).toHaveLength(20);
  });
});

describe("ApplicationTable actions", () => {
  it("passes status changes, edits and deletes to the callbacks", async () => {
    const user = userEvent.setup();
    const app = make(1);
    const { onStatusChange, onEdit, onDelete } = renderTable([app]);
    const row = bodyRows()[0];

    await user.selectOptions(within(row).getByRole("combobox", { name: "Status" }), "Offer");
    await user.click(within(row).getByRole("button", { name: "Edit" }));
    await user.click(within(row).getByRole("button", { name: "Delete" }));

    expect(onStatusChange).toHaveBeenCalledWith("a1", "Offer");
    expect(onEdit).toHaveBeenCalledWith(app);
    expect(onDelete).toHaveBeenCalledWith(app);
  });

  it("links the company name to the job posting when there is one", () => {
    renderTable([make(1, { link: "https://jobs.example.com/1" })]);
    expect(screen.getByRole("link", { name: "Company 01" })).toHaveAttribute(
      "href",
      "https://jobs.example.com/1",
    );
  });
});
