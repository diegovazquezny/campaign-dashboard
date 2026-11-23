"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type Props = {
  /** Names the thing explained; the button reads "About {label}". */
  label: string;
  text: string;
};

const GAP = 8;
const MARGIN = 8;

// Circled-i that explains a figure. Opens on mouse hover, keyboard focus and
// touch tap; closes on leave, blur, Esc and outside press, and follows the icon on scroll and resize.
//
// The text is always in the DOM (screen-reader only while closed) so
// aria-describedby and tests can find it. While open it moves into a portal
// on <body> and is placed with `position: fixed`, so neither a scrolling
// table wrapper nor a sticky header's stacking context can clip or cover it.
export function InfoTip({ label, text }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  // Set on pointerdown so focus and click can tell a mouse from a finger.
  const pointer = useRef<string | null>(null);

  const place = useCallback(() => {
    const b = button.current?.getBoundingClientRect();
    const t = tip.current;
    if (!b || !t) return;
    const w = t.offsetWidth;
    const h = t.offsetHeight;
    const left = Math.max(
      MARGIN,
      Math.min(b.left + b.width / 2 - w / 2, window.innerWidth - w - MARGIN),
    );
    const above = b.top - h - GAP;
    setPos({ left, top: above >= MARGIN ? above : b.bottom + GAP });
  }, []);

  // Measure before paint, so the bubble never shows at a stale position.
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPress = (e: Event) => {
      const target = e.target as Node;
      if (!button.current?.contains(target) && !tip.current?.contains(target)) {
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPress);
    // Follow the icon when the page or the table scrolls (focusing an icon
    // can itself scroll it into view) instead of closing.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPress);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const bubble = (
    <span
      ref={tip}
      id={id}
      role="tooltip"
      className={
        open
          ? "fixed z-50 w-max max-w-64 rounded-card border border-border bg-card px-3 py-2 text-left text-[13px] leading-snug font-normal tracking-normal whitespace-normal text-fg normal-case shadow-card"
          : "sr-only"
      }
      style={
        open
          ? pos
            ? { top: pos.top, left: pos.left }
            : { top: 0, left: 0, visibility: "hidden" }
          : undefined
      }
    >
      {text}
    </span>
  );

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={id}
        className="-my-1 inline-flex h-6 w-6 shrink-0 cursor-help items-center justify-center rounded-full align-middle text-muted hover:text-fg"
        onPointerDown={(e) => {
          pointer.current = e.pointerType;
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") setOpen(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setOpen(false);
        }}
        onFocus={() => {
          // A tap focuses the button on some browsers; click handles touch.
          if (pointer.current !== "touch" && pointer.current !== "pen") {
            setOpen(true);
          }
        }}
        onBlur={() => {
          pointer.current = null;
          setOpen(false);
        }}
        onClick={() => {
          if (pointer.current === "touch" || pointer.current === "pen") {
            setOpen((o) => !o);
          }
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="8" cy="8" r="6.25" />
          <path d="M8 7.25v3.5" strokeLinecap="round" />
          <circle cx="8" cy="5" r="0.5" fill="currentColor" />
        </svg>
      </button>
      {open ? createPortal(bubble, document.body) : bubble}
    </>
  );
}
