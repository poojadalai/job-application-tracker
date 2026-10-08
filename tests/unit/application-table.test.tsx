import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
const pageInfo = () => within(screen.getByRole("navigation", { name: "Pagination" })).getByText(/Page/);
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

describe("ApplicationTable pagination", () => {
  it("shows 20 rows per page", async () => {
    const user = userEvent.setup();
    renderTable(many(25));

    expect(bodyRows()).toHaveLength(20);
    expect(pageInfo()).toHaveTextContent("1–20 of 25 · Page 1 of 2");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(bodyRows()).toHaveLength(5);
    expect(pageInfo()).toHaveTextContent("21–25 of 25 · Page 2 of 2");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("changes page size and goes back to page 1", async () => {
    const user = userEvent.setup();
    renderTable(many(25));

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.selectOptions(screen.getByLabelText("Rows per page"), "10");

    expect(bodyRows()).toHaveLength(10);
    expect(pageInfo()).toHaveTextContent("Page 1 of 3");
  });

  it("goes back to page 1 when sorting changes", async () => {
    const user = userEvent.setup();
    renderTable(many(25));

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Company" }));

    expect(pageInfo()).toHaveTextContent("Page 1 of 2");
  });

  it("keeps the page when a status changes, but resets when search or filter changes", async () => {
    const user = userEvent.setup();
    const apps = many(25);
    const { rerender } = renderTable(apps);
    await user.click(screen.getByRole("button", { name: "Next" }));

    rerender(apps.map((app) => (app.id === "a1" ? { ...app, status: "Offer" } : app)));
    expect(pageInfo()).toHaveTextContent("Page 2 of 2");

    rerender(apps, "All|acme");
    expect(pageInfo()).toHaveTextContent("Page 1 of 2");
  });

  it("moves to the new last page when rows are removed", async () => {
    const user = userEvent.setup();
    const apps = many(25);
    const { rerender } = renderTable(apps);
    await user.click(screen.getByRole("button", { name: "Next" }));

    rerender(apps.slice(0, 20));

    expect(pageInfo()).toHaveTextContent("1–20 of 20 · Page 1 of 1");
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
