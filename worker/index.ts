import { WorkerEntrypoint } from "cloudflare:workers";
import { handle, type Env } from "../server/handler";
import { lookup, type Wanted } from "../server/lookup";
import { createTmdb } from "../server/tmdb/client";

export { Relay } from "./relay";

/** The real bindings (wrangler.jsonc); passing it to `handle` checks they fit the structural `Env` the handler is tested with. */
interface Bindings {
  TMDB_API_KEY?: string;
  DB: D1Database;
  ASSETS: Fetcher;
  RELAY: DurableObjectNamespace;
  LIMITER: RateLimit;
}

/** Only reachable through a service binding (unreel's COUCH_POTATO), never from the internet, so it needs no session. */
export class Lookup extends WorkerEntrypoint<Bindings> {
  titles(wanted: Wanted[]) {
    if (!this.env.TMDB_API_KEY) throw new Error("TMDB_API_KEY is not set");
    return lookup(createTmdb(this.env.TMDB_API_KEY), wanted);
  }
}

export default {
  fetch: (req, env) => handle(req, env satisfies Env),
} satisfies ExportedHandler<Bindings>;
