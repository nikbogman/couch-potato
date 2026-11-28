// Old Chromium (TVs) drops a whole rule over a selector it can't parse (:focus-visible, < 86) and ignores gap in flexbox (< 84).
// legacyCss rewrites both with margins and :focus. inline: false keeps the originals and adds `.legacy` copies that a page switches on
// itself (the UI bundle); inline: true replaces them outright (server-rendered pages that don't run the UI's detection).
import postcss, { type Declaration, type Root, type Rule } from "postcss";

// ponytail: margins stand in for gap; wrapped rows put a trailing margin on every child; only gap set in the same rule as display:flex is seen
const plugin = (inline: boolean) => ({
  postcssPlugin: "legacy-css",
  Once(root: Root) {
    const rules: Rule[] = [];
    root.walkRules((r) => { rules.push(r); });
    const sels = new Set(rules.map((r) => r.selector));
    const decl = (r: Rule, prop: string) => r.nodes?.find((n): n is Declaration => n.type === "decl" && n.prop === prop);
    const scope = (r: Rule, f: (s: string) => string) => r.selectors.map((s) => (inline ? "" : ".legacy ") + f(s)).join(",");
    const add = (after: Rule, selector: string, css: Record<string, string>) => after.parent!.insertAfter(after, postcss.rule({ selector }).append(...Object.entries(css).map(([prop, value]) => postcss.decl({ prop, value }))));

    for (const r of rules) {
      if (r.selector.includes(":focus-visible")) {
        const swap = (s: string) => s.replaceAll(":focus-visible", ":focus");
        if (inline) r.selectors = r.selectors.map(swap);
        else r.after(r.clone({ selector: r.selectors.filter((s) => s.includes(":focus-visible")).map((s) => ".legacy " + swap(s)).join(",") }));
      }
      const gap = decl(r, "gap");
      const flex = /^(inline-)?flex$/.test(decl(r, "display")?.value ?? "");
      if (!gap || !flex) continue;
      const g = gap.value.split(" ")[0]!;
      const column = decl(r, "flex-direction")?.value.startsWith("column");
      const wrap = decl(r, "flex-wrap")?.value === "wrap";
      if (inline) gap.remove();
      if (wrap) add(r, scope(r, (s) => s + ">*"), { margin: `0 ${g} ${g} 0` });
      else {
        add(r, scope(r, (s) => s + ">*+*"), column ? { "margin-top": g } : { "margin-left": g });
        // pseudo-element flex items aren't matched by *
        if (!column) {
          if (sels.has(r.selector + "::before")) add(r, scope(r, (s) => s + "::before"), { "margin-right": g });
          if (sels.has(r.selector + "::after")) add(r, scope(r, (s) => s + "::after"), { "margin-left": g });
        }
      }
    }
  },
});

export const legacyCss = (css: string, inline = false) => postcss([plugin(inline)]).process(css, { from: undefined }).css;
