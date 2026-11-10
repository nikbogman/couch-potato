import { handle, type Env } from "../server/handler";

export { Relay } from "./relay";

/** The real bindings (wrangler.jsonc); passing it to `handle` checks they fit the structural `Env` the handler is tested with. */
interface Bindings {
  COUCH_PASSWORD?: string;
  TMDB_API_KEY?: string;
  DB: D1Database;
  ASSETS: Fetcher;
  RELAY: DurableObjectNamespace;
}

export default {
  fetch: (req, env) => handle(req, env satisfies Env),
} satisfies ExportedHandler<Bindings>;
