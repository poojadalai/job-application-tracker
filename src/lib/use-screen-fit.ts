import { useLayoutEffect, useRef, useState } from "react";

// How many items of a list fit between the list's top and the bottom of the
// screen, so a "Show more" button below them is visible without scrolling.
// Attach the returned ref to the element whose children are the items (a
// board column's <ul>, a table's <tbody>). Measures the average height of the
// items currently shown, before paint, and again on resize. Until it can
// measure (on the server, in tests without layout, or for an empty list) it
// returns `fallback`.
export function useScreenFit<T extends HTMLElement>({
  fallback,
  gap = 0,
  reserve = 64,
  min = 3,
  isEmpty,
}: {
  fallback: number;
  gap?: number; // space between items, e.g. 8 for Tailwind gap-2
  reserve?: number; // room kept below the list for the button
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
      const average =
        items.reduce((sum, item) => sum + item.getBoundingClientRect().height, 0) / items.length;
      if (average <= 0) return; // no layout to measure
      const top = list.getBoundingClientRect().top + window.scrollY;
      const available = window.innerHeight - top - reserve;
      setFit(Math.max(min, Math.floor((available + gap) / (average + gap))));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isEmpty, gap, reserve, min]);

  return [ref, fit] as const;
}
