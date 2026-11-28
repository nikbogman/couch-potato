// Bun bundles the UI, then everything in dist is lowered for the oldest TV we serve: webOS 6 (2021 LG) runs Chromium 79.
// esbuild rewrites the JS syntax (?., ??, ??=, class fields...) and lightningcss the CSS (inset, :is, nesting, color syntax...).
import { transform } from "esbuild";
import { transform as css } from "lightningcss";
import { readdir } from "node:fs/promises";

const dist = import.meta.dir + "/../dist/";
const run = Bun.spawnSync(["bun", "build", "ui/index.html", "--env", "PUBLIC_*", "--outdir", "dist", "--minify", "--public-path", "/", "--asset-naming", "[name].[ext]"], { stdio: ["inherit", "inherit", "inherit"] });
if (run.exitCode) process.exit(run.exitCode);

const chrome79 = (79 << 16) >>> 0;
for (const name of await readdir(dist)) {
  const path = dist + name;
  if (name.endsWith(".js")) {
    const out = await transform(await Bun.file(path).text(), { target: "chrome79", minify: true, format: "esm", legalComments: "none" });
    await Bun.write(path, out.code);
  } else if (name.endsWith(".css")) {
    const out = css({ filename: name, code: Buffer.from(await Bun.file(path).text()), minify: true, targets: { chrome: chrome79 } });
    await Bun.write(path, out.code);
  }
}
console.log("lowered for chrome 79");
