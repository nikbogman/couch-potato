// The app's name and mark, shared by the login page, the manifest and the client.
export const APP_NAME = "couch potato"; // always lower case, like the wordmark

/** The mark: an amber potato whose two eyes are a pause sign (24-unit grid). Shown bare in the app; app icons put it on an ink tile. */
export const MARK = {
  potato: "M3.5 12.6c0-4 3.6-6.8 8.4-6.8 5 0 8.1 2.6 8.1 6.2 0 4-3.6 6.2-8.4 6.2S3.5 16.2 3.5 12.6z",
  eyes: [
    { x: 8.9, y: 9.6 },
    { x: 13.1, y: 9.4 },
  ],
  /** The potato's bounding box, so it can be drawn edge to edge. */
  box: { x: 3.5, y: 5.8, w: 16.5, h: 12.6 },
  ink: "#0B0C0E",
  amber: "#F5B544",
};

/** The mark's glyph (24-unit grid) as SVG markup, for the server-rendered pages and static icons. */
export const markPaths = () =>
  `<path d="${MARK.potato}" fill="${MARK.amber}"/><g fill="${MARK.ink}">${MARK.eyes.map((e) => `<rect x="${e.x}" y="${e.y}" width="1.8" height="4.4" rx="0.9"/>`).join("")}</g>`;

/** The bare potato, `width` px wide, as SVG markup. */
export const markSvg = (width: number) => {
  const { x, y, w, h } = MARK.box;
  return `<svg width="${width}" height="${Math.round((width * h) / w)}" viewBox="${x} ${y} ${w} ${h}" aria-hidden="true">${markPaths()}</svg>`;
};
