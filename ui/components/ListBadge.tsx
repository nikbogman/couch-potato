import type { List } from "../lib/collection";

/** The list's colour as a CSS value: amber To watch, green Watched, pink Favourites. */
export const listColor = (l: List) => `var(--list-${l})`;

/** The list's icon: bookmark, check, heart. Filled in the list colour unless `color` says otherwise. */
export function ListIcon({ list, size = 22, color = listColor(list) }: { list: List; size?: number; color?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={list === "watched" ? "none" : color} stroke={list === "watched" ? color : "none"} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      {list === "to_watch" ? <path d="M6 3h12v18l-6-4-6 4z" /> : list === "watched" ? <path d="M5 12l5 5 9-10" /> : <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />}
    </svg>
  );
}
