"use client";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Entry } from "@/lib/planner-model";

type Props = {
  id: string; label: string; placeholder?: string; checkbox?: boolean;
  entry: Entry; ready: boolean; picked: string | null;
  update: (id: string, patch: Partial<Entry>) => void;
  flush: () => void; pick: (id: string) => void; move: (source: string, target: string) => void;
};
export function EntryField({ id, label, placeholder = "", checkbox = false, entry, ready, picked, update, flush, pick, move }: Props) {
  const hasText = !!entry.text.trim();
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id, disabled: !ready || !hasText });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id, disabled: !ready });
  return <div ref={node => { setDragRef(node); setDropRef(node); }} data-entry-id={id}
    className={`writing-row ${hasText ? "has-text" : ""} ${entry.done ? "completed" : ""} ${isOver ? "drop-over" : ""} ${isDragging ? "dragging" : ""} ${picked === id ? "picked" : ""}`}
    onClick={event => {
      if (picked && picked !== id && !(event.target as HTMLElement).closest("button")) { event.preventDefault(); move(picked, id); }
    }}
    onKeyDown={event => {
      if (event.key === "Enter" && picked && picked !== id) { event.preventDefault(); move(picked, id); }
    }}>
    {(checkbox || hasText) && <Checkbox disabled={!ready} aria-label={`${label}，完成`} checked={entry.done} onCheckedChange={done => update(id, { done: done === true })} />}
    <input aria-label={label} disabled={!ready} value={entry.text} placeholder={placeholder} maxLength={2000}
      onChange={event => update(id, { text: event.target.value })} onBlur={flush} />
    {hasText && <button {...attributes} {...listeners} className="drag-handle" type="button"
      aria-label={`${label}，移动事项`} title="拖动；或点一下，再点目标位置" aria-pressed={picked === id}
      onClick={() => pick(id)}><GripVertical size={14} /></button>}
  </div>;
}
