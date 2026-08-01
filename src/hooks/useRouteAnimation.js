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

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const nextProgress = Math.min(1, elapsed / durationMs);
      setProgress(nextProgress);
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
