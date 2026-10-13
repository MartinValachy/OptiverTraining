"use client";

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ItemViewProps, QuestionModule } from "@/components/exam/types";
import { VisualView } from "@/components/VisualView";
import { Steps } from "@/components/ui";
import { LL_FAMILIES, generateLL, scoreLL, type LLItem } from "./generate";

function Row({
  id,
  text,
  rank,
  onUp,
  onDown,
  disabled,
  tone,
  prob,
}: {
  id: number;
  text: string;
  rank: number;
  onUp: () => void;
  onDown: () => void;
  disabled: boolean;
  tone?: "good" | "bad";
  prob?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(id), disabled });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, touchAction: "none" }}
      className={`flex items-center gap-2 rounded-lg border bg-card p-2 ${isDragging ? "z-10 border-accent shadow-lg" : tone === "good" ? "border-good" : tone === "bad" ? "border-bad" : "border-line"}`}
      data-testid={`ll-row-${rank}`}
      data-statement={id}
    >
      <div
        {...attributes}
        {...listeners}
        className="flex min-h-11 flex-1 cursor-grab items-center gap-2 select-none active:cursor-grabbing"
        aria-label={`Drag to reorder: ${text}`}
        data-testid={`ll-handle-${id}`}
      >
        <span className="text-muted" aria-hidden>
          ⋮⋮
        </span>
        <span className="text-sm leading-snug">{text}</span>
        {prob && <span className="tabular ml-auto pl-2 text-xs text-muted">{prob}</span>}
      </div>
      <div className="flex flex-col">
        <button className="h-6 w-11 rounded text-muted disabled:opacity-20" onClick={onUp} disabled={disabled || rank === 0} aria-label="Move up" data-testid={`ll-up-${id}`}>
          ▲
        </button>
        <button className="h-6 w-11 rounded text-muted disabled:opacity-20" onClick={onDown} disabled={disabled || rank === 2} aria-label="Move down" data-testid={`ll-down-${id}`}>
          ▼
        </button>
      </div>
    </li>
  );
}

function View({ item, draft, setDraft, locked, response }: ItemViewProps<LLItem, number[]>) {
  const order = (locked ? response : draft) ?? [0, 1, 2];
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const move = (from: number, to: number) => setDraft(arrayMove(order, from, to));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = order.indexOf(Number(e.active.id));
    const to = order.indexOf(Number(e.over.id));
    move(from, to);
  };
  return (
    <div>
      <div className="card mb-3 space-y-3 p-4">
        <p className="text-[15px] leading-relaxed" data-testid="ll-scenario">
          {item.scenario}
        </p>
        {item.visual && <VisualView v={item.visual} />}
      </div>
      <div className="mb-1 text-xs text-muted">Most likely</div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order.map(String)} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2" data-testid="ll-list">
            {order.map((sid, rank) => (
              <Row
                key={sid}
                id={sid}
                rank={rank}
                text={item.statements[sid]}
                disabled={locked}
                onUp={() => move(rank, rank - 1)}
                onDown={() => move(rank, rank + 1)}
                tone={locked ? (item.correctOrder[rank] === sid ? "good" : "bad") : undefined}
                prob={locked ? `${(item.probs[sid] * 100).toFixed(1)}%` : undefined}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <div className="mt-1 text-xs text-muted">Least likely</div>
    </div>
  );
}

function Solution({ item }: { item: LLItem; response: number[] | null }) {
  return <Steps lines={item.solution.filter(Boolean)} />;
}

export const likelihoodModule: QuestionModule<LLItem, number[]> = {
  id: "likelihood",
  title: "Likelihood-list",
  families: LL_FAMILIES,
  generate: generateLL,
  score: (item, r) => scoreLL(item, r),
  initialDraft: () => [0, 1, 2],
  // at 0 s the current arrangement is submitted
  onTimeout: (draft) => draft ?? [0, 1, 2],
  canSubmit: (d) => !!d && d.length === 3,
  View,
  Solution,
  hint: (item) => item.hint,
  describe: (item) => item.scenario,
  answerLabel: (item) => item.correctOrder.map((i) => item.statements[i]).join(" > "),
  responseLabel: (item, r) => (r ? r.map((i) => item.statements[i]).join(" > ") : "—"),
};
