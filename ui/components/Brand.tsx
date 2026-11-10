// The app's name and mark, in one place: the name is still a placeholder.
export const APP_NAME = "Working Title";

/** Amber rounded square with a play glyph. */
export function BrandMark({ size }: { size: number }) {
  return (
    <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: size * 0.3, background: "var(--accent)", flex: "none" }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round">
        <path d="M7 5l12 7-12 7z" />
      </svg>
    </span>
  );
}
