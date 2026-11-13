// The embed players' addresses stay out of the repo: PUBLIC_PLAYER_1..3 in .env (gitignored), inlined by `bun build --env`.
// Without them (a fresh clone's tests) each gets a placeholder host.
export const HOSTS = {
  p1: process.env.PUBLIC_PLAYER_1 || "https://player-one.test",
  p2: process.env.PUBLIC_PLAYER_2 || "https://player-two.test",
  p3: process.env.PUBLIC_PLAYER_3 || "https://player-three.test",
};

/** The `source` tag a tagged player puts on its messages: its host's first label + "-player". */
export const tagOf = (host: string) => `${new URL(host).hostname.split(".")[0]}-player`;
