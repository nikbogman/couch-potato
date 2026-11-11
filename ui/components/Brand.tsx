// The app's mark. Name and geometry live in shared/brand.ts.
import { MARK } from "../../shared/brand";
export { APP_NAME } from "../../shared/brand";

/** The sofa in amber line on an ink tile. */
export function BrandMark({ size }: { size: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: size * 0.3, background: MARK.ink, boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.12)", flex: "none" }}
    >
      <svg width={size * 0.66} height={size * 0.66} viewBox="0 0 24 24" fill="none" stroke={MARK.amber} strokeWidth="2" strokeLinejoin="round">
        <g strokeLinecap="round">
          {MARK.body.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <path d={MARK.back} />
      </svg>
    </span>
  );
}
