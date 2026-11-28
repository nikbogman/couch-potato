// Chromium 79 (2021 LG webOS) lacks String.replaceAll, which the bundled dependencies call.
if (!String.prototype.replaceAll) String.prototype.replaceAll = function (this: string, a: string | RegExp, b: never) { return a instanceof RegExp ? this.replace(a, b) : this.split(a).join(b as string); } as typeof String.prototype.replaceAll;

// Old Chromium: no :focus-visible (< 86) or flex gap (< 84). scripts/build.ts appends .legacy fallback rules for both.
try { document.querySelector(":focus-visible"); } catch { document.documentElement.classList.add("legacy"); }
{
  const d = document.createElement("div");
  d.style.cssText = "display:flex;flex-direction:column;row-gap:1px";
  d.append(document.createElement("div"), document.createElement("div"));
  document.documentElement.append(d);
  if (d.scrollHeight !== 1) document.documentElement.classList.add("legacy");
  d.remove();
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";

const queryClient = new QueryClient();

// Phones belong on the remote. A phone opening "/" (an old shortcut, a typed address) goes to /remote,
// and /remote pages point at the remote's manifest, so "Add to Home Screen" there makes a remote shortcut.
const phone = matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 600;
if (phone && location.pathname === "/") history.replaceState(null, "", "/remote");
// Focus placement scrolls the TV (navigation/spatial.ts). The browser's own restore on Back would fight it: it scrolls the page
// back after focus was placed, leaving the focused element off screen and Up/Down with nothing to move to.
history.scrollRestoration = "manual";
if (location.pathname.startsWith("/remote")) document.querySelector('link[rel="manifest"]')?.setAttribute("href", "/remote.webmanifest");

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </QueryClientProvider>,
);
