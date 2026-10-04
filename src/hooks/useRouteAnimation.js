import { useState, useEffect, useRef } from 'react';
import { slicePathToFraction } from '../utils/geoMath';

export default function useRouteAnimation(path, durationMs = 1500) {
  const [progress, setProgress] = useState(0);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!path || path.length === 0) {
      setProgress(0);
      return undefined;
    }

    setProgress(0);
    const startTime = performance.now();
    // Re-rendering the Leaflet polyline on every rAF tick (~60/s) forces a
    // main-thread layout recalculation each time, which shows up as layout
    // shift during the animation window. Throttling to ~20 updates/s keeps
    // the draw-in looking smooth while cutting that work by two-thirds.
    const MIN_STEP_MS = 50;
    let lastUpdateTime = -Infinity;

    const tick = (now) => {
      const elapsed = now - startTime;
      const nextProgress = Math.min(1, elapsed / durationMs);
      if (nextProgress >= 1 || now - lastUpdateTime >= MIN_STEP_MS) {
        setProgress(nextProgress);
        lastUpdateTime = now;
      }
      if (nextProgress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [path, durationMs]);

  const animatedPath = path && path.length > 0 ? slicePathToFraction(path, progress) : [];

  return { animatedPath, progress };
}
