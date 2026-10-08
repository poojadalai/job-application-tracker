"use client";

import { useId } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type Announcements,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  STATUS_STYLES,
  type Application,
  type Status,
} from "@/lib/applications";
import { useBoardStore } from "@/lib/board-store";

// Left/Right arrows jump the dragged card a whole column at a time, instead
// of dnd-kit's default of nudging it 25px per key press.
const columnKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  { context: { collisionRect, droppableRects, over } },
) => {
  const direction =
    event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0;
  if (!direction || !collisionRect) return;
  event.preventDefault();
  const columns = [...droppableRects.entries()].sort(
    ([, a], [, b]) => a.left - b.left,
  );
  const current = columns.findIndex(([id]) => id === over?.id);
  const target = columns[current + direction];
  if (!target) return;
  const [, rect] = target;
  return {
    x: rect.left + (rect.width - collisionRect.width) / 2,
    y: rect.top + 40,
  };
};

type CardActions = {
  onEdit: (app: Application) => void;
  onDelete: (app: Application) => void;
  deleteDisabled: boolean;
};

export default function Board({
  applications,
  columns,
  onMove,
  ...actions
}: CardActions & {
  applications: Application[];
  columns: Status[];
  onMove: (id: string, status: Status) => void;
}) {
  const dndId = useId();
  const draggingId = useBoardStore((s) => s.draggingId);
  const setDraggingId = useBoardStore((s) => s.setDraggingId);
  const sensors = useSensors(
    // A small drag distance keeps clicks on the card's buttons working.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: columnKeyboardCoordinates,
    }),
  );

  const dragging = applications.find((app) => app.id === draggingId);

  function label(id: UniqueIdentifier) {
    const app = applications.find((a) => a.id === id);
    return app ? `${app.role} at ${app.company}` : "Application";
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${label(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${label(active.id)} is over the ${over.id} column.`
        : `${label(active.id)} is not over a column.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${label(active.id)} moved to ${over.id}.`
        : `${label(active.id)} was dropped.`,
    onDragCancel: ({ active }) => `Moving ${label(active.id)} was cancelled.`,
  };

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const app = applications.find((a) => a.id === event.active.id);
    const status = event.over?.id as Status | undefined;
    if (app && status && status !== app.status) onMove(app.id, status);
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Press space to pick up the application, use the left and right arrow keys to move it between columns, and press space again to drop it. Press escape to cancel.",
        },
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
        {columns.map((status, index) => (
          <Column
            key={status}
            status={status}
            isFirst={index === 0}
            isLast={index === columns.length - 1}
            applications={applications.filter((app) => app.status === status)}
            {...actions}
          />
        ))}
      </div>
      <DragOverlay>
        {dragging && <CardBody app={dragging} className="rotate-2 shadow-lg" />}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  isFirst,
  isLast,
  applications,
  ...actions
}: CardActions & {
  status: Status;
  isFirst: boolean;
  isLast: boolean;
  applications: Application[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const moveColumn = useBoardStore((s) => s.moveColumn);
  const arrowClass =
    "rounded px-1.5 text-zinc-500 hover:bg-zinc-200 disabled:invisible dark:hover:bg-zinc-800";

  return (
    <section
      ref={setNodeRef}
      aria-label={`${status} column`}
      className={`flex min-w-52 flex-1 flex-col gap-2 rounded-lg border p-2 transition-colors ${
        isOver
          ? "border-foreground bg-zinc-100 dark:bg-zinc-900"
          : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
      }`}
    >
      <header className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
          >
            {status}
          </span>
          <span className="text-xs text-zinc-500">{applications.length}</span>
        </div>
        <div className="flex text-sm">
          <button
            type="button"
            aria-label={`Move ${status} column left`}
            disabled={isFirst}
            onClick={() => moveColumn(status, -1)}
            className={arrowClass}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={`Move ${status} column right`}
            disabled={isLast}
            onClick={() => moveColumn(status, 1)}
            className={arrowClass}
          >
            ›
          </button>
        </div>
      </header>
      <ul className="flex min-h-24 flex-col gap-2">
        {applications.map((app) => (
          <Card key={app.id} app={app} {...actions} />
        ))}
      </ul>
    </section>
  );
}

function Card({
  app,
  onEdit,
  onDelete,
  deleteDisabled,
}: CardActions & { app: Application }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: app.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      {/* The card body is the drag handle; the buttons sit outside it so
          Space/Enter on them don't start a keyboard drag. */}
      <div
        {...listeners}
        {...attributes}
        aria-label={`${app.role} at ${app.company}. Press space to move.`}
        className="cursor-grab touch-none rounded-md active:cursor-grabbing"
      >
        <CardBody app={app} className="border-0" />
      </div>
      <div className="flex gap-2 px-3 pb-2">
        <button
          type="button"
          onClick={() => onEdit(app)}
          className="text-xs text-zinc-600 underline hover:text-foreground dark:text-zinc-400"
        >
          Edit
        </button>
        <button
          type="button"
          disabled={deleteDisabled}
          onClick={() => onDelete(app)}
          className="text-xs text-red-700 underline dark:text-red-400"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

function CardBody({
  app,
  className = "",
}: {
  app: Application;
  className?: string;
}) {
  return (
    <div
      // wrap-anywhere lets long unbroken text (e.g. URLs in "Next") wrap
      // inside the card instead of overflowing the column.
      className={`flex min-w-0 flex-col gap-1 rounded-md border border-zinc-200 bg-white p-3 wrap-anywhere dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      <div className="text-sm font-semibold">{app.company}</div>
      <div className="text-sm text-zinc-700 dark:text-zinc-300">{app.role}</div>
      {app.appliedDate && (
        <div className="text-xs text-zinc-500">Applied {app.appliedDate}</div>
      )}
      {app.nextStep && (
        <div className="mt-1 rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          Next: {app.nextStep}
        </div>
      )}
    </div>
  );
}
