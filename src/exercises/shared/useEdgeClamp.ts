import { useLayoutEffect, useRef, useState } from "react";

/** Margin (px) kept between a stimulus and the viewport edge. */
const EDGE_MARGIN_PX = 12;

/**
 * Keeps a centred, absolutely-positioned stimulus fully on screen.
 *
 * A stimulus placed at a normalized point and centred with
 * `translate(-50%, -50%)` spills off the viewport when the point sits near an
 * edge (grid border cells) or when the content is wide (long words in the
 * periphery). This measures the element after layout and returns an extra px
 * translation that nudges its bounding box back inside the viewport.
 *
 * Pass the stimulus identity in `deps` so the measurement re-runs whenever the
 * content or position changes.
 */
export function useEdgeClamp<T extends HTMLElement>(deps: unknown[]) {
  const ref = useRef<T>(null);
  const [offset, setOffset] = useState({ dx: 0, dy: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const m = EDGE_MARGIN_PX;
    let dx = 0;
    let dy = 0;
    if (r.left < m) dx = m - r.left;
    else if (r.right > window.innerWidth - m) dx = window.innerWidth - m - r.right;
    if (r.top < m) dy = m - r.top;
    else if (r.bottom > window.innerHeight - m) dy = window.innerHeight - m - r.bottom;
    setOffset((prev) =>
      prev.dx === dx && prev.dy === dy ? prev : { dx, dy },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const transform = `translate(-50%, -50%) translate(${offset.dx}px, ${offset.dy}px)`;
  return { ref, transform };
}
