// The app's mark. Name and geometry live in shared/brand.ts.
import { MARK } from "../../shared/brand";
export { APP_NAME } from "../../shared/brand";

/** The pause-eyed potato, bare, `size` px wide. */
export function BrandMark({ size }: { size: number }) {
  const { x, y, w, h } = MARK.box;
  return (
    <svg aria-hidden="true" width={size} height={Math.round((size * h) / w)} viewBox={`${x} ${y} ${w} ${h}`} style={{ flex: "none", display: "block" }}>
      <path d={MARK.potato} fill={MARK.amber} />
      {MARK.eyes.map((e) => (
        <rect key={e.x} x={e.x} y={e.y} width="1.8" height="4.4" rx="0.9" fill={MARK.ink} />
      ))}
    </svg>
  );
}
