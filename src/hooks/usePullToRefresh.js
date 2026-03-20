import { useEffect, useRef, useState } from "react";

/**
 * usePullToRefresh
 * Attach to a scrollable container ref. When user pulls down past `threshold`
 * pixels from the top, `onRefresh` is called.
 *
 * Returns { containerRef, isRefreshing, pullDistance }
 */
export default function usePullToRefresh({ onRefresh, threshold = 70 }) {
  const containerRef = useRef(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const startY = useRef(0);
  const pulling = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      if (el.scrollTop === 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };

    const onTouchMove = (e) => {
      if (!pulling.current) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0) {
        // Apply rubber-band resistance
        setPullDistance(Math.min(delta * 0.45, threshold * 1.5));
      }
    };

    const onTouchEnd = async () => {
      if (!pulling.current) return;
      pulling.current = false;
      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(0);
        await onRefresh();
        setIsRefreshing(false);
      } else {
        setPullDistance(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [onRefresh, threshold, pullDistance, isRefreshing]);

  return { containerRef, isRefreshing, pullDistance };
}