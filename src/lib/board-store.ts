import { create } from "zustand";
import { STATUSES, type Status } from "@/lib/applications";

// UI-only state for the board. Application data stays in the database and
// arrives as props; nothing here is persisted.
type BoardState = {
  view: "board" | "list";
  columnOrder: Status[];
  draggingId: string | null;
  setView: (view: BoardState["view"]) => void;
  setDraggingId: (id: string | null) => void;
  moveColumn: (status: Status, direction: -1 | 1) => void;
};

export const useBoardStore = create<BoardState>()((set) => ({
  view: "board",
  columnOrder: [...STATUSES],
  draggingId: null,
  setView: (view) => set({ view }),
  setDraggingId: (draggingId) => set({ draggingId }),
  moveColumn: (status, direction) =>
    set(({ columnOrder }) => {
      const from = columnOrder.indexOf(status);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= columnOrder.length) return {};
      const next = [...columnOrder];
      [next[from], next[to]] = [next[to], next[from]];
      return { columnOrder: next };
    }),
}));
