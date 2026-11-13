import type { List } from "../lib/collection";

/** The list's colour as a CSS value: amber To watch, green Watched, pink Favourites. */
export const listColor = (l: List) => `var(--list-${l})`;

/**
 * The list's icon: bookmark, check in a circle, heart. `filled`: solid in the colour (the title is in the list);
 * otherwise outlined in it. `color` replaces the list colour (dark on a selected counter square); `mark` is the filled check's colour.
 */
export function ListIcon({ list, size = 22, color = listColor(list), filled = true, mark = "var(--ink)" }: { list: List; size?: number; color?: string; filled?: boolean; mark?: string }) {
  const shape = { fill: filled ? color : "none", stroke: color, strokeWidth: 2, strokeLinejoin: "round" as const };
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" strokeLinecap="round">
      {list === "to_watch" ? (
        <path d="M6 3h12v18l-6-4-6 4z" {...shape} />
      ) : list === "watched" ? (
        <>
          <circle cx="12" cy="12" r="9" {...shape} />
          <path d="M8 12.5l2.8 2.8L16.5 9.5" fill="none" stroke={filled ? mark : color} strokeWidth="2.4" strokeLinejoin="round" />
        </>
      ) : (
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" {...shape} />
      )}
    </svg>
  );
}
