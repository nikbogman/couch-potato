// Working Title: the little behaviour the designs need.

// TV pages: fit the 1920x1080 canvas to the window.
const tv = document.querySelector(".tv");
if (tv) {
  const fit = () => (tv.style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`);
  addEventListener("resize", fit);
  fit();
}

// TV pages: arrow keys move focus to the nearest focusable item in that direction (D-pad style).
if (tv) {
  const dirs = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  addEventListener("keydown", (e) => {
    const d = dirs[e.key];
    if (!d || e.target.matches("input")) return;
    const from = document.activeElement?.getBoundingClientRect();
    if (!from || document.activeElement === document.body) return void tv.querySelector("[autofocus], a, button")?.focus();
    const cx = from.x + from.width / 2, cy = from.y + from.height / 2;
    let best = null, bestScore = Infinity;
    for (const el of tv.querySelectorAll("a[href], button:not([disabled]), [tabindex='0']")) {
      if (el === document.activeElement) continue;
      const r = el.getBoundingClientRect();
      const dx = r.x + r.width / 2 - cx, dy = r.y + r.height / 2 - cy;
      const along = dx * d[0] + dy * d[1];
      if (along <= 1) continue;
      const score = along + Math.abs(dx * d[1] + dy * d[0]) * 2; // ponytail: straight-line heuristic; real app uses its spatial nav
      if (score < bestScore) (bestScore = score), (best = el);
    }
    if (best) (e.preventDefault(), best.focus());
  });
  addEventListener("load", () => tv.querySelector("[autofocus]")?.focus());
}

// Toggle groups: one pressed button per group (seasons, players).
for (const group of document.querySelectorAll("[data-toggle]")) {
  group.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    for (const x of group.querySelectorAll("button")) x.setAttribute("aria-pressed", String(x === b));
  });
}

// Phone segmented tabs: switch the list shown.
for (const tabs of document.querySelectorAll("[role=tablist]")) {
  tabs.addEventListener("click", (e) => {
    const t = e.target.closest("[role=tab]");
    if (!t) return;
    for (const x of tabs.querySelectorAll("[role=tab]")) {
      const on = x === t;
      x.setAttribute("aria-selected", String(on));
      document.getElementById(x.getAttribute("aria-controls")).hidden = !on;
    }
  });
}

// Player: the header hides after 4 s of no input and comes back on any key, click or pointer move.
const head = document.querySelector(".player-head");
if (head) {
  let timer;
  const wake = () => {
    head.classList.remove("hidden");
    clearTimeout(timer);
    timer = setTimeout(() => head.classList.add("hidden"), 4000);
  };
  for (const ev of ["keydown", "pointermove", "click"]) addEventListener(ev, wake);
  wake();
  const toast = document.querySelector(".toast");
  if (toast) setTimeout(() => (toast.hidden = true), 3000);
}

// Phone remote: play/pause button flips its icon and label.
const play = document.querySelector("[data-play]");
if (play) {
  play.addEventListener("click", () => {
    const playing = play.getAttribute("aria-label") === "Pause";
    play.setAttribute("aria-label", playing ? "Play" : "Pause");
    play.innerHTML = playing
      ? '<svg width="34" height="34" viewBox="0 0 24 24" fill="#0b0c0e" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>'
      : '<svg width="34" height="34" viewBox="0 0 24 24" fill="#0b0c0e" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
  });
}
