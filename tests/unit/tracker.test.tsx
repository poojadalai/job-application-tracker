import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createApplication,
  deleteApplication,
  updateApplication,
  updateApplicationStatus,
} from "@/app/actions";
import Tracker from "@/app/tracker";
import { STATUSES, type Application } from "@/lib/applications";
import { useBoardStore } from "@/lib/board-store";

vi.mock("@/app/actions", () => ({
  createApplication: vi.fn(),
  updateApplication: vi.fn(),
  updateApplicationStatus: vi.fn(),
  deleteApplication: vi.fn(),
}));

const base = {
  appliedDate: "2026-10-01",
  jobDescription: "",
  nextStep: "",
  link: "",
  notes: "",
};
const apps: Application[] = [
  { ...base, id: "a1", company: "Acme", role: "Frontend Developer", status: "Applied" },
  { ...base, id: "a2", company: "Globex", role: "Backend Developer", status: "Interview" },
];

const column = (status: string) => screen.getByRole("region", { name: `${status} column` });
const tile = (status: string) =>
  screen.getByRole("button", { name: new RegExp(`^\\d+\\s*${status}$`) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createApplication).mockResolvedValue();
  vi.mocked(updateApplication).mockResolvedValue();
  vi.mocked(updateApplicationStatus).mockResolvedValue();
  vi.mocked(deleteApplication).mockResolvedValue();
  useBoardStore.setState({ view: "board", columnOrder: [...STATUSES], draggingId: null });
  // jsdom has no layout, so scrollIntoView (used when editing) doesn't exist.
  Element.prototype.scrollIntoView = vi.fn();
});

describe("Tracker", () => {
  it("shows each application in its status column", () => {
    render(<Tracker applications={apps} />);
    expect(within(column("Applied")).getByText("Acme")).toBeInTheDocument();
    expect(within(column("Interview")).getByText("Globex")).toBeInTheDocument();
    expect(within(column("Offer")).queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("filters by status when a count tile is clicked", async () => {
    const user = userEvent.setup();
    render(<Tracker applications={apps} />);

    expect(tile("Interview")).toHaveTextContent("1");
    await user.click(tile("Interview"));

    expect(screen.getByRole("heading", { name: "Interview (1)" })).toBeInTheDocument();
    expect(screen.queryByText("Acme")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Applied column" })).not.toBeInTheDocument();
  });

  it("searches by company or role", async () => {
    const user = userEvent.setup();
    render(<Tracker applications={apps} />);

    await user.type(screen.getByPlaceholderText("Search company or role"), "backend");

    expect(screen.getByText("Globex")).toBeInTheDocument();
    expect(screen.queryByText("Acme")).not.toBeInTheDocument();
  });

  it("adds an application with trimmed values and clears the form", async () => {
    const user = userEvent.setup();
    render(<Tracker applications={apps} />);

    await user.type(screen.getByLabelText(/Company/), "  Initech  ");
    await user.type(screen.getByLabelText(/Role/), "QA Engineer");
    await user.selectOptions(screen.getByLabelText("Status"), "Screening");
    await user.click(screen.getByRole("button", { name: "Add application" }));

    expect(createApplication).toHaveBeenCalledWith(
      expect.objectContaining({ company: "Initech", role: "QA Engineer", status: "Screening" }),
    );
    expect(screen.getByLabelText(/Company/)).toHaveValue("");
  });

  it("does not submit without a company and role", async () => {
    const user = userEvent.setup();
    render(<Tracker applications={apps} />);

    await user.type(screen.getByLabelText(/Company/), "   ");
    await user.click(screen.getByRole("button", { name: "Add application" }));

    expect(createApplication).not.toHaveBeenCalled();
  });

  it("shows an error and keeps the form when saving fails", async () => {
    vi.mocked(createApplication).mockRejectedValue(new Error("Network down"));
    const user = userEvent.setup();
    render(<Tracker applications={apps} />);

    await user.type(screen.getByLabelText(/Company/), "Initech");
    await user.type(screen.getByLabelText(/Role/), "QA Engineer");
    await user.click(screen.getByRole("button", { name: "Add application" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save your change");
    expect(screen.getByLabelText(/Company/)).toHaveValue("Initech");
  });

  it("edits an existing application", async () => {
    const user = userEvent.setup();
    render(<Tracker applications={apps} />);

    await user.click(within(column("Applied")).getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("heading", { name: "Edit application" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Company/)).toHaveValue("Acme");

    const role = screen.getByLabelText(/Role/);
    await user.clear(role);
    await user.type(role, "Senior Frontend Developer");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(updateApplication).toHaveBeenCalledWith(
      "a1",
      expect.objectContaining({ company: "Acme", role: "Senior Frontend Developer" }),
    );
    expect(createApplication).not.toHaveBeenCalled();
  });

  it("deletes only after the user confirms", async () => {
    const confirm = vi.spyOn(window, "confirm");
    const user = userEvent.setup();
    render(<Tracker applications={apps} />);
    const deleteAcme = within(column("Applied")).getByRole("button", { name: "Delete" });

    confirm.mockReturnValueOnce(false);
    await user.click(deleteAcme);
    expect(deleteApplication).not.toHaveBeenCalled();

    confirm.mockReturnValueOnce(true);
    await user.click(deleteAcme);
    expect(deleteApplication).toHaveBeenCalledWith("a1");
  });

  it("changes status from the list view", async () => {
    const user = userEvent.setup();
    render(<Tracker applications={apps} />);

    await user.click(screen.getByRole("button", { name: "list" }));
    const acme = screen.getByText("Acme", { exact: false }).closest("li")!;
    await user.selectOptions(within(acme).getByRole("combobox", { name: "Status" }), "Offer");

    expect(updateApplicationStatus).toHaveBeenCalledWith("a1", "Offer");
  });

  it("reorders board columns with the arrow buttons", async () => {
    const user = userEvent.setup();
    render(<Tracker applications={apps} />);

    await user.click(screen.getByRole("button", { name: "Move Applied column right" }));

    const names = screen
      .getAllByRole("region")
      .map((region) => region.getAttribute("aria-label"));
    expect(names.slice(0, 2)).toEqual(["Screening column", "Applied column"]);
  });
});
