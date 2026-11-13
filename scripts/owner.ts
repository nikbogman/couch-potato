// Creates the owner account, or resets its name and password. The owner is user 1, who owns the lists from before accounts.
//   bun scripts/owner.ts <name>            local D1 (wrangler dev)
//   bun scripts/owner.ts <name> --remote   the deployed D1
// The password is asked for (8+ characters) and only its hash leaves this machine.
import { hashPassword } from "../server/auth/crypto";
import { MIN_PASSWORD } from "../server/auth/accounts";

const [name, where = "--local"] = Bun.argv.slice(2);
if (!name?.trim() || !["--local", "--remote"].includes(where)) {
  console.error("Usage: bun scripts/owner.ts <name> [--local|--remote]");
  process.exit(1);
}
const password = prompt(`Password for ${name} (${MIN_PASSWORD}+ characters):`) ?? "";
if (password.length < MIN_PASSWORD) {
  console.error(`The password needs at least ${MIN_PASSWORD} characters.`);
  process.exit(1);
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const sql = `insert into users (id, name, password_hash, owner, created_at) values (1, ${q(name.trim())}, ${q(await hashPassword(password))}, 1, ${Date.now()})
  on conflict (id) do update set name = excluded.name, password_hash = excluded.password_hash, owner = 1, phone_session = null;`;
const run = Bun.spawnSync([process.execPath, "x", "wrangler", "d1", "execute", "couch-potato", where, "--command", sql], { stdio: ["inherit", "inherit", "inherit"] });
process.exit(run.exitCode ?? 1);
