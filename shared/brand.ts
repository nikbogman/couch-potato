// The app's name and mark, shared by the login page, the manifest and the client.
export const APP_NAME = "couch potato"; // always lower case, like the wordmark

/**
 * The mark: a one-line sofa in amber on ink (24-unit grid). The back cushion meets each armrest at the top of its curve:
 * joined, never inside it, so its ends are butt-capped (`back`) while everything else is round-capped (`body`).
 */
export const MARK = {
  body: ["M2 18.5v-5a2.25 2.25 0 0 1 4.5 0v2h11v-2a2.25 2.25 0 0 1 4.5 0v5z", "M4.25 18.5v2M19.75 18.5v2"],
  back: "M4.25 11.25V7a3 3 0 0 1 3-3h9.5a3 3 0 0 1 3 3v4.25",
  ink: "#0B0C0E",
  amber: "#F5B544",
};

/** The mark's glyph as SVG markup, for the server-rendered login page and static icons. */
export const markPaths = (stroke: string, width: number) =>
  `<g fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"><g stroke-linecap="round">${MARK.body.map((d) => `<path d="${d}"/>`).join("")}</g><path d="${MARK.back}"/></g>`;
