// The app's name and mark, shared by the login page, the manifest and the client.
export const APP_NAME = "couch potato"; // always lower case, like the wordmark

/** The mark: an amber potato whose two eyes are a pause sign, on ink (24-unit grid, drawn in a 32-unit tile). */
export const MARK = {
  potato: "M3.5 12.6c0-4 3.6-6.8 8.4-6.8 5 0 8.1 2.6 8.1 6.2 0 4-3.6 6.2-8.4 6.2S3.5 16.2 3.5 12.6z",
  eyes: [
    { x: 8.9, y: 9.6 },
    { x: 13.1, y: 9.4 },
  ],
  ink: "#0B0C0E",
  amber: "#F5B544",
};

/** The mark's glyph (24-unit grid) as SVG markup, for the server-rendered pages and static icons. */
export const markPaths = () =>
  `<path d="${MARK.potato}" fill="${MARK.amber}"/><g fill="${MARK.ink}">${MARK.eyes.map((e) => `<rect x="${e.x}" y="${e.y}" width="1.8" height="4.4" rx="0.9"/>`).join("")}</g>`;
