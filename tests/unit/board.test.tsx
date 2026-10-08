import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("Board columns on a real screen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows as many cards as fit on screen, then a screenful more per click", async () => {
    // jsdom has no layout, so fake one: 100px cards, the column list starting
    // 300px down, in jsdom's default 768px-high window.
    // 768 - 300 - 88 (button and padding) = 380px: 3 cards of 100px + gaps fit.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element,
    ) {
      const isCard = this.tagName === "LI";
      return { top: isCard ? 0 : 300, height: isCard ? 100 : 0 } as DOMRect;
    });
    const user = userEvent.setup();
    const column = renderBoard();

    expect(within(column).getAllByRole("listitem")).toHaveLength(3);
    await user.click(
      within(column).getByRole("button", { name: "Show 3 more Applied applications" }),
    );
    expect(within(column).getAllByRole("listitem")).toHaveLength(6);
  });

  it("always shows at least 1 card on a very short screen", () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element,
    ) {
      const isCard = this.tagName === "LI";
      return { top: isCard ? 0 : 700, height: isCard ? 300 : 0 } as DOMRect;
    });
    const column = renderBoard();
    expect(within(column).getAllByRole("listitem")).toHaveLength(1);
  });

  it("counts tall cards at their real height, so the last one isn't cut off", () => {
    // Window 768px, list starts at 300px, 88px kept for the button: 380px.
    // Cards of 150px fit twice (150 + 8 + 150 = 308); a third would end at 466.
    // An average-based estimate over short and tall cards could overshoot.
    const heights = [150, 150, 150, 50, 50, 50, 50, 50, 50, 50];
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element,
    ) {
      if (this.tagName !== "LI") return { top: 300, height: 0 } as DOMRect;
      const index = Array.from(this.parentElement?.children ?? []).indexOf(this);
      return { top: 0, height: heights[index] ?? 50 } as DOMRect;
    });
    const column = renderBoard();
    expect(within(column).getAllByRole("listitem")).toHaveLength(2);
  });
});
