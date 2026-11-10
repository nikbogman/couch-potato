import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";

const queryClient = new QueryClient();

// Phones belong on the remote. A phone opening "/" (an old shortcut, a typed address) goes to /remote,
// and /remote pages point at the remote's manifest, so "Add to Home Screen" there makes a remote shortcut.
const phone = matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 600;
if (phone && location.pathname === "/") history.replaceState(null, "", "/remote");
if (location.pathname.startsWith("/remote")) document.querySelector('link[rel="manifest"]')?.setAttribute("href", "/remote.webmanifest");

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </QueryClientProvider>,
);
