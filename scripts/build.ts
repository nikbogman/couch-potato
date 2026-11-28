// Bun bundles the UI, then everything in dist is lowered for the oldest TV we serve: webOS 6 (2021 LG) runs Chromium 79.
// esbuild rewrites the JS syntax (?., ??, ??=, class fields...) and lightningcss the CSS (inset, :is, nesting, color syntax...).
import { transform } from "esbuild";
import { transform as css } from "lightningcss";
import { readdir } from "node:fs/promises";

const dist = import.meta.dir + "/../dist/";
const run = Bun.spawnSync(["bun", "build", "ui/index.html", "--env", "PUBLIC_*", "--outdir", "dist", "--minify", "--public-path", "/", "--asset-naming", "[name].[ext]"], { stdio: ["inherit", "inherit", "inherit"] });
if (run.exitCode) process.exit(run.exitCode);

// Old Chromium drops a whole rule over a selector it can't parse (:focus-visible, < 86) and ignores gap in flexbox (< 84).
// main.tsx sets .legacy on <html> when either is missing; these appended rules then stand in for them.
function legacy(css: string) {
  let out = "";
  for (const [, sel, body] of css.matchAll(/([^{}]+){([^{}]*)}/g)) {
    const list = sel.split(",");
    if (sel.includes(":focus-visible")) out += list.filter((s) => s.includes(":focus-visible")).map((s) => ".legacy " + s.replaceAll(":focus-visible", ":focus")).join(",") + "{" + body + "}";
    const gap = body.match(/(?:^|;)gap:([^;]+)/)?.[1]?.split(" ")[0];
    if (gap && /(^|;)display:flex/.test(body)) {
      const column = /flex-direction:column(;|$)/.test(body);
      const wrap = body.includes("flex-wrap:wrap");
      // ponytail: margins stand in for gap; wrapped rows get a trailing margin on every child, no per-breakpoint gap overrides
      out += list.map((s) => `.legacy ${s}>*` + (wrap ? "" : "+*")).join(",") + "{" + (wrap ? `margin:0 ${gap} ${gap} 0` : column ? `margin-top:${gap}` : `margin-left:${gap}`) + "}";
    }
  }
  return out;
}

const chrome75 = (75 << 16) >>> 0;
for (const name of await readdir(dist)) {
  const path = dist + name;
  if (name.endsWith(".js")) {
    const out = await transform(await Bun.file(path).text(), { target: "chrome75", minify: true, format: "esm", legalComments: "none" });
    await Bun.write(path, out.code);
  } else if (name.endsWith(".css")) {
    const out = css({ filename: name, code: Buffer.from(await Bun.file(path).text()), minify: true, targets: { chrome: chrome75 } });
    await Bun.write(path, out.code + legacy(out.code.toString()));
  }
}
console.log("lowered for chrome 75");
