import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Board, { COLUMN_PAGE_SIZE } from "@/app/board";
import type { Application } from "@/lib/applications";

const apps: Application[] = Array.from({ length: 12 }, (_, i) => ({
  id: `a${i}`,
  company: `Company ${i}`,
  role: "Developer",
  status: "Applied",
  appliedDate: "",
  jobDescription: "",
  nextStep: "",
  link: "",
  notes: "",
}));

function renderBoard(applications = apps) {
  render(
    <Board
      applications={applications}
      columns={["Applied", "Screening"]}
      onMove={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      deleteDisabled={false}
    />,
  );
  return screen.getByRole("region", { name: "Applied column" });
}

describe("Board columns", () => {
  it(`shows the first ${COLUMN_PAGE_SIZE} cards and a "Show more" button`, () => {
    const column = renderBoard();

    expect(within(column).getAllByRole("listitem")).toHaveLength(COLUMN_PAGE_SIZE);
    expect(within(column).getByText("12")).toBeInTheDocument(); // full count
    expect(
      within(column).getByRole("button", { name: "Show 2 more Applied applications" }),
    ).toHaveTextContent("Show 2 more");
  });

  it("shows the rest after clicking Show more", async () => {
    const user = userEvent.setup();
    const column = renderBoard();

    await user.click(within(column).getByRole("button", { name: /Show 2 more/ }));

    expect(within(column).getAllByRole("listitem")).toHaveLength(12);
    expect(within(column).queryByRole("button", { name: /Show/ })).not.toBeInTheDocument();
  });

  it("has no Show more button for short columns", () => {
    const column = renderBoard(apps.slice(0, 3));
    expect(within(column).queryByRole("button", { name: /Show/ })).not.toBeInTheDocument();
  });
});
