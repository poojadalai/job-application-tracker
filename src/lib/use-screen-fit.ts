import { useLayoutEffect, useRef, useState } from "react";

// Module scope so it is the same function on every render (it's an effect dependency).
const always = () => true;

// How many items of a list fit between the list's top and the bottom of the
// screen, so a "Show more" button below them is visible without scrolling.
// Attach the returned ref to the element whose children are the items (a
// board column's <ul>, a table's <tbody>).
//
// Two steps, both before paint:
// 1. Estimate: add up the heights of the items shown until the next one would
//    cross the bottom edge, keeping `reserve` pixels for what sits below.
// 2. Correct: if the page still scrolls (the reserve guess was off for this
//    layout, or pixel rounding), show one fewer item and check again.
// Until it can measure (on the server, in tests without layout, or for an
// empty list) it returns `fallback`.
export function useScreenFit<T extends HTMLElement>({
  fallback,
  gap = 0,
  reserve = 88,
  min = 1,
  isEmpty,
  expanded,
  definesPageBottom = always,
}: {
  fallback: number;
  gap?: number; // space between items, e.g. 8 for Tailwind gap-2
  reserve?: number; // room below the list: button, padding, page padding
  min?: number;
  isEmpty: boolean; // re-measure once an empty list gets items
  // True after "Show more": the page is then meant to scroll, so don't correct.
  expanded: boolean;
  // Whether this list is what makes the page tall (e.g. the tallest column).
  // Only that list should shrink when the page scrolls.
  definesPageBottom?: (list: T) => boolean;
}) {
  const ref = useRef<T>(null);
  const [fit, setFit] = useState(fallback);
  // The latest value set, readable before React re-renders with it.
  const fitRef = useRef(fallback);
  const measured = useRef(false);

  // Step 1: estimate, on mount and on resize.
  useLayoutEffect(() => {
    function measure() {
      const list = ref.current;
      const items = list ? Array.from(list.children) : [];
      if (!list || items.length === 0) return;
      const heights = items.map((item) => item.getBoundingClientRect().height);
      if (heights.every((height) => height <= 0)) return; // no layout to measure
      measured.current = true;
      const top = list.getBoundingClientRect().top + window.scrollY;
      const available = window.innerHeight - top - reserve;

      // Real heights of the items on screen, so tall ones count fully.
      let used = 0;
      let count = 0;
      for (const height of heights) {
        if (used + height > available) break;
        used += height + gap;
        count++;
      }
      // If every item shown fits, estimate how many more would, from the average.
      if (count === heights.length) {
        const average = used / count - gap;
        count += Math.max(0, Math.floor((available - used + gap) / (average + gap)));
      }
      fitRef.current = Math.max(min, count);
      setFit(fitRef.current);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isEmpty, gap, reserve, min]);

  // Step 2: correct, once the latest estimate has been rendered.
  useLayoutEffect(() => {
    const list = ref.current;
    if (!list || !measured.current || expanded) return;
    // Still showing the previous, larger count: wait for the next render.
    if (list.children.length > fitRef.current) return;
    const scrolls = document.documentElement.scrollHeight > window.innerHeight;
    if (scrolls && fitRef.current > min && definesPageBottom(list)) {
      fitRef.current -= 1;
      setFit(fitRef.current);
    }
  }, [fit, expanded, min, definesPageBottom]);

  return [ref, fit] as const;
}
