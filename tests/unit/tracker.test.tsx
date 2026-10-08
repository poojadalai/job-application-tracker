import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createApplication,
  deleteApplication,
  fetchJobPosting,
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
  fetchJobPosting: vi.fn(),
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
const dialog = () => screen.getByRole("dialog", { hidden: true });
const openAddDialog = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Add application" }));
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

  it("shows the applications first, with the form closed", () => {
    render(<Tracker applications={apps} />);
    expect(dialog()).not.toHaveAttribute("open");
    expect(within(column("Applied")).getByText("Acme")).toBeInTheDocument();
  });

  it("adds an application with trimmed values and closes the dialog", async () => {
    const user = userEvent.setup();
    render(<Tracker applications={apps} />);

    await openAddDialog(user);
    expect(dialog()).toHaveAttribute("open");
    expect(screen.getByRole("heading", { name: "Add application" })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Company/), "  initech  ");
    await user.type(screen.getByLabelText(/Role/), "QA Engineer");
    await user.selectOptions(screen.getByLabelText("Status"), "Screening");
    await user.click(screen.getByRole("button", { name: "Save application" }));

    expect(createApplication).toHaveBeenCalledWith(
      expect.objectContaining({ company: "Initech", role: "QA Engineer", status: "Screening" }),
    );
    expect(dialog()).not.toHaveAttribute("open");
    expect(screen.getByLabelText(/Company/)).toHaveValue("");
  });

  it("capitalizes company and role when leaving the field", async () => {
    const user = userEvent.setup();
    render(<Tracker applications={apps} />);

    await openAddDialog(user);
    await user.type(screen.getByLabelText(/Company/), "cat");
    await user.tab();
    await user.type(screen.getByLabelText(/Role/), "frontend engineer");
    await user.tab();

    expect(screen.getByLabelText(/Company/)).toHaveValue("Cat");
    expect(screen.getByLabelText(/Role/)).toHaveValue("Frontend engineer");
  });

  it("does not submit without a company and role", async () => {
    const user = userEvent.setup();
    render(<Tracker applications={apps} />);

    await openAddDialog(user);
    await user.type(screen.getByLabelText(/Company/), "   ");
    await user.click(screen.getByRole("button", { name: "Save application" }));

    expect(createApplication).not.toHaveBeenCalled();
  });

  it("shows an error and keeps the dialog open when saving fails", async () => {
    vi.mocked(createApplication).mockRejectedValue(new Error("Network down"));
    const user = userEvent.setup();
    render(<Tracker applications={apps} />);

    await openAddDialog(user);
    await user.type(screen.getByLabelText(/Company/), "Initech");
    await user.type(screen.getByLabelText(/Role/), "QA Engineer");
    await user.click(screen.getByRole("button", { name: "Save application" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't save your change");
    expect(dialog()).toContainElement(alert);
    expect(dialog()).toHaveAttribute("open");
    expect(screen.getByLabelText(/Company/)).toHaveValue("Initech");
  });

  it("cancel closes the dialog and the next add starts empty", async () => {
    const user = userEvent.setup();
    render(<Tracker applications={apps} />);

    await user.click(within(column("Applied")).getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText(/Company/)).toHaveValue("Acme");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(dialog()).not.toHaveAttribute("open");

    await openAddDialog(user);
    expect(screen.getByLabelText(/Company/)).toHaveValue("");
    expect(updateApplication).not.toHaveBeenCalled();
  });

  it("shows errors from board actions outside the dialog", async () => {
    vi.mocked(updateApplicationStatus).mockRejectedValue(new Error("Network down"));
    const user = userEvent.setup();
    render(<Tracker applications={apps} />);

    await user.click(screen.getByRole("button", { name: "list" }));
    const acme = screen.getByText("Acme", { exact: false }).closest("li")!;
    await user.selectOptions(within(acme).getByRole("combobox", { name: "Status" }), "Offer");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't save your change");
    expect(dialog()).not.toContainElement(alert);
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
    expect(dialog()).not.toHaveAttribute("open");
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

describe("Fill from link", () => {
  const link = "https://jobs.jouwweb.nl/o/front-end-engineer";

  it("is disabled until a link is entered", async () => {
    const user = userEvent.setup();
    render(<Tracker applications={apps} />);
    await openAddDialog(user);

    const button = screen.getByRole("button", { name: "Fill from link" });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText("Job posting link"), link);
    expect(button).toBeEnabled();
  });

  it("fills only the fields that are still empty", async () => {
    vi.mocked(fetchJobPosting).mockResolvedValue({
      ok: true,
      company: "JouwWeb",
      role: "Front End Engineer",
      jobDescription: "Build websites for small businesses.",
    });
    const user = userEvent.setup();
    render(<Tracker applications={apps} />);
    await openAddDialog(user);

    await user.type(screen.getByLabelText(/Company/), "My own name for it");
    await user.type(screen.getByLabelText("Job posting link"), link);
    await user.click(screen.getByRole("button", { name: "Fill from link" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Filled from the job posting");
    expect(fetchJobPosting).toHaveBeenCalledWith(link);
    expect(screen.getByLabelText(/Company/)).toHaveValue("My own name for it");
    expect(screen.getByLabelText(/Role/)).toHaveValue("Front End Engineer");
    expect(screen.getByLabelText("Job description")).toHaveValue(
      "Build websites for small businesses.",
    );
    expect(createApplication).not.toHaveBeenCalled();
  });

  it("asks to fill in manually when the page can't be read", async () => {
    vi.mocked(fetchJobPosting).mockResolvedValue({ ok: false, reason: "unreadable" });
    const user = userEvent.setup();
    render(<Tracker applications={apps} />);
    await openAddDialog(user);

    await user.type(screen.getByLabelText("Job posting link"), "https://www.linkedin.com/jobs/view/1");
    await user.click(screen.getByRole("button", { name: "Fill from link" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Couldn't read this page. Fill in the details manually.",
    );
    expect(screen.getByLabelText(/Company/)).toHaveValue("");
  });

  it("explains an invalid link", async () => {
    vi.mocked(fetchJobPosting).mockResolvedValue({ ok: false, reason: "invalid-link" });
    const user = userEvent.setup();
    render(<Tracker applications={apps} />);
    await openAddDialog(user);

    await user.type(screen.getByLabelText("Job posting link"), "jobs.example.com/123");
    await user.click(screen.getByRole("button", { name: "Fill from link" }));

    expect(await screen.findByRole("status")).toHaveTextContent("starting with https://");
  });
});
