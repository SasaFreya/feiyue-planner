export type Entry = { text: string; done: boolean };
export type Entries = Record<string, Entry>;
export const emptyEntry = (): Entry => ({ text: "", done: false });
export type Move = { before: Entries; after: Entries };

export function moveEntries(entries: Entries, source: string, target: string): Move | null {
  if (source === target || !entries[source]?.text.trim()) return null;
  return {
    before: { [source]: entries[source], [target]: entries[target] ?? emptyEntry() },
    after: { [source]: entries[target] ?? emptyEntry(), [target]: entries[source] },
  };
}
export function canUndo(entries: Entries, move: Move) {
  return Object.entries(move.after).every(([key, value]) =>
    entries[key]?.text === value.text && entries[key]?.done === value.done);
}
