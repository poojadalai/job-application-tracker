import { useLayoutEffect, useRef, useState } from "react";

// How many items of a list fit between the list's top and the bottom of the
// screen, so a "Show more" button below them is visible without scrolling.
// Attach the returned ref to the element whose children are the items (a
// board column's <ul>, a table's <tbody>). Measures the items currently
// shown, before paint, and again on resize. Until it can
// measure (on the server, in tests without layout, or for an empty list) it
// returns `fallback`.
export function useScreenFit<T extends HTMLElement>({
  fallback,
  gap = 0,
  reserve = 88,
  min = 1,
  isEmpty,
}: {
  fallback: number;
  gap?: number; // space between items, e.g. 8 for Tailwind gap-2
  reserve?: number; // room below the list: the button, column padding and the page's bottom padding
  min?: number;
  isEmpty: boolean; // re-measure once an empty list gets items
}) {
  const ref = useRef<T>(null);
  const [fit, setFit] = useState(fallback);

  useLayoutEffect(() => {
    function measure() {
      const list = ref.current;
      const items = list ? Array.from(list.children) : [];
      if (!list || items.length === 0) return;
      const heights = items.map((item) => item.getBoundingClientRect().height);
      if (heights.every((height) => height <= 0)) return; // no layout to measure
      const top = list.getBoundingClientRect().top + window.scrollY;
      const available = window.innerHeight - top - reserve;

      // Add up the real heights of the items on screen until the next one
      // would cross the bottom edge. Tall items (long role names) count fully.
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
      setFit(Math.max(min, count));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isEmpty, gap, reserve, min]);

  return [ref, fit] as const;
}
