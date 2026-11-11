import { useEffect, useEffectEvent, useRef } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router";
import { HELP_EVENT } from "../components/ControllerHelp";
import { isDirection } from "./gamepad";
import { startPad, usePad } from "./gamepadInput";
import { focusAndReveal, focusUnderPointer, isTextEntry, jumpFocus, moveFocus, pressArrow, restoreFocus, type Dir, type Jump } from "./spatial";

const ARROWS: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
const JUMPS: Record<string, Jump> = { Home: "home", End: "end", PageUp: "pageUp", PageDown: "pageDown" };
const SETTLE_MS = 4000; // how long after a route change we keep looking for the page's primary element

/**
 * Keyboard and controller browsing for every TV screen: arrows and the d-pad/stick move focus spatially, A activates, B goes back.
 * Home/End/PageUp/PageDown jump along the row or page; Escape/Backspace go back; Delete (pad: Y) removes a Continue watching card.
 * The d-pad is turned into arrow keys, so a widget that handles arrows itself (season tabs) wins over the spatial move.
 * The player screen reads the pad itself; here it only gets arrow handling for its top bar. Not applied under /remote.
 */
export function Navigation() {
  const { pathname, key } = useLocation();
  const navType = useNavigationType();
  const shownPath = useRef(pathname); // the page focus was last placed for
  const lastFocused = useRef(new Map<string, string>()); // history entry -> href of the link focused on it, so Back lands where you left
  const navigate = useNavigate();
  const watching = pathname.startsWith("/watch/");
  const off = pathname === "/remote" || pathname.startsWith("/remote/");

  useEffect(() => (off ? undefined : startPad()), [off]);

  const back = useEffectEvent(() => (pathname !== "/" ? (history.state?.idx > 0 ? navigate(-1) : navigate("/")) : undefined));

  useEffect(() => {
    if (off) return;
    const onFocus = (e: FocusEvent) => {
      const href = e.target instanceof Element ? e.target.closest("main a[href]")?.getAttribute("href") : null;
      if (href) lastFocused.current.set(history.state?.key ?? "default", href); // the first entry has no key; the router calls it "default"
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, [off]);

  useEffect(() => {
    if (off) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const active = document.activeElement;
      const typing = isTextEntry(active);
      const dialog = document.querySelector<HTMLElement>("dialog[open]");
      if (dialog instanceof HTMLDialogElement && e.key === "Escape") return void (e.preventDefault(), dialog.close());
      if (dialog) return void (ARROWS[e.key] && moveFocus(ARROWS[e.key]!, dialog) && e.preventDefault());
      if (!watching && !typing && (e.key === "Escape" || e.key === "Backspace")) return void (e.preventDefault(), back());
      const jump = JUMPS[e.key];
      if (jump && !watching && !(typing && (jump === "home" || jump === "end")) && jumpFocus(jump)) return e.preventDefault();
      const d = ARROWS[e.key];
      if (!d) return;
      if (typing && (d === "left" || d === "right")) return; // the caret keeps these
      // In the player only the top bar navigates; otherwise the iframe or the video owns the arrows.
      const bar = watching ? document.querySelector<HTMLElement>("[data-bar]") : null;
      if (watching && !(bar && active && bar.contains(active))) return;
      if (moveFocus(d, bar ?? document)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [off, watching]);

  useEffect(() => {
    if (off || watching) return;
    // Real movement only: content scrolling under a parked pointer must not pull focus away from the pad.
    // html[data-mouse] marks the mouse as the input in use (row arrows show); any key or pad press clears it.
    const root = document.documentElement;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !(e.movementX || e.movementY)) return;
      root.dataset.mouse = "";
      focusUnderPointer(e.target);
    };
    const onKey = () => void delete root.dataset.mouse;
    addEventListener("pointermove", onMove, { passive: true });
    addEventListener("keydown", onKey, true);
    return () => {
      removeEventListener("pointermove", onMove);
      removeEventListener("keydown", onKey, true);
      onKey();
    };
  }, [off, watching]);

  usePad((a) => {
    delete document.documentElement.dataset.mouse;
    const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
    if (isDirection(a)) return pressArrow(a);
    if (a === "b") return dialog ? dialog.close() : back();
    if (a === "menu") return void dispatchEvent(new Event(HELP_EVENT));
    const el = document.activeElement;
    if (a === "y") return void el?.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true }));
    if (a !== "a") return;
    if (!(el instanceof HTMLElement) || el === document.body) return void restoreFocus(false);
    el.click();
    if (isTextEntry(el)) el.focus(); // let the platform raise its on-screen keyboard
  }, !off && !watching);

  // A new page has nowhere for focus to be yet (the old element is gone, the data is still loading):
  // watch the DOM for a few seconds and put focus on the page's primary element as soon as there is one.
  useEffect(() => {
    if (off || watching) return;
    // Same page, URL rewritten in place (season tab, search query): focus is already where the user put it.
    const samePage = shownPath.current === pathname;
    shownPath.current = pathname;
    if (samePage && navType === "REPLACE") return;
    let timer = 0;
    const want = lastFocused.current.get(key); // coming Back: wait for the card we left, rather than the first one
    const done = () => {
      observer.disconnect();
      clearTimeout(timeout);
      clearTimeout(timer);
    };
    const check = () => {
      const card = want ? document.querySelector<HTMLElement>(`main a[href="${CSS.escape(want)}"]`) : null;
      const a = document.activeElement;
      if (card) focusAndReveal(card, false);
      if (card || (a && a !== document.body) || (!want && restoreFocus(true))) done();
    };
    // Rows arrive one by one: settle briefly after the last change so focus lands on the topmost row, not the first to load.
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(check, 120);
    });
    const timeout = setTimeout(() => (restoreFocus(true), done()), SETTLE_MS);
    observer.observe(document.body, { childList: true, subtree: true });
    check();
    return done;
  }, [pathname, key, off, watching, navType]);

  return null;
}
