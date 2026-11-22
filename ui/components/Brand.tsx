// The app's mark. Name and geometry live in shared/brand.ts.
import { MARK } from "../../shared/brand";
export { APP_NAME } from "../../shared/brand";

/** The pause-eyed potato on an ink tile. */
export function BrandMark({ size }: { size: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: size * 0.28, background: MARK.ink, boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.12)", flex: "none" }}
    >
      <svg width={size * 0.75} height={size * 0.75} viewBox="0 0 24 24">
        <path d={MARK.potato} fill={MARK.amber} />
        {MARK.eyes.map((e) => (
          <rect key={e.x} x={e.x} y={e.y} width="1.8" height="4.4" rx="0.9" fill={MARK.ink} />
        ))}
      </svg>
    </span>
  );
}
