import { beforeEach, describe, expect, it } from "vitest";
import { STATUSES } from "@/lib/applications";
import { useBoardStore } from "@/lib/board-store";

const order = () => useBoardStore.getState().columnOrder;

describe("board store", () => {
  beforeEach(() => {
    useBoardStore.setState({ view: "board", columnOrder: [...STATUSES], draggingId: null });
  });

  it("swaps a column with its neighbour", () => {
    useBoardStore.getState().moveColumn("Screening", 1);
    expect(order()).toEqual(["Applied", "Interview", "Screening", "Offer", "Rejected"]);

    useBoardStore.getState().moveColumn("Screening", -1);
    expect(order()).toEqual([...STATUSES]);
  });

  it("ignores moves past either end", () => {
    useBoardStore.getState().moveColumn("Applied", -1);
    useBoardStore.getState().moveColumn("Rejected", 1);
    expect(order()).toEqual([...STATUSES]);
  });

  it("does not mutate the shared STATUSES list", () => {
    useBoardStore.getState().moveColumn("Applied", 1);
    expect(STATUSES[0]).toBe("Applied");
  });
});
